import { distanceMeters } from "./geo";
import type { Place } from "./supabase/types";

/**
 * Distancia por debajo de la cual dos sitios con el mismo nombre se consideran
 * el mismo. Generosa a propósito: Google devuelve coordenadas ligeramente
 * distintas para el mismo monumento según desde qué ficha se llegue.
 */
const SAME_PLACE_METERS = 120;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * Busca si un sitio ya está guardado en el viaje.
 *
 * El identificador de Google es la señal buena cuando existe. Cuando no (un
 * sitio añadido a mano, o una ficha antigua sin él), se cae a "mismo nombre y
 * prácticamente en el mismo punto", que es lo que de verdad significa haberlo
 * añadido dos veces sin darse cuenta.
 */
export function findExistingPlace(
  places: Place[],
  candidate: { name: string; lat: number; lng: number; placeId?: string },
): Place | null {
  if (candidate.placeId) {
    const byId = places.find((p) => p.google_place_id === candidate.placeId);
    if (byId) return byId;
  }

  const name = normalize(candidate.name);
  if (!name) return null;

  return (
    places.find(
      (p) =>
        normalize(p.name) === name &&
        distanceMeters({ lat: p.lat, lng: p.lng }, { lat: candidate.lat, lng: candidate.lng }) <
          SAME_PLACE_METERS,
    ) ?? null
  );
}
