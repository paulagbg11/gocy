import { distanceMeters, isTransportSegment, type LatLng } from "@/lib/geo";
import type { Place, PlaceDayLink, TrackPoint, TripDay } from "@/lib/supabase/types";

/** Mínimo de migas para que merezca la pena usarlas en vez de los lugares. */
const MIN_GPS_POINTS = 5;

export type RouteSource = "gps" | "places" | "empty";

export interface RoutePoint extends LatLng {
  dayIndex: number | null;
  label?: string;
}

export interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  dayIndex: number | null;
  /** Tramo hecho en transporte (o salto entre días): se dibuja discontinuo y no suma. */
  isTransport: boolean;
  meters: number;
}

export interface BuiltRoute {
  source: RouteSource;
  points: RoutePoint[];
  segments: RouteSegment[];
  /** Suma de los tramos que sí parecen hechos a pie. */
  walkingMeters: number;
  dayCount: number;
  placeCount: number;
}

const EMPTY: BuiltRoute = {
  source: "empty",
  points: [],
  segments: [],
  walkingMeters: 0,
  dayCount: 0,
  placeCount: 0,
};

function linkSegments(points: RoutePoint[], transportFor: (a: RoutePoint, b: RoutePoint, i: number) => boolean) {
  const segments: RouteSegment[] = [];
  let walkingMeters = 0;

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const meters = distanceMeters(from, to);
    const isTransport = transportFor(from, to, i);
    if (!isTransport) walkingMeters += meters;
    segments.push({ from, to, dayIndex: to.dayIndex, isTransport, meters });
  }

  return { segments, walkingMeters };
}

/**
 * Normaliza el recorrido del viaje a partir de la mejor fuente disponible.
 *
 * Con migas de GPS se usa la traza real; si no hay (viaje antiguo, ubicación
 * desactivada), se cae a los lugares asignados a días, en el mismo orden con el
 * que se dibujan en la pestaña Días. Así Estravel funciona siempre.
 */
export function buildRoute({
  trackPoints,
  places,
  links,
  days,
}: {
  trackPoints: TrackPoint[];
  places: Place[];
  links: PlaceDayLink[];
  days: TripDay[];
}): BuiltRoute {
  const dayIndexByDate = new Map(days.map((d) => [d.date, d.day_index]));
  const dayIndexById = new Map(days.map((d) => [d.id, d.day_index]));
  const placeCount = new Set(links.map((l) => l.place_id)).size;

  if (trackPoints.length >= MIN_GPS_POINTS) {
    const points: RoutePoint[] = trackPoints.map((p) => {
      const at = new Date(p.recorded_at);
      const localDate = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
        at.getDate(),
      ).padStart(2, "0")}`;
      return { lat: p.lat, lng: p.lng, dayIndex: dayIndexByDate.get(localDate) ?? null };
    });

    const { segments, walkingMeters } = linkSegments(points, (_a, _b, i) => {
      const seconds =
        (new Date(trackPoints[i].recorded_at).getTime() -
          new Date(trackPoints[i - 1].recorded_at).getTime()) /
        1000;
      return isTransportSegment(distanceMeters(points[i - 1], points[i]), seconds);
    });

    return {
      source: "gps",
      points,
      segments,
      walkingMeters,
      dayCount: new Set(points.map((p) => p.dayIndex).filter((d) => d !== null)).size,
      placeCount,
    };
  }

  // Respaldo: la ruta planificada, lugar a lugar y día a día.
  const placesById = new Map(places.map((p) => [p.id, p]));
  const ordered = [...links]
    .map((link) => ({ link, place: placesById.get(link.place_id) }))
    .filter((e): e is { link: PlaceDayLink; place: Place } => !!e.place)
    .sort((a, b) => {
      const dayA = dayIndexById.get(a.link.day_id) ?? 0;
      const dayB = dayIndexById.get(b.link.day_id) ?? 0;
      if (dayA !== dayB) return dayA - dayB;
      return (a.link.order_in_day ?? 0) - (b.link.order_in_day ?? 0);
    });

  if (ordered.length === 0) return { ...EMPTY, placeCount };

  const points: RoutePoint[] = ordered.map(({ link, place }) => ({
    lat: place.lat,
    lng: place.lng,
    dayIndex: dayIndexById.get(link.day_id) ?? null,
    label: place.name,
  }));

  // Aquí el "transporte" es el salto de la última parada de un día a la
  // primera del siguiente: no es un trayecto que se hiciera del tirón.
  const { segments, walkingMeters } = linkSegments(
    points,
    (a, b) => a.dayIndex !== b.dayIndex,
  );

  return {
    source: "places",
    points,
    segments,
    walkingMeters,
    dayCount: new Set(points.map((p) => p.dayIndex).filter((d) => d !== null)).size,
    placeCount,
  };
}

/** Paleta para la vista "por días". Se repite si el viaje es muy largo. */
export const DAY_COLORS = [
  "#2f6f7e",
  "#bd6248",
  "#4f7a68",
  "#b98f3a",
  "#5b7a91",
  "#a5715f",
  "#8a6a4f",
  "#7a5c86",
];

export const dayColor = (dayIndex: number | null) =>
  dayIndex === null ? "#9aa8ad" : DAY_COLORS[(dayIndex - 1) % DAY_COLORS.length];
