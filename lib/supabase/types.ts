export type DocumentType = "flight" | "lodging" | "reservation" | "note";

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

export interface PlaceDayLink {
  id: string;
  trip_id: string;
  place_id: string;
  day_id: string;
  order_in_day: number | null;
  scheduled_at: string | null;
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

export type DocumentDetails = FlightDetails | LodgingDetails | ReservationDetails | Record<string, never>;

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

export interface Attachment {
  id: string;
  document_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}
