import { zip } from "fflate";
import { formatShortDate } from "@/lib/dates";
import { photoTime } from "./days";
import type { Place, TripDay, TripPhoto } from "@/lib/supabase/types";

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

/** Windows y iOS no aceptan estos caracteres en nombres de archivo. */
const safe = (name: string) => name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * El álbum entero en un ZIP: una carpeta por día y, dentro, las fotos en
 * orden con el nombre del lugar ("03 Trafalgar Square.jpg"). Se baja la
 * versión grande de cada foto, no la miniatura.
 *
 * Sin comprimir: los JPEG ya lo están, y comprimir otra vez solo gasta
 * batería para ahorrar un 1 %.
 */
export async function buildAlbumZip({
  groups,
  places,
  urlFor,
  onProgress,
}: {
  groups: AlbumGroup[];
  places: Place[];
  urlFor: (path: string) => string | undefined;
  onProgress: (done: number, total: number) => void;
}): Promise<Blob> {
  const placeName = new Map(places.map((p) => [p.id, p.name]));
  const total = groups.reduce((n, g) => n + g.photos.length, 0);
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  let done = 0;

  for (const group of groups) {
    const folder = safe(dayTitle(group.day).replace(" · ", " - "));
    for (const [i, photo] of group.photos.entries()) {
      const url = urlFor(photo.storage_path);
      if (!url) throw new Error("Falta la dirección de una foto");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`No se ha podido bajar una foto (${response.status})`);
      const ext = photo.storage_path.split(".").pop() ?? "jpg";
      const name = safe(
        [String(i + 1).padStart(2, "0"), (photo.place_id && placeName.get(photo.place_id)) || "Foto"].join(" "),
      );
      files[`${folder}/${name}.${ext}`] = [new Uint8Array(await response.arrayBuffer()), { level: 0 }];
      onProgress(++done, total);
    }
  }

  const data = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, (error, result) => (error ? reject(error) : resolve(result))),
  );
  return new Blob([data as BlobPart], { type: "application/zip" });
}
