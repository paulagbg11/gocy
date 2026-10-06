"use client";

import { useMemo } from "react";
import { CalendarPlus, Star } from "lucide-react";
import clsx from "clsx";
import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI, categoryTones } from "@/lib/categories";
import { useCategoriesById } from "@/lib/queries/categories";
import { useUpdatePlace } from "@/lib/queries/places";
import { nextOrderInDay, useAssignPlaceToDay } from "@/lib/queries/place-day-links";
import { ESSENTIAL_MIGRATION_HINT, byName, isMissingEssentialColumn } from "@/lib/places";
import { ExportTripPdf } from "./ExportTripPdf";
import type { Category, Place, PlaceDayLink, TripDay } from "@/lib/supabase/types";

/**
 * "Por decidir": lo que está guardado y todavía no tiene día. Pensado para
 * ver de un vistazo cuánto falta por repartir: arriba el avance y lo
 * imprescindible, y debajo el resto por categorías, en orden alfabético.
 */
export function UnassignedPlaces({
  tripId,
  places,
  unassigned,
  days,
  links,
  onOpenPlace,
}: {
  tripId: string;
  /** Todos los lugares del viaje, para el avance. */
  places: Place[];
  unassigned: Place[];
  days: TripDay[];
  links: PlaceDayLink[];
  onOpenPlace: (placeId: string) => void;
}) {
  const categoriesById = useCategoriesById();
  const assign = useAssignPlaceToDay();
  const updatePlace = useUpdatePlace();

  const essentials = useMemo(() => unassigned.filter((p) => p.essential).sort(byName), [unassigned]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, Place[]>();
    for (const place of unassigned) {
      if (place.essential) continue;
      byCategory.set(place.category_id, [...(byCategory.get(place.category_id) ?? []), place]);
    }
    return [...byCategory.entries()]
      .map(([categoryId, list]) => ({
        id: categoryId,
        category: categoriesById.get(categoryId),
        places: list.sort(byName),
      }))
      .sort((a, b) => (a.category?.sort_order ?? 999) - (b.category?.sort_order ?? 999));
  }, [unassigned, categoriesById]);

  const assignedCount = places.length - unassigned.length;
  const progress = places.length > 0 ? assignedCount / places.length : 0;

  const assignTo = (place: Place, dayId: string) =>
    assign.mutate({
      trip_id: tripId,
      place_id: place.id,
      day_id: dayId,
      order_in_day: nextOrderInDay(links, dayId),
    });

  const toggleEssential = (place: Place) =>
    updatePlace.mutate(
      { id: place.id, trip_id: tripId, essential: !place.essential },
      {
        onError: (err) =>
          alert(isMissingEssentialColumn(err) ? ESSENTIAL_MIGRATION_HINT : "No se ha podido guardar."),
      },
    );

  const row = (place: Place) => (
    <PlaceRow
      key={place.id}
      place={place}
      category={categoriesById.get(place.category_id)}
      days={days}
      onOpen={() => onOpenPlace(place.id)}
      onAssign={(dayId) => assignTo(place, dayId)}
      onToggleEssential={() => toggleEssential(place)}
    />
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-1 pb-4">
      <div className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold leading-none tabular-nums">{unassigned.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {unassigned.length === 1 ? "lugar sin día" : "lugares sin día"}
              {essentials.length > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {essentials.length === 1 ? "1 imprescindible" : `${essentials.length} imprescindibles`}
                  </span>
                </>
              )}
            </p>
          </div>
          <ExportTripPdf tripId={tripId} />
        </div>
        {places.length > 0 && (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {assignedCount} de {places.length} guardados ya tienen día
            </p>
          </>
        )}
      </div>

      {unassigned.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Todo está organizado 🎉</p>
      )}

      {essentials.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 dark:text-amber-300">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            Imprescindibles sin día
          </h2>
          <ul className="divide-y divide-border rounded-[var(--radius-md)] bg-amber-400/10 px-3">
            {essentials.map(row)}
          </ul>
        </section>
      )}

      {groups.map(({ id, category, places: list }) => (
        <section key={id} className="mt-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: categoryTones(category?.color ?? FALLBACK_CATEGORY_COLOR).edge }}
            />
            {category?.name ?? "Sin categoría"}
            <span className="font-normal tabular-nums">· {list.length}</span>
          </h2>
          <ul className="divide-y divide-border">{list.map(row)}</ul>
        </section>
      ))}
    </div>
  );
}

function PlaceRow({
  place,
  category,
  days,
  onOpen,
  onAssign,
  onToggleEssential,
}: {
  place: Place;
  category: Category | undefined;
  days: TripDay[];
  onOpen: () => void;
  onAssign: (dayId: string) => void;
  onToggleEssential: () => void;
}) {
  const color = category?.color ?? FALLBACK_CATEGORY_COLOR;
  return (
    <li className="flex items-center gap-2.5 py-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]"
        style={{ background: categoryTones(color).fill }}
      >
        {category?.emoji ?? FALLBACK_CATEGORY_EMOJI}
      </span>
      <button onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[15px] font-medium">
        {place.name}
      </button>
      <button
        onClick={onToggleEssential}
        aria-pressed={!!place.essential}
        aria-label={place.essential ? "Quitar de imprescindibles" : "Marcar como imprescindible"}
        className="flex h-8 w-8 shrink-0 items-center justify-center"
      >
        <Star
          size={18}
          className={clsx(
            place.essential ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50",
          )}
        />
      </button>
      {days.length > 0 && (
        // El desplegable nativo, invisible encima del botón: en el móvil abre
        // la rueda del sistema, que es más cómoda que una lista propia.
        <span className="relative flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2.5 text-[13px] font-medium text-accent">
          <CalendarPlus size={14} />
          Día
          <select
            value=""
            aria-label={`Asignar ${place.name} a un día`}
            onChange={(e) => e.target.value && onAssign(e.target.value)}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          >
            <option value="" disabled>
              Asignar a…
            </option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                Día {d.day_index}
              </option>
            ))}
          </select>
        </span>
      )}
    </li>
  );
}
