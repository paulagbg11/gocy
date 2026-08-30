export interface LatLng {
  lat: number;
  lng: number;
}

/** Por encima de esta velocidad damos por hecho que no se fue andando. */
export const WALKING_MAX_KMH = 12;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distancia en metros entre dos coordenadas (fórmula de haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * ¿Este tramo se hizo en transporte y no andando? Se mira la velocidad
 * implícita: sin esto, el tren Viena–Budapest sumaría 200 km a los
 * "kilómetros caminados" del viaje.
 */
export function isTransportSegment(meters: number, seconds: number): boolean {
  if (seconds <= 0) return meters > 2000;
  const kmh = meters / 1000 / (seconds / 3600);
  return kmh > WALKING_MAX_KMH;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
