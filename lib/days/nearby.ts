import { distanceMeters, formatDistance } from "@/lib/geo";
import { isTransportCategory } from "@/lib/days/transit";
import type { Category, Place } from "@/lib/supabase/types";

/**
 * Cercanía entre lugares, para repartirlos por días sin tener que ir al mapa
 * a mirar qué queda al lado de qué.
 */

const LODGING_EMOJIS = ["🛏", "🏨", "🏠", "🏡", "⛺"];
const LODGING_WORDS = /alojamiento|hotel|hostal|hostel|apartamento|casa/i;

/**
 * ¿Sirve este sitio como punto de partida para buscar qué hay cerca? El
 * aeropuerto, una estación o el hotel no: están en el día por logística, no
 * porque la visita del día sea por esa zona.
 */
export function isZoneAnchor(category: Category | undefined) {
  if (!category) return true;
  if (isTransportCategory(category)) return false;
  return !(
    LODGING_EMOJIS.some((e) => category.emoji?.includes(e)) || LODGING_WORDS.test(category.name)
  );
}

/**
 * "650 m · 11 min a pie". Los minutos son orientativos: la distancia es en
 * línea recta, así que se alarga un 30 % por las calles, a paso de turista
 * (unos 4,5 km/h). A partir de una hora andando ya no se dan: nadie va a pie.
 */
export function formatNearby(meters: number): string {
  const minutes = Math.max(1, Math.round((meters * 1.3) / 75));
  return minutes > 60 ? formatDistance(meters) : `${formatDistance(meters)} · ${minutes} min a pie`;
}

/** Radio de una zona: lo que se recorre a pie sin pensarlo, unos 10 minutos. */
export const ZONE_RADIUS_M = 700;

/** Los radios que se ofrecen en Ajustes. */
export const ZONE_RADIUS_OPTIONS = [300, 500, 700, 1000, 1500, 2500];

/** "700 m", "1 km", "1,5 km": el radio tal como se enseña. */
export const formatRadius = (meters: number) =>
  meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString("es")} km`;

export interface Zone {
  /** El lugar con más vecinos: da nombre a la zona ("Zona de Big Ben"). */
  center: Place;
  places: Place[];
}

/**
 * Agrupa lugares en zonas a pie. Se coge el lugar con más vecinos dentro del
 * radio, se forma una zona con ellos y se repite con los que quedan. Así cada
 * zona tiene un tamaño acotado: uniendo simplemente "los que están cerca de
 * alguno", todo el centro de una ciudad acababa en una sola zona enorme.
 */
export function groupByZone(places: Place[], radius = ZONE_RADIUS_M): Zone[] {
  let remaining = [...places];
  const zones: Zone[] = [];
  while (remaining.length > 0) {
    let best: Zone | null = null;
    for (const center of remaining) {
      const members = remaining.filter((p) => distanceMeters(center, p) <= radius);
      if (!best || members.length > best.places.length) best = { center, places: members };
    }
    const zone = best!;
    zones.push(zone);
    const taken = new Set(zone.places.map((p) => p.id));
    remaining = remaining.filter((p) => !taken.has(p.id));
  }
  return zones;
}
