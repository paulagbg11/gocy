import { z } from "zod";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { DocumentDetails, DocumentType } from "./supabase/types";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  flight: "Vuelo",
  transport: "Tren/Bus",
  lodging: "Alojamiento",
  reservation: "Reserva",
  ticket: "Entrada",
  note: "Nota",
};

/** Orden en el que se muestran los tipos en los selectores y filtros. */
export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  "flight",
  "transport",
  "lodging",
  "reservation",
  "ticket",
  "note",
];

const EVENT_TIME_FIELD: Record<DocumentType, string | null> = {
  flight: "departure_time",
  transport: "departure_time",
  lodging: "check_in",
  reservation: "date_time",
  ticket: "date_time",
  note: null,
};

/** Fecha/hora del campo "datetime-local" relevante según el tipo de documento, ya formateada. */
export function documentEventTime(type: DocumentType, details: DocumentDetails): string | null {
  const field = EVENT_TIME_FIELD[type];
  if (!field) return null;
  const raw = (details as Record<string, unknown>)[field];
  if (typeof raw !== "string" || !raw) return null;
  try {
    return format(parseISO(raw), "d MMM, HH:mm", { locale: es });
  } catch {
    return null;
  }
}

export const flightDetailsSchema = z.object({
  airline: z.string().optional(),
  flight_number: z.string().optional(),
  departure_airport: z.string().optional(),
  arrival_airport: z.string().optional(),
  departure_time: z.string().optional(),
  arrival_time: z.string().optional(),
  confirmation_code: z.string().optional(),
});

export const lodgingDetailsSchema = z.object({
  address: z.string().optional(),
  check_in: z.string().optional(),
  check_out: z.string().optional(),
  confirmation_code: z.string().optional(),
});

export const reservationDetailsSchema = z.object({
  place_name: z.string().optional(),
  date_time: z.string().optional(),
  party_size: z.coerce.number().int().positive().optional(),
  confirmation_code: z.string().optional(),
});

export const transportDetailsSchema = z.object({
  company: z.string().optional(),
  service_number: z.string().optional(),
  departure_station: z.string().optional(),
  departure_time: z.string().optional(),
  arrival_station: z.string().optional(),
  arrival_time: z.string().optional(),
  seat: z.string().optional(),
  confirmation_code: z.string().optional(),
});

export const ticketDetailsSchema = z.object({
  venue: z.string().optional(),
  date_time: z.string().optional(),
  quantity: z.coerce.number().int().positive().optional(),
  seat: z.string().optional(),
  confirmation_code: z.string().optional(),
});

export const noteDetailsSchema = z.object({});

export const detailsSchemaFor = {
  flight: flightDetailsSchema,
  transport: transportDetailsSchema,
  lodging: lodgingDetailsSchema,
  reservation: reservationDetailsSchema,
  ticket: ticketDetailsSchema,
  note: noteDetailsSchema,
} as const;

export const documentFormSchema = z.object({
  type: z.enum(["flight", "transport", "lodging", "reservation", "ticket", "note"]),
  title: z.string().min(1, "Ponle un título"),
  notes: z.string().optional(),
  place_id: z.string().uuid().nullable().optional(),
  day_id: z.string().uuid().nullable().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;

export interface DocumentField {
  key: string;
  label: string;
  type?: string;
}

/**
 * Campos de cada tipo de documento. Viven aquí y no en el formulario porque la
 * vista de resumen recorre exactamente los mismos, y con dos listas separadas
 * cualquier campo nuevo se quedaría fuera de una de las dos pantallas.
 */
export const DOCUMENT_FIELDS: Record<DocumentType, DocumentField[]> = {
  flight: [
    { key: "airline", label: "Aerolínea" },
    { key: "flight_number", label: "Nº de vuelo" },
    { key: "departure_airport", label: "Aeropuerto de salida" },
    { key: "departure_time", label: "Hora de salida", type: "datetime-local" },
    { key: "arrival_airport", label: "Aeropuerto de llegada" },
    { key: "arrival_time", label: "Hora de llegada", type: "datetime-local" },
    { key: "confirmation_code", label: "Localizador" },
  ],
  transport: [
    { key: "company", label: "Compañía" },
    { key: "service_number", label: "Nº de tren/bus" },
    { key: "departure_station", label: "Estación de salida" },
    { key: "departure_time", label: "Hora de salida", type: "datetime-local" },
    { key: "arrival_station", label: "Estación de llegada" },
    { key: "arrival_time", label: "Hora de llegada", type: "datetime-local" },
    { key: "seat", label: "Asiento / coche" },
    { key: "confirmation_code", label: "Localizador" },
  ],
  lodging: [
    { key: "address", label: "Dirección" },
    { key: "check_in", label: "Check-in", type: "datetime-local" },
    { key: "check_out", label: "Check-out", type: "datetime-local" },
    { key: "confirmation_code", label: "Nº de reserva" },
  ],
  reservation: [
    { key: "place_name", label: "Lugar" },
    { key: "date_time", label: "Fecha y hora", type: "datetime-local" },
    { key: "party_size", label: "Nº de personas", type: "number" },
    { key: "confirmation_code", label: "Nº de reserva" },
  ],
  ticket: [
    { key: "venue", label: "Lugar / evento" },
    { key: "date_time", label: "Fecha y hora", type: "datetime-local" },
    { key: "quantity", label: "Nº de entradas", type: "number" },
    { key: "seat", label: "Asiento / zona" },
    { key: "confirmation_code", label: "Nº de entrada / localizador" },
  ],
  note: [],
};

/**
 * Trayecto que se pinta en grande en la cabecera del resumen: de dónde a
 * dónde y a qué hora. Los campos que salen aquí no se repiten luego en la
 * lista de abajo.
 */
interface JourneySpec {
  from: { place: string; time: string };
  to: { place: string; time: string };
  fromLabel: string;
  toLabel: string;
}

const JOURNEY_BY_TYPE: Partial<Record<DocumentType, JourneySpec>> = {
  flight: {
    from: { place: "departure_airport", time: "departure_time" },
    to: { place: "arrival_airport", time: "arrival_time" },
    fromLabel: "Salida",
    toLabel: "Llegada",
  },
  transport: {
    from: { place: "departure_station", time: "departure_time" },
    to: { place: "arrival_station", time: "arrival_time" },
    fromLabel: "Salida",
    toLabel: "Llegada",
  },
  lodging: {
    from: { place: "", time: "check_in" },
    to: { place: "", time: "check_out" },
    fromLabel: "Check-in",
    toLabel: "Check-out",
  },
};

export interface JourneyEnd {
  label: string;
  place: string | null;
  time: string | null;
  date: string | null;
}

/** Devuelve el trayecto para la cabecera, o null si no hay nada que enseñar. */
export function documentJourney(
  type: DocumentType,
  details: DocumentDetails,
): { from: JourneyEnd; to: JourneyEnd; fields: string[] } | null {
  const spec = JOURNEY_BY_TYPE[type];
  if (!spec) return null;
  const raw = details as Record<string, unknown>;

  const end = (side: "from" | "to"): JourneyEnd => {
    const { place, time } = spec[side];
    const parts = splitDateTime(raw[time]);
    return {
      label: side === "from" ? spec.fromLabel : spec.toLabel,
      place: typeof raw[place] === "string" && raw[place] ? (raw[place] as string) : null,
      time: parts?.time ?? null,
      date: parts?.date ?? null,
    };
  };

  const from = end("from");
  const to = end("to");
  if (!from.place && !from.time && !to.place && !to.time) return null;

  return {
    from,
    to,
    fields: [spec.from.place, spec.from.time, spec.to.place, spec.to.time].filter(Boolean),
  };
}

/** Separa un valor de datetime-local en hora y fecha, ya en castellano. */
export function splitDateTime(raw: unknown): { time: string; date: string } | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = parseISO(raw);
    return {
      time: format(parsed, "HH:mm", { locale: es }),
      date: format(parsed, "EEE d MMM", { locale: es }),
    };
  } catch {
    return null;
  }
}

/** Valor de un campo listo para enseñar, o null si está vacío. */
export function formatFieldValue(field: DocumentField, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (field.type === "datetime-local") {
    const parts = splitDateTime(raw);
    return parts ? `${parts.date}, ${parts.time}` : null;
  }
  return String(raw);
}
