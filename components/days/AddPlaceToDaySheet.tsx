"use client";

import { useMemo } from "react";
import { CATEGORY_META } from "@/lib/categories";
import { useAssignPlaceToDay, nextOrderInDay } from "@/lib/queries/place-day-links";
import { Sheet } from "@/components/ui/Sheet";
import type { Place, PlaceDayLink, TripDay } from "@/lib/supabase/types";

interface AddPlaceToDaySheetProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  day: TripDay;
  places: Place[];
  links: PlaceDayLink[];
}

export function AddPlaceToDaySheet({ open, onClose, tripId, day, places, links }: AddPlaceToDaySheetProps) {
  const assign = useAssignPlaceToDay();

  const linksByPlace = useMemo(() => {
    const map = new Map<string, PlaceDayLink[]>();
    for (const link of links) {
      map.set(link.place_id, [...(map.get(link.place_id) ?? []), link]);
    }
    return map;
  }, [links]);

  const handlePick = async (place: Place) => {
    const existingLinks = linksByPlace.get(place.id) ?? [];
    const alreadyThisDay = existingLinks.some((l) => l.day_id === day.id);
    if (alreadyThisDay) return onClose();

    if (existingLinks.length > 0) {
      const otherDaysCount = existingLinks.length;
      const proceed = confirm(
        `"${place.name}" ya está asignado a ${otherDaysCount === 1 ? "otro día" : `${otherDaysCount} días`}. ¿Seguro que quieres repetirlo también en el Día ${day.day_index}?`,
      );
      if (!proceed) return;
    }

    await assign.mutateAsync({
      trip_id: tripId,
      place_id: place.id,
      day_id: day.id,
      order_in_day: nextOrderInDay(links, day.id),
    });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Añadir al Día ${day.day_index}`}>
      {places.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay ningún lugar guardado. Añádelo primero desde la pestaña Mapa.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto">
          {places.map((place) => {
            const meta = CATEGORY_META[place.category];
            const Icon = meta.icon;
            const repeated = (linksByPlace.get(place.id)?.length ?? 0) > 0;
            return (
              <button
                key={place.id}
                onClick={() => handlePick(place)}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left hover:bg-surface-2 transition-colors duration-150 ease-out"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: meta.color }}
                >
                  <Icon size={16} className="text-white" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium">{place.name}</span>
                  {repeated && (
                    <span className="text-xs text-muted-foreground">Ya está en otro día — se repetiría</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
