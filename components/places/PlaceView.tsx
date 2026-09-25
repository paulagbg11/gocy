"use client";

import { ExternalLink, MapPin, Pencil } from "lucide-react";
import { googleMapsUrl } from "@/lib/google-place";
import { usePlacePhotos } from "@/lib/place-photos";
import { useCategoriesById } from "@/lib/queries/categories";
import { FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import { Button } from "@/components/ui/Button";
import type { Place } from "@/lib/supabase/types";

/**
 * Lo que se ve al pulsar un pin: fotos, datos y el salto a Google Maps.
 * Editar queda como opción, no como lo primero que aparece.
 */
export function PlaceView({ place, onEdit }: { place: Place; onEdit: () => void }) {
  const { data, isLoading } = usePlacePhotos(place);
  const category = useCategoriesById().get(place.category_id);
  const photos = data?.photos ?? [];

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="flex gap-2 -mx-5 px-5 overflow-hidden">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 w-60 shrink-0 rounded-[var(--radius-md)] bg-surface-2 animate-pulse" />
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2 -mx-5 px-5 overflow-x-auto snap-x snap-mandatory scroll-px-5 [scrollbar-width:none]">
            {photos.map((photo, i) => (
              <a
                key={photo.url}
                href={photo.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="relative h-40 w-60 shrink-0 snap-start overflow-hidden rounded-[var(--radius-md)] bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen externa, sin optimizar */}
                <img
                  src={photo.url}
                  alt={`${place.name}, foto ${i + 1}`}
                  loading={i < 2 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
                {/* Las fotos de Commons piden citar al autor. */}
                {photo.author && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4 text-[10px] text-white/90">
                    {photo.author}
                  </span>
                )}
              </a>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data?.nearbyOnly ? "Fotos de los alrededores" : "Fotos"} · Wikimedia Commons
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">
          {category?.emoji ?? FALLBACK_CATEGORY_EMOJI} {category?.name ?? "Sin categoría"}
        </p>
        {place.address && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {place.address}
          </p>
        )}
      </div>

      {place.notes && (
        <p className="whitespace-pre-line rounded-[var(--radius-md)] bg-surface-2 px-3.5 py-3 text-sm">
          {place.notes}
        </p>
      )}

      <div className="flex gap-2 mt-1">
        <a
          href={googleMapsUrl(place)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 inline-flex h-13 whitespace-nowrap items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-accent px-5 text-base font-medium text-accent-foreground hover:bg-accent-hover transition-colors duration-150 ease-out"
        >
          <ExternalLink size={18} />
          Google Maps
        </a>
        <Button variant="secondary" size="lg" onClick={onEdit} aria-label="Editar lugar">
          <Pencil size={18} />
          Editar
        </Button>
      </div>
    </div>
  );
}
