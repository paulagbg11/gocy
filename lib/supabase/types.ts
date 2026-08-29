export type PlaceCategory =
  | "airport"
  | "lodging"
  | "restaurant"
  | "cafe"
  | "landmark"
  | "activity"
  | "shopping"
  | "other";

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
}

export interface Place {
  id: string;
  trip_id: string;
  name: string;
  category: PlaceCategory;
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

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { name: string }; Update: Partial<Profile> };
      trips: { Row: Trip; Insert: Partial<Trip> & { name: string; start_date: string; end_date: string }; Update: Partial<Trip> };
      trip_days: { Row: TripDay; Insert: Partial<TripDay> & { trip_id: string; day_index: number; date: string }; Update: Partial<TripDay> };
      places: { Row: Place; Insert: Partial<Place> & { trip_id: string; name: string; lat: number; lng: number }; Update: Partial<Place> };
      place_day_links: { Row: PlaceDayLink; Insert: Partial<PlaceDayLink> & { trip_id: string; place_id: string; day_id: string }; Update: Partial<PlaceDayLink> };
      documents: { Row: TripDocument; Insert: Partial<TripDocument> & { trip_id: string; type: DocumentType; title: string }; Update: Partial<TripDocument> };
      attachments: { Row: Attachment; Insert: Partial<Attachment> & { document_id: string; storage_path: string }; Update: Partial<Attachment> };
    };
  };
}
