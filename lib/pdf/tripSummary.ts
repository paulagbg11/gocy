import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import { sortItinerary, toLocalTimeValue, type ItineraryEntry } from "@/lib/days/itinerary";
import { dayColor } from "@/lib/estravel/buildRoute";
import { distanceMeters } from "@/lib/geo";
import type {
  Category,
  Place,
  PlaceDayLink,
  TransitStep,
  Trip,
  TripDay,
  TripDocument,
} from "@/lib/supabase/types";

/**
 * Todo lo que sale en el PDF del viaje, ya ordenado y masticado. El documento
 * solo pinta: así la lógica (qué reserva cae en qué día, dónde se duerme…) se
 * puede leer sin pelearse con la maqueta.
 */

export interface SummaryStop {
  link: PlaceDayLink;
  place: Place;
  order: number;
  emoji: string;
  color: string;
  categoryName: string | null;
  /** "HH:mm", o null si la parada no tiene hora. */
  time: string | null;
  notes: string | null;
  /** Tramos para llegar a la siguiente parada. */
  transit: TransitStep[];
  /** Distancia en línea recta hasta la siguiente parada; null en la última. */
  metersToNext: number | null;
}

export interface DayEvent {
  /** "HH:mm" o null. */
  time: string | null;
  kind: "flight" | "transport" | "lodging-in" | "lodging-out" | "reservation" | "ticket";
  document: TripDocument;
}

export interface SummaryDay {
  day: TripDay;
  color: string;
  stops: SummaryStop[];
  /** Vuelos, trenes, check-in/out, reservas y entradas de ese día, por hora. */
  events: DayEvent[];
  /** Alojamiento donde se duerme esa noche. */
  sleep: TripDocument | null;
  /** Suma de los tramos en línea recta entre paradas. */
  meters: number;
}

export interface TripSummary {
  trip: Trip;
  days: SummaryDay[];
  /** Reservas y billetes (todo menos las notas), por fecha. */
  bookings: TripDocument[];
  /** Lugares guardados sin ningún día, agrupados por categoría. */
  unassigned: { category: Category | null; places: Place[] }[];
  stopCount: number;
}

/** El campo de fecha y hora que manda en cada tipo de documento. */
const WHEN_FIELD: Partial<Record<TripDocument["type"], string>> = {
  flight: "departure_time",
  transport: "departure_time",
  lodging: "check_in",
  reservation: "date_time",
  ticket: "date_time",
};

/** Valor crudo de un datetime-local ("2026-10-06T10:05"), o null. */
export function detailValue(doc: TripDocument, key: string): string | null {
  const raw = (doc.details as Record<string, unknown>)[key];
  if (raw === null || raw === undefined || raw === "") return null;
  return String(raw);
}

const datePart = (raw: string | null) => (raw && raw.length >= 10 ? raw.slice(0, 10) : null);
const timePart = (raw: string | null) => (raw && raw.length >= 16 ? raw.slice(11, 16) : null);

/** Cuándo es el documento, para ordenarlo. Lo que no tiene fecha va al final. */
export function documentWhen(doc: TripDocument): string | null {
  const field = WHEN_FIELD[doc.type];
  return field ? detailValue(doc, field) : null;
}

/**
 * La nota de la parada en ese día. Igual que en DayItinerary: sin la migración
 * 0012 la columna no existe y se usa la del lugar.
 */
function stopNotes(link: PlaceDayLink, place: Place) {
  const notes = link.notes === undefined ? place.notes : link.notes;
  return notes?.trim() || null;
}

function eventsForDay(day: TripDay, documents: TripDocument[]): DayEvent[] {
  const events: DayEvent[] = [];
  for (const doc of documents) {
    switch (doc.type) {
      case "flight":
      case "transport":
      case "reservation":
      case "ticket": {
        const when = documentWhen(doc);
        const onThisDay = datePart(when) === day.date || (!when && doc.day_id === day.id);
        if (onThisDay) events.push({ time: timePart(when), kind: doc.type, document: doc });
        break;
      }
      case "lodging": {
        const checkIn = detailValue(doc, "check_in");
        const checkOut = detailValue(doc, "check_out");
        if (datePart(checkIn) === day.date || (!checkIn && doc.day_id === day.id)) {
          events.push({ time: timePart(checkIn), kind: "lodging-in", document: doc });
        }
        if (datePart(checkOut) === day.date) {
          events.push({ time: timePart(checkOut), kind: "lodging-out", document: doc });
        }
        break;
      }
    }
  }
  // Primero lo que tiene hora, en orden; lo que no, detrás.
  return events.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
}

/** El alojamiento de esa noche: check-in ese día o antes, y check-out después. */
function sleepForDay(day: TripDay, documents: TripDocument[]): TripDocument | null {
  return (
    documents.find((doc) => {
      if (doc.type !== "lodging") return false;
      const checkIn = datePart(detailValue(doc, "check_in"));
      const checkOut = datePart(detailValue(doc, "check_out"));
      if (!checkIn || !checkOut) return false;
      return checkIn <= day.date && day.date < checkOut;
    }) ?? null
  );
}

export function buildTripSummary({
  trip,
  days,
  places,
  links,
  documents,
  categoriesById,
}: {
  trip: Trip;
  days: TripDay[];
  places: Place[];
  links: PlaceDayLink[];
  documents: TripDocument[];
  categoriesById: Map<string, Category>;
}): TripSummary {
  const placesById = new Map(places.map((p) => [p.id, p]));

  const summaryDays = [...days]
    .sort((a, b) => a.day_index - b.day_index)
    .map((day): SummaryDay => {
      const entries = links
        .filter((l) => l.day_id === day.id)
        .map((link) => ({ link, place: placesById.get(link.place_id) }))
        .filter((e): e is ItineraryEntry => !!e.place);

      const sequence = sortItinerary(entries);
      const stops = sequence.map(({ link, place }, i): SummaryStop => {
        const category = categoriesById.get(place.category_id);
        const next = sequence[i + 1]?.place;
        return {
          link,
          place,
          order: i + 1,
          emoji: category?.emoji ?? FALLBACK_CATEGORY_EMOJI,
          color: category?.color ?? FALLBACK_CATEGORY_COLOR,
          categoryName: category?.name ?? null,
          time: link.scheduled_at ? toLocalTimeValue(link.scheduled_at) : null,
          notes: stopNotes(link, place),
          transit: link.transit ?? [],
          metersToNext: next ? distanceMeters(place, next) : null,
        };
      });

      return {
        day,
        color: dayColor(day.day_index),
        stops,
        events: eventsForDay(day, documents),
        sleep: sleepForDay(day, documents),
        meters: stops.reduce((sum, s) => sum + (s.metersToNext ?? 0), 0),
      };
    });

  const bookings = documents
    .filter((d) => d.type !== "note")
    .sort((a, b) => (documentWhen(a) ?? "9999").localeCompare(documentWhen(b) ?? "9999"));

  const assigned = new Set(links.map((l) => l.place_id));
  const groups = new Map<string, Place[]>();
  for (const place of places) {
    if (assigned.has(place.id)) continue;
    groups.set(place.category_id, [...(groups.get(place.category_id) ?? []), place]);
  }
  const unassigned = [...groups.entries()]
    .map(([categoryId, list]) => ({
      category: categoriesById.get(categoryId) ?? null,
      places: list,
    }))
    .sort((a, b) => (a.category?.sort_order ?? 999) - (b.category?.sort_order ?? 999));

  return {
    trip,
    days: summaryDays,
    bookings,
    unassigned,
    stopCount: summaryDays.reduce((sum, d) => sum + d.stops.length, 0),
  };
}

/** Andando, con un 30 % de más porque las calles no van en línea recta. */
export function walkingMinutes(meters: number) {
  return Math.max(1, Math.round((meters * 1.3) / ((4.5 * 1000) / 60)));
}
