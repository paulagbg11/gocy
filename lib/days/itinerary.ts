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
  return gatherChoices(result);
}

/**
 * Los grupos "a elegir" que hay de verdad en el día: identificadores que
 * comparten dos paradas o más. Uno suelto (se quitaron las demás opciones) no
 * cuenta: es una parada normal.
 */
function choiceSizes(sequence: ItineraryEntry[]) {
  const sizes = new Map<string, number>();
  for (const { link } of sequence) {
    if (link.choice_group) sizes.set(link.choice_group, (sizes.get(link.choice_group) ?? 0) + 1);
  }
  for (const [group, size] of sizes) if (size < 2) sizes.delete(group);
  return sizes;
}

/**
 * Junta las opciones de cada grupo "a elegir" detrás de la primera, para que
 * siempre salgan seguidas aunque se haya arrastrado otra parada en medio.
 */
export function gatherChoices(sequence: ItineraryEntry[]): ItineraryEntry[] {
  const sizes = choiceSizes(sequence);
  if (sizes.size === 0) return sequence;
  const done = new Set<string>();
  return sequence.flatMap((entry) => {
    const group = entry.link.choice_group;
    if (!group || !sizes.has(group)) return [entry];
    if (done.has(group)) return [];
    done.add(group);
    return sequence.filter((e) => e.link.choice_group === group);
  });
}

export interface StopMark {
  /** "1", "2", "3a", "3b"…: lo que lleva la parada en la lista y en su pin. */
  label: string;
  /** Si es una opción a elegir: cuál es dentro de su grupo y cuántas hay. */
  choice: { group: string; index: number; size: number } | null;
}

/**
 * La numeración del día. Un grupo "a elegir" cuenta como una sola parada: sus
 * opciones comparten número y se distinguen por la letra (3a, 3b, 3c).
 * `sequence` tiene que venir ya ordenada con sortItinerary.
 */
export function stopMarks(sequence: ItineraryEntry[]): StopMark[] {
  const sizes = choiceSizes(sequence);
  let number = 0;
  let index = 0;
  return sequence.map((entry, i) => {
    const group = entry.link.choice_group;
    const size = group ? sizes.get(group) : undefined;
    if (!group || !size) {
      number += 1;
      return { label: String(number), choice: null };
    }
    const first = sequence[i - 1]?.link.choice_group !== group;
    if (first) number += 1;
    index = first ? 0 : index + 1;
    return {
      label: `${number}${String.fromCharCode(97 + index)}`,
      choice: { group, index, size },
    };
  });
}

/**
 * Un pin por lugar, con todas sus etiquetas: el hotel que abre y cierra el
 * día lleva "1 · 6" en vez de dos pines uno encima de otro.
 */
export function pinsOf(sequence: ItineraryEntry[], marks: StopMark[]) {
  const pins = new Map<string, { place: Place; label: string }>();
  sequence.forEach(({ place }, i) => {
    const pin = pins.get(place.id);
    if (pin) pin.label += ` · ${marks[i].label}`;
    else pins.set(place.id, { place, label: marks[i].label });
  });
  return [...pins.values()];
}

/**
 * Lleva una parada del puesto `from` al puesto `to`, corriendo las demás. Solo
 * se mueven las paradas sin hora, así que las que tienen hora siguen en orden
 * cronológico entre sí.
 */
export function moveEntryTo(sequence: ItineraryEntry[], from: number, to: number) {
  if (from === to || to < 0 || to >= sequence.length) return sequence;
  const next = [...sequence];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
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
