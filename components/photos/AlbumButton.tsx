"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, Frame, Images, Loader2, Star } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useTrip, useTripDays } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { signPhotoPaths, usePhotoUrls, useTripPhotos } from "@/lib/queries/trip-photos";
import { dayTitle, groupByDay, numberPlaces } from "@/lib/photos/album";
import { shareOrDownloadFile } from "@/lib/estravel/shareImage";
import { PhotoViewer } from "./PhotoViewer";
import type { Trip } from "@/lib/supabase/types";

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
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Álbum · ${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`}
      >
        {open && <Album tripId={tripId} />}
      </Sheet>
    </>
  );
}

const coverUrlOf = (trip: Trip) =>
  trip.cover_image_path
    ? createClient().storage.from("trip-covers").getPublicUrl(trip.cover_image_path).data.publicUrl
    : null;

const fileName = (trip: Trip, what: string, ext: string) =>
  `${trip.name.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "viaje"} - ${what}.${ext}`;

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

  // URL nuevas al generar: las de la caché pueden estar a punto de caducar.
  const signAll = () => signPhotoPaths(ordered.flatMap((p) => [p.storage_path, p.thumb_path]));

  const makePoster = async () => {
    if (!trip) throw new Error("Sin viaje");
    const [signed, { renderTripPoster }] = await Promise.all([signAll(), import("@/lib/photos/poster")]);
    const blob = await renderTripPoster({
      trip,
      days,
      places,
      photos: ordered,
      coverUrl: coverUrlOf(trip),
      photoUrl: (p, large) => signed.get(large ? p.storage_path : p.thumb_path),
    });
    return { blob, filename: fileName(trip, "póster", "jpg"), type: "image/jpeg" };
  };

  const makePdf = async () => {
    if (!trip) throw new Error("Sin viaje");
    const [signed, { pdf }, { AlbumPdfDocument }] = await Promise.all([
      signAll(),
      import("@react-pdf/renderer"),
      import("./pdf/AlbumPdfDocument"),
    ]);
    const blob = await pdf(
      <AlbumPdfDocument
        trip={trip}
        coverUrl={coverUrlOf(trip)}
        groups={groups}
        places={places}
        numbers={numberPlaces(ordered)}
        photoUrl={(p) => signed.get(p.storage_path)}
        photoCount={ordered.length}
      />,
    ).toBlob();
    return { blob, filename: fileName(trip, "álbum", "pdf"), type: "application/pdf" };
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <ExportCard
          icon={<Frame size={18} />}
          title="Póster para enmarcar"
          description="Una imagen con la portada del viaje, el mapa del recorrido y las fotos colgadas de un hilo, día a día."
          generate={makePoster}
          preview
        />
        <ExportCard
          icon={<BookOpen size={18} />}
          title="Álbum en PDF"
          description="Portada con el índice y una página por día, con las fotos grandes y el nombre de cada sitio."
          generate={makePdf}
        />
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

type Status =
  | { step: "idle" }
  | { step: "working" }
  | { step: "ready"; blob: Blob; filename: string; type: string; previewUrl: string | null }
  | { step: "error" };

/**
 * Generar y guardar son dos toques, como en la guía en PDF: iOS solo abre el
 * menú de compartir justo después de tocar algo, y generar tarda unos segundos.
 */
function ExportCard({
  icon,
  title,
  description,
  generate,
  preview,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  generate: () => Promise<{ blob: Blob; filename: string; type: string }>;
  /** Enseña la imagen generada antes de guardarla. */
  preview?: boolean;
}) {
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const previewUrl = status.step === "ready" ? status.previewUrl : null;
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const run = async () => {
    setStatus({ step: "working" });
    try {
      const result = await generate();
      setStatus({
        step: "ready",
        ...result,
        previewUrl: preview ? URL.createObjectURL(result.blob) : null,
      });
    } catch (err) {
      console.error(err);
      setStatus({ step: "error" });
    }
  };

  const save = async () => {
    if (status.step !== "ready") return;
    const result = await shareOrDownloadFile(status.blob, status.filename, status.type);
    if (result === "failed") setStatus({ step: "error" });
  };

  const sizeKb = status.step === "ready" ? Math.round(status.blob.size / 1024) : 0;

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- blob local recién generado
        <img src={previewUrl} alt="Vista previa del póster" className="mt-3 w-full rounded-[var(--radius-sm)] border border-border" />
      )}

      <div className="mt-3">
        {status.step === "idle" && (
          <Button size="sm" variant="secondary" className="w-full" onClick={run}>
            Generar
          </Button>
        )}
        {status.step === "working" && (
          <Button size="sm" variant="secondary" className="w-full" disabled>
            <Loader2 size={16} className="animate-spin" /> Preparando…
          </Button>
        )}
        {status.step === "ready" && (
          <>
            <Button size="sm" className="w-full" onClick={save}>
              <Download size={16} /> Guardar o compartir
            </Button>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              {sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`} ·{" "}
              <button type="button" className="underline" onClick={run}>
                volver a generar
              </button>
            </p>
          </>
        )}
        {status.step === "error" && (
          <>
            <p className="mb-2 text-xs text-danger">No se ha podido generar. Prueba otra vez con buena conexión.</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={run}>
              Reintentar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
