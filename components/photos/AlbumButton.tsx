"use client";

import { useMemo, useState } from "react";
import { Download, Images, Loader2, Star } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useTrip, useTripDays } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { signPhotoPaths, usePhotoUrls, useTripPhotos } from "@/lib/queries/trip-photos";
import { buildAlbumZip, dayTitle, groupByDay } from "@/lib/photos/album";
import { PhotoViewer } from "./PhotoViewer";

/** Botón "Álbum" de Estravel: solo sale cuando ya hay alguna foto. */
export function AlbumButton({ tripId }: { tripId: string }) {
  const { data: photos = [] } = useTripPhotos(tripId);
  const [open, setOpen] = useState(false);
  if (photos.length === 0) return null;

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label="Álbum de fotos"
        className="shrink-0"
      >
        <Images size={16} />
        <span className="hidden sm:inline">Álbum</span>
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Álbum · ${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`}>
        {open && <Album tripId={tripId} />}
      </Sheet>
    </>
  );
}

function Album({ tripId }: { tripId: string }) {
  const { data: trip } = useTrip(tripId);
  const { data: days = [] } = useTripDays(tripId);
  const { data: places = [] } = usePlaces(tripId);
  const { data: photos = [] } = useTripPhotos(tripId);
  const groups = useMemo(() => groupByDay(photos, days), [photos, days]);
  // El visor pasa de un día al siguiente sin salir.
  const ordered = useMemo(() => groups.flatMap((g) => g.photos), [groups]);
  const { data: urls } = usePhotoUrls(ordered.map((p) => p.thumb_path));
  const placeName = useMemo(() => new Map(places.map((p) => [p.id, p.name])), [places]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    setProgress({ done: 0, total: ordered.length });
    try {
      // URL nuevas al pulsar: las de la caché pueden estar a punto de caducar
      // y la descarga de un álbum grande tarda.
      const signed = await signPhotoPaths(ordered.map((p) => p.storage_path));
      const blob = await buildAlbumZip({
        groups,
        places,
        urlFor: (path) => signed.get(path),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${(trip?.name ?? "Viaje").replace(/[\\/:*?"<>|]+/g, " ").trim()} - álbum.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    } catch {
      setError("No se ha podido preparar el álbum. Prueba otra vez con buena conexión.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button type="button" onClick={download} disabled={progress !== null} className="w-full">
          {progress ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {progress ? `Preparando ${progress.done} de ${progress.total}…` : "Descargar álbum"}
        </Button>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {error ?? "Un .zip con una carpeta por día y las fotos con el nombre del lugar."}
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.day?.id ?? "sin-dia"}>
          <h3 className="mb-2 text-sm font-semibold">{dayTitle(group.day)}</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {group.photos.map((photo) => {
              const url = urls?.get(photo.thumb_path);
              const name = photo.place_id ? placeName.get(photo.place_id) : undefined;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setOpenId(photo.id)}
                  className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-surface-2"
                  aria-label={name ? `Foto en ${name}` : "Ver foto"}
                >
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Supabase, sin optimizar
                    <img src={url} alt={photo.caption ?? ""} className="h-full w-full object-cover" />
                  )}
                  {photo.favorite && (
                    <span className="absolute right-1 top-1 rounded-full bg-black/45 p-1 text-white">
                      <Star size={11} fill="currentColor" />
                    </span>
                  )}
                  {name && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1.5 py-0.5 text-left text-[11px] text-white">
                      {name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {openId && <PhotoViewer photos={ordered} startId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
