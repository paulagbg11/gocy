import { format } from "date-fns";
import { formatShortDate } from "@/lib/dates";
import { photoTime } from "./days";
import type { TripDay, TripPhoto } from "@/lib/supabase/types";

export interface AlbumGroup {
  /** null: fotos cuyo día se borró. */
  day: TripDay | null;
  photos: TripPhoto[];
}

/** Las fotos por días, en orden de viaje y, dentro de cada día, de carrete. */
export function groupByDay(photos: TripPhoto[], days: TripDay[]): AlbumGroup[] {
  const sorted = [...photos].sort((a, b) => photoTime(a) - photoTime(b));
  const groups: AlbumGroup[] = [...days]
    .sort((a, b) => a.day_index - b.day_index)
    .map((day) => ({ day, photos: sorted.filter((p) => p.day_id === day.id) }));
  const dayIds = new Set(days.map((d) => d.id));
  groups.push({ day: null, photos: sorted.filter((p) => !p.day_id || !dayIds.has(p.day_id)) });
  return groups.filter((g) => g.photos.length > 0);
}

export const dayTitle = (day: TripDay | null) =>
  day ? `Día ${day.day_index} · ${formatShortDate(day.date)}` : "Sin día";

/** Fotos consecutivas del mismo lugar dentro de un día, para titularlas juntas. */
export function groupByPlace(photos: TripPhoto[]): { placeId: string | null; photos: TripPhoto[] }[] {
  const runs: { placeId: string | null; photos: TripPhoto[] }[] = [];
  for (const photo of photos) {
    const last = runs[runs.length - 1];
    if (last && last.placeId === photo.place_id) last.photos.push(photo);
    else runs.push({ placeId: photo.place_id, photos: [photo] });
  }
  return runs;
}

/**
 * Número de cada lugar según el orden en que se fotografió por primera vez:
 * es el que sale en el mapa del recorrido y junto a cada foto.
 */
export function numberPlaces(photos: TripPhoto[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const p of photos) if (p.place_id && !numbers.has(p.place_id)) numbers.set(p.place_id, numbers.size + 1);
  return numbers;
}

/**
 * Las fotos que caben en el póster, en el orden en que llegan (el del álbum:
 * por días y, dentro de cada uno, de carrete). Si sobran, primero las
 * favoritas, luego una de cada lugar y el resto repartido a lo largo del
 * viaje, para que no se quede un día entero fuera.
 */
export function pickPosterPhotos(sorted: TripPhoto[], max: number): TripPhoto[] {
  if (sorted.length <= max) return sorted;

  const chosen = new Set<string>();
  const take = (p: TripPhoto) => chosen.size < max && chosen.add(p.id);
  sorted.filter((p) => p.favorite).forEach(take);
  const placesSeen = new Set<string | null>(sorted.filter((p) => chosen.has(p.id)).map((p) => p.place_id));
  for (const p of sorted) {
    if (placesSeen.has(p.place_id)) continue;
    placesSeen.add(p.place_id);
    take(p);
  }
  const rest = sorted.filter((p) => !chosen.has(p.id));
  const missing = max - chosen.size;
  for (let i = 0; i < missing && rest.length > 0; i++) {
    take(rest[Math.floor((i * rest.length) / missing)]);
  }
  return sorted.filter((p) => chosen.has(p.id));
}

/** "14:05" si se sabe cuándo se hizo. */
export const photoClock = (photo: TripPhoto) =>
  photo.taken_at ? format(new Date(photo.taken_at), "HH:mm") : null;

/**
 * Descarga una imagen para pintarla en un canvas sin "ensuciarlo": pasando
 * por un blob deja de ser de otro dominio y el lienzo se puede exportar. Con
 * un <img> y no createImageBitmap, que falla en varias versiones de Safari.
 */
export async function loadImage(url: string): Promise<HTMLImageElement | null> {
  let objectUrl: string | null = null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    objectUrl = URL.createObjectURL(await response.blob());
    const src = objectUrl;
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("imagen ilegible"));
      image.src = src;
    });
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
