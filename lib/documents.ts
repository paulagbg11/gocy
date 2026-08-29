import { z } from "zod";
import type { DocumentType } from "./supabase/types";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  flight: "Vuelo",
  lodging: "Alojamiento",
  reservation: "Reserva",
  note: "Nota",
};

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

export const noteDetailsSchema = z.object({});

export const detailsSchemaFor = {
  flight: flightDetailsSchema,
  lodging: lodgingDetailsSchema,
  reservation: reservationDetailsSchema,
  note: noteDetailsSchema,
} as const;

export const documentFormSchema = z.object({
  type: z.enum(["flight", "lodging", "reservation", "note"]),
  title: z.string().min(1, "Ponle un título"),
  notes: z.string().optional(),
  place_id: z.string().uuid().nullable().optional(),
  day_id: z.string().uuid().nullable().optional(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;
