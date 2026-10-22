"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Star, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { useProfile } from "@/components/profile/ProfileProvider";
import { useDeleteTripPhoto, usePhotoUrls, useUpdateTripPhoto } from "@/lib/queries/trip-photos";
import type { TripPhoto } from "@/lib/supabase/types";

const takenFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Una foto a pantalla completa, con las de su lugar a los lados. */
export function PhotoViewer({
  photos,
  startId,
  onClose,
}: {
  photos: TripPhoto[];
  startId: string;
  onClose: () => void;
}) {
  const [currentId, setCurrentId] = useState(startId);
  const index = photos.findIndex((p) => p.id === currentId);
  const photo = index >= 0 ? photos[index] : null;
  const { profiles } = useProfile();
  const update = useUpdateTripPhoto();
  const remove = useDeleteTripPhoto();
  // Se enseña la miniatura mientras se descarga la grande.
  const { data: urls } = usePhotoUrls(photo ? [photo.storage_path, photo.thumb_path] : []);
  const [loadedPath, setLoadedPath] = useState<string | null>(null);

  const go = (step: number) => {
    const next = photos[index + step];
    if (next) setCurrentId(next.id);
  };

  // Si la borran (aquí o desde el otro móvil), se cierra.
  useEffect(() => {
    if (!photo) onClose();
  }, [photo, onClose]);

  // En captura y parando la propagación: si no, el Escape cerraría también
  // el panel de la parada que hay debajo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else return;
      e.stopImmediatePropagation();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  if (!photo) return null;

  const full = urls?.get(photo.storage_path);
  const thumb = urls?.get(photo.thumb_path);
  const author = profiles.find((p) => p.id === photo.created_by)?.name;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <IconButton label="Cerrar" onClick={onClose}>
          <X size={22} />
        </IconButton>
        <span className="flex-1 text-center text-sm text-white/70">
          {index + 1} de {photos.length}
        </span>
        <IconButton
          label={photo.favorite ? "Quitar de favoritas" : "Marcar como favorita"}
          onClick={() => update.mutate({ id: photo.id, trip_id: photo.trip_id, favorite: !photo.favorite })}
        >
          <Star size={22} fill={photo.favorite ? "currentColor" : "none"} className={clsx(photo.favorite && "text-amber-300")} />
        </IconButton>
        <IconButton
          label="Borrar foto"
          onClick={() => {
            if (confirm("¿Borrar esta foto? No se puede recuperar.")) remove.mutate(photo);
          }}
        >
          <Trash2 size={20} />
        </IconButton>
      </div>

      <div className="relative min-h-0 flex-1">
        {(full ?? thumb) && (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Supabase, sin optimizar
          <img
            key={photo.id}
            src={loadedPath === photo.storage_path && full ? full : (thumb ?? full)}
            alt={photo.caption ?? ""}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
        {/* Precarga de la grande: se cambia cuando ya está, sin parpadeo. */}
        {full && loadedPath !== photo.storage_path && (
          // eslint-disable-next-line @next/next/no-img-element -- solo precarga
          <img src={full} alt="" className="hidden" onLoad={() => setLoadedPath(photo.storage_path)} />
        )}
        {index > 0 && (
          <SideButton side="left" onClick={() => go(-1)}>
            <ChevronLeft size={26} />
          </SideButton>
        )}
        {index < photos.length - 1 && (
          <SideButton side="right" onClick={() => go(1)}>
            <ChevronRight size={26} />
          </SideButton>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <CaptionInput key={photo.id} photo={photo} />
        <p className="text-xs text-white/60">
          {photo.taken_at ? takenFormat.format(new Date(photo.taken_at)) : "Sin fecha"}
          {author && ` · ${author}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}

/** Se guarda al salir del campo, no a cada letra. */
function CaptionInput({ photo }: { photo: TripPhoto }) {
  const update = useUpdateTripPhoto();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const save = () => {
    const value = caption.trim() || null;
    if (value !== photo.caption) update.mutate({ id: photo.id, trip_id: photo.trip_id, caption: value });
  };
  return (
    <input
      value={caption}
      onChange={(e) => setCaption(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder="Escribe un pie de foto"
      className="h-10 w-full rounded-[var(--radius-sm)] bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/15"
    />
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function SideButton({
  side,
  onClick,
  children,
}: {
  side: "left" | "right";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Foto anterior" : "Foto siguiente"}
      className={clsx(
        "absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {children}
    </button>
  );
}
