import type { Place, PlaceDayLink } from "@/lib/supabase/types";

/**
 * El orden de las paradas de un día.
 *
 * Hay un único orden (order_in_day) para todo el día, con una regla: las
 * paradas con hora van siempre en orden cronológico entre sí. Las que no
 * tienen hora se quedan donde se pusieron, así que pueden ir "entre" dos
 * horas: Big Ben a las 18:00, luego tres sitios de alrededor sin hora, y
 * Chinatown a las 20:00.
 *
 * Antes el mapa ordenaba solo por order_in_day y el timeline ponía siempre
 * delante lo que tenía hora, y las dos vistas del mismo día no coincidían.
 */

export interface ItineraryEntry {
  link: PlaceDayLink;
  place: Place;
}

export const timeOf = (entry: ItineraryEntry): number | null =>
  entry.link.scheduled_at ? Date.parse(entry.link.scheduled_at) : null;

/**
 * Ordena por order_in_day y, si alguna hora quedó fuera de sitio (datos de
 * antes de esta regla, o una hora cambiada desde el otro móvil), recoloca las
 * paradas con hora en orden cronológico dentro de los huecos que ocupan las
 * paradas con hora. Las paradas sin hora no se mueven.
 */
export function sortItinerary(entries: ItineraryEntry[]): ItineraryEntry[] {
  const byOrder = [...entries].sort(
    (a, b) =>
      (a.link.order_in_day ?? 0) - (b.link.order_in_day ?? 0) ||
      a.link.created_at.localeCompare(b.link.created_at),
  );
  const timedSlots = byOrder.flatMap((entry, i) => (timeOf(entry) !== null ? [i] : []));
  const timedInOrder = timedSlots.map((i) => byOrder[i]).sort((a, b) => timeOf(a)! - timeOf(b)!);
  const result = [...byOrder];
  timedSlots.forEach((slot, k) => (result[slot] = timedInOrder[k]));
  return result;
}

/** Sube (-1) o baja (+1) una parada un puesto. */
export function moveEntry(sequence: ItineraryEntry[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= sequence.length) return sequence;
  const next = [...sequence];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Coloca una parada a la que se le acaba de poner hora (`time` en ms). Si
 * donde está ya respeta el orden de las demás horas, no se mueve: así, poner
 * hora a algo que ya estaba bien colocado no desordena el día. Si no, va justo
 * delante de la primera parada con una hora posterior, o detrás de la última
 * con hora si no hay ninguna posterior.
 */
export function placeByTime(sequence: ItineraryEntry[], linkId: string, time: number) {
  const index = sequence.findIndex((e) => e.link.id === linkId);
  const entry = sequence[index];
  const fits =
    sequence.slice(0, index).every((e) => (timeOf(e) ?? -Infinity) <= time) &&
    sequence.slice(index + 1).every((e) => (timeOf(e) ?? Infinity) >= time);
  if (fits) return sequence;

  const rest = sequence.filter((e) => e.link.id !== linkId);
  let insertAt = rest.findIndex((e) => (timeOf(e) ?? -Infinity) > time);
  if (insertAt === -1) {
    const lastTimed = rest.findLastIndex((e) => timeOf(e) !== null);
    insertAt = lastTimed + 1;
  }
  return [...rest.slice(0, insertAt), entry, ...rest.slice(insertAt)];
}

/** Los order_in_day que hay que cambiar para que queden 1, 2, 3… según `sequence`. */
export function orderPatches(sequence: ItineraryEntry[]) {
  return sequence.flatMap((entry, i) =>
    entry.link.order_in_day === i + 1 ? [] : [{ id: entry.link.id, order_in_day: i + 1 }],
  );
}

/** "HH:mm" en hora local, para el value de un <input type="time">. */
export function toLocalTimeValue(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * La hora escrita, en ISO. Se interpreta como hora local del móvil (igual que
 * se lee en toLocalTimeValue): si no, 14:00 se mostraba como 12:00 en verano.
 */
export function timeValueToIso(date: string, timeValue: string): string {
  return new Date(`${date}T${timeValue}:00`).toISOString();
}
