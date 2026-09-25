export type DocumentType = "flight" | "transport" | "lodging" | "reservation" | "ticket" | "note";

export interface Profile {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  cover_image_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  label: string | null;
  completed: boolean;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  is_builtin: boolean;
  sort_order: number;
  created_at: string;
}

export interface TripHiddenCategory {
  trip_id: string;
  category_id: string;
}

export interface Place {
  id: string;
  trip_id: string;
  name: string;
  category_id: string;
  lat: number;
  lng: number;
  address: string | null;
  google_place_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TransitMode = "metro" | "train" | "bus" | "tram" | "boat" | "walk";

/** Un tramo de trayecto desde una parada del día (ver 0011_stop_transit.sql). */
export interface TransitStep {
  mode: TransitMode;
  /** "Victoria", "Suffragette", "Stansted Express"… */
  line?: string;
  /** Color de la línea, en hex. */
  color?: string;
  /** Hacia dónde va: lo que pone en el andén o en el tren. */
  direction?: string;
  /** Dónde subir. */
  from?: string;
  /** Dónde bajar. */
  to?: string;
  stops?: number;
  minutes?: number;
  /** Andén o vía. */
  platform?: string;
  note?: string;
}

export interface PlaceDayLink {
  id: string;
  trip_id: string;
  place_id: string;
  day_id: string;
  order_in_day: number | null;
  scheduled_at: string | null;
  /** Opcional: no existe hasta ejecutar la migración 0011. */
  transit?: TransitStep[] | null;
  /**
   * Nota de esta parada en este día (0012). `undefined` si la migración aún no
   * se ha ejecutado: entonces se enseña la nota del lugar, como antes.
   */
  notes?: string | null;
  created_at: string;
}

export interface FlightDetails {
  airline?: string;
  flight_number?: string;
  departure_airport?: string;
  arrival_airport?: string;
  departure_time?: string;
  arrival_time?: string;
  confirmation_code?: string;
}

export interface LodgingDetails {
  address?: string;
  check_in?: string;
  check_out?: string;
  confirmation_code?: string;
}

export interface ReservationDetails {
  place_name?: string;
  date_time?: string;
  party_size?: number;
  confirmation_code?: string;
}

export interface TransportDetails {
  company?: string;
  service_number?: string;
  departure_station?: string;
  departure_time?: string;
  arrival_station?: string;
  arrival_time?: string;
  seat?: string;
  confirmation_code?: string;
}

export interface TicketDetails {
  venue?: string;
  date_time?: string;
  quantity?: number;
  seat?: string;
  confirmation_code?: string;
}

export type DocumentDetails =
  | FlightDetails
  | TransportDetails
  | LodgingDetails
  | ReservationDetails
  | TicketDetails
  | Record<string, never>;

export interface TripDocument {
  id: string;
  trip_id: string;
  place_id: string | null;
  day_id: string | null;
  type: DocumentType;
  title: string;
  details: DocumentDetails;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackPoint {
  id: string;
  trip_id: string;
  profile_id: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
}

export interface Attachment {
  id: string;
  document_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Note {
  id: string;
  trip_id: string;
  title: string;
  body: string | null;
  url: string | null;
  /** Clave de la paleta de lib/notes.ts. */
  color: string;
  pinned: boolean;
  /** Tachada: resuelta o ya no hace falta, pero se conserva. */
  done: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteItem {
  id: string;
  note_id: string;
  trip_id: string;
  text: string;
  done: boolean;
  sort_order: number;
  created_at: string;
}
