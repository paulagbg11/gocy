"use client";

import { useEffect, useMemo, useState } from "react";
import { Images, LocateFixed, Loader2 } from "lucide-react";
import clsx from "clsx";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { useTripDays } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { usePlaceDayLinks } from "@/lib/queries/place-day-links";
import { useCategoriesById } from "@/lib/queries/categories";
import { useTripPhotos } from "@/lib/queries/trip-photos";
import { sortItinerary } from "@/lib/days/itinerary";
import { formatNearby, isZoneAnchor } from "@/lib/days/nearby";
import { categoryTones, FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import { formatShortDate } from "@/lib/dates";
import { distanceMeters, type LatLng } from "@/lib/geo";
import { photoDays, todayLocal } from "@/lib/photos/days";
import { AnalogCamera } from "./AnalogCamera";
import { PlacePhotos } from "./PlacePhotos";
import type { TripDay } from "@/lib/supabase/types";

/** Más cerca que esto ya se está en el sitio. */
const HERE_M = 60;

/**
 * La cámara de la cabecera del viaje. Solo sale desde el primer día: a un día
 * que aún no ha llegado no se le pueden poner fotos.
 */
export function TripCameraButton({ tripId }: { tripId: string }) {
  const { data: days = [] } = useTripDays(tripId);
  const allowed = useMemo(() => photoDays(days), [days]);
  const [open, setOpen] = useState(false);

  if (allowed.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Añadir fotos"
        className="-my-2 shrink-0 drop-shadow-sm transition-transform duration-150 ease-out active:scale-90"
      >
        <AnalogCamera size={60} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Añadir fotos">
        {open && <AddPhotoForm tripId={tripId} days={allowed} />}
      </Sheet>
    </>
  );
}

function AddPhotoForm({ tripId, days }: { tripId: string; days: TripDay[] }) {
  const today = todayLocal();
  // Durante el viaje, hoy; acabado, el último día.
  const [dayId, setDayId] = useState(() => (days.find((d) => d.date === today) ?? days[days.length - 1]).id);
  const day = days.find((d) => d.id === dayId) ?? days[days.length - 1];
  const isToday = day.date === today;

  const { data: places = [] } = usePlaces(tripId);
  const { data: links = [] } = usePlaceDayLinks(tripId);
  const categoriesById = useCategoriesById();
  const { data: photos = [] } = useTripPhotos(tripId);
  // Dónde se está solo importa para hoy: en un día pasado ya no se está ahí.
  const location = useCurrentPosition(isToday);

  // Los lugares del día, sin estaciones, aeropuertos ni el hotel: están en el
  // día por logística, no son sitios que se visiten. Hoy, del más cercano al
  // más lejano; otro día, en el orden del itinerario.
  const pins = useMemo(() => {
    const byId = new Map(places.map((p) => [p.id, p]));
    const entries = links
      .filter((l) => l.day_id === day.id)
      .flatMap((link) => {
        const place = byId.get(link.place_id);
        return place ? [{ link, place }] : [];
      });
    const seen = new Set<string>();
    const list = sortItinerary(entries).flatMap(({ place }) => {
      if (seen.has(place.id) || !isZoneAnchor(categoriesById.get(place.category_id))) return [];
      seen.add(place.id);
      const meters = location.coords ? distanceMeters(location.coords, place) : null;
      return [{ place, meters }];
    });
    if (location.coords) list.sort((a, b) => a.meters! - b.meters!);
    return list;
  }, [places, links, day.id, categoriesById, location.coords]);

  const photoCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of photos) if (p.place_id) counts.set(p.place_id, (counts.get(p.place_id) ?? 0) + 1);
    return counts;
  }, [photos]);

  // Por defecto el primero de la lista, que hoy es el más cercano. Si se
  // cambia de día y el elegido no está en él, se vuelve al primero.
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selected = pins.find((p) => p.place.id === chosenId) ?? pins[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {days.length > 1 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
          {[...days].reverse().map((d) => (
            <Chip key={d.id} active={d.id === day.id} onClick={() => setDayId(d.id)}>
              {d.date === today ? "Hoy" : `Día ${d.day_index}`} · {formatShortDate(d.date)}
            </Chip>
          ))}
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {!isToday ? (
            "Lugares del día, en el orden del itinerario."
          ) : location.status === "locating" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Buscando dónde estás…
            </>
          ) : location.status === "ok" ? (
            <>
              <LocateFixed size={12} /> Los más cercanos a ti, primero.
            </>
          ) : (
            "Sin ubicación: en el orden del itinerario."
          )}
        </p>

        {pins.length === 0 ? (
          <p className="rounded-[var(--radius-sm)] bg-surface-2 px-3 py-3 text-sm text-muted-foreground">
            Este día no tiene lugares a los que añadir fotos. Las estaciones y el alojamiento no
            cuentan.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Lugar de la foto">
            {pins.map(({ place, meters }) => {
              const category = categoriesById.get(place.category_id);
              const tones = categoryTones(category?.color ?? FALLBACK_CATEGORY_COLOR);
              const active = place.id === selected?.place.id;
              const count = photoCount.get(place.id) ?? 0;
              return (
                <button
                  key={place.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChosenId(place.id)}
                  className={clsx(
                    "flex items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors duration-150",
                    active ? "border-accent bg-accent/10" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-base"
                    style={{ background: tones.fill, borderColor: tones.edge }}
                  >
                    {category?.emoji ?? FALLBACK_CATEGORY_EMOJI}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{place.name}</span>
                    {meters !== null && (
                      <span className="block text-xs text-muted-foreground">
                        {meters < HERE_M ? "Estás aquí" : formatNearby(meters)}
                      </span>
                    )}
                  </span>
                  {count > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Images size={13} />
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div>
          <p className="mb-2 truncate text-sm font-medium text-muted-foreground">
            Fotos de {selected.place.name}
          </p>
          <PlacePhotos
            key={selected.place.id}
            tripId={tripId}
            placeId={selected.place.id}
            dayId={day.id}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Una sola lectura de la ubicación al abrir, sin seguirla: para ordenar los
 * lugares basta, y no gasta batería mientras se hacen fotos.
 */
function useCurrentPosition(enabled: boolean) {
  const [result, setResult] = useState<{ coords: LatLng | null; failed: boolean }>({
    coords: null,
    failed: false,
  });

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      queueMicrotask(() => setResult({ coords: null, failed: true }));
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (p) => !cancelled && setResult({ coords: { lat: p.coords.latitude, lng: p.coords.longitude }, failed: false }),
      () => !cancelled && setResult({ coords: null, failed: true }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled) return { status: "off" as const, coords: null };
  if (result.coords) return { status: "ok" as const, coords: result.coords };
  return { status: result.failed ? ("error" as const) : ("locating" as const), coords: null };
}
