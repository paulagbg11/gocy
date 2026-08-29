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
