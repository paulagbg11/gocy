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
 * Hacia dónde queda `b` visto desde `a`, en grados: 0 es el norte, 90 el este.
 * Como los mapas de la app van siempre con el norte arriba, una flecha girada
 * estos grados apunta igual que en el mapa.
 */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

/** "N", "NE", "E"…: el rumbo redondeado a los ocho puntos de la brújula. */
export const compassPoint = (degrees: number) => COMPASS_POINTS[Math.round(degrees / 45) % 8];

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
