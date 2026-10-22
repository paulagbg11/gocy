"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Images, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useProfile } from "@/components/profile/ProfileProvider";
import { usePhotoUrls, useTripPhotos, useUploadTripPhoto } from "@/lib/queries/trip-photos";
import { PhotoViewer } from "./PhotoViewer";
import type { TripPhoto } from "@/lib/supabase/types";

/** Orden del carrete: por cuándo se hizo, y si no se sabe, por cuándo se subió. */
export const photoTime = (p: TripPhoto) => Date.parse(p.taken_at ?? p.created_at);

/**
 * Fotos de un lugar dentro del panel de su parada: las de cualquier día en que
 * se haya pasado por ahí, y botones para hacer una o sacarla de la galería.
 */
export function StopPhotos({
  tripId,
  placeId,
  dayId,
}: {
  tripId: string;
  placeId: string;
  dayId: string | null;
}) {
  const { activeProfile } = useProfile();
  const { data: allPhotos = [], error } = useTripPhotos(tripId);
  const upload = useUploadTripPhoto();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const photos = useMemo(
    () => allPhotos.filter((p) => p.place_id === placeId).sort((a, b) => photoTime(a) - photoTime(b)),
    [allPhotos, placeId],
  );
  const { data: urls } = usePhotoUrls(photos.map((p) => p.thumb_path));

  // De una en una: subir diez fotos a la vez con mala cobertura acaba
  // fallando todas en vez de llegar unas cuantas.
  const handleFiles = async (input: HTMLInputElement) => {
    const files = [...(input.files ?? [])];
    input.value = "";
    if (files.length === 0) return;
    setFailed(0);
    setProgress({ done: 0, total: files.length });
    for (const [i, file] of files.entries()) {
      try {
        await upload.mutateAsync({
          tripId,
          placeId,
          dayId,
          file,
          createdBy: activeProfile?.id ?? null,
        });
      } catch {
        setFailed((n) => n + 1);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
  };

  const uploading = progress !== null;

  return (
    <div className="flex flex-col gap-2">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => {
            const url = urls?.get(photo.thumb_path);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => setOpenId(photo.id)}
                className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-surface-2"
                aria-label="Ver foto"
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
              </button>
            );
          })}
          {uploading &&
            Array.from({ length: progress.total - progress.done }, (_, i) => (
              <div
                key={`pending-${i}`}
                className="flex aspect-square items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-muted-foreground"
              >
                <Loader2 size={18} className="animate-spin" />
              </div>
            ))}
        </div>
      )}

      {/* capture abre directamente la cámara trasera; sin él, el móvil ofrece
          la galería. Son dos inputs porque un mismo input no puede hacer las dos. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.currentTarget)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.currentTarget)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
        >
          <Camera size={16} />
          Cámara
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => galleryRef.current?.click()}
          disabled={uploading}
        >
          <Images size={16} />
          Galería
        </Button>
      </div>

      {uploading && photos.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          Subiendo {progress.done + 1} de {progress.total}…
        </p>
      )}
      {failed > 0 && (
        <p className="text-xs text-danger">
          {failed === 1 ? "Una foto no se ha podido subir." : `${failed} fotos no se han podido subir.`}{" "}
          Prueba otra vez cuando tengas cobertura.
        </p>
      )}
      {error && (
        <p className="text-xs text-danger">
          No se pueden cargar las fotos. ¿Está ejecutada la migración 0018?
        </p>
      )}

      {openId && (
        <PhotoViewer photos={photos} startId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
