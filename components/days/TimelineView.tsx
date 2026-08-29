"use client";

import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import { useCategoriesById } from "@/lib/queries/categories";
import { useUpdatePlaceDayLink, useUnassignPlaceFromDay } from "@/lib/queries/place-day-links";
import { X } from "lucide-react";
import type { Place, PlaceDayLink, TripDay } from "@/lib/supabase/types";

interface TimelineEntry {
  link: PlaceDayLink;
  place: Place;
}

/** "HH:mm" en hora local, para el value de un <input type="time">. */
function toLocalTimeValue(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function TimelineView({
  entries,
  day,
  tripId,
  onOpenPlace,
}: {
  entries: TimelineEntry[];
  day: TripDay;
  tripId: string;
  onOpenPlace: (placeId: string) => void;
}) {
  const updateLink = useUpdatePlaceDayLink();
  const unassign = useUnassignPlaceFromDay();
  const categoriesById = useCategoriesById();

  const sorted = [...entries].sort((a, b) => {
    if (a.link.scheduled_at && b.link.scheduled_at) return a.link.scheduled_at.localeCompare(b.link.scheduled_at);
    if (a.link.scheduled_at) return -1;
    if (b.link.scheduled_at) return 1;
    return (a.link.order_in_day ?? 0) - (b.link.order_in_day ?? 0);
  });

  const setTime = (link: PlaceDayLink, timeValue: string) => {
    if (!timeValue) {
      updateLink.mutate({ id: link.id, trip_id: tripId, scheduled_at: null });
      return;
    }
    const iso = `${day.date}T${timeValue}:00`;
    updateLink.mutate({ id: link.id, trip_id: tripId, scheduled_at: new Date(iso).toISOString() });
  };

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground px-4">Nada asignado a este día todavía.</p>;
  }

  return (
    <div className="flex flex-col gap-2 px-4">
      {sorted.map(({ link, place }) => {
        const category = categoriesById.get(place.category_id);
        const color = category?.color ?? FALLBACK_CATEGORY_COLOR;
        const emoji = category?.emoji ?? FALLBACK_CATEGORY_EMOJI;
        // Hora local, NO toISOString(): setTime guarda convirtiendo de local a
        // UTC, así que hay que deshacer esa conversión al leer o la hora que
        // escribes se muestra desplazada (14:00 -> 12:00 en horario de verano
        // peninsular). DayPlaceRow ya usa hora local, así que además las dos
        // vistas del mismo día se contradecían.
        const timeValue = link.scheduled_at ? toLocalTimeValue(link.scheduled_at) : "";
        return (
          <div
            key={link.id}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-surface px-3 py-2.5 shadow-[var(--shadow-sm)]"
          >
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTime(link, e.target.value)}
              className="w-[4.5rem] shrink-0 bg-transparent text-sm font-medium tabular-nums outline-none border-b border-dashed border-border focus:border-accent"
            />
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: color }}
            >
              {emoji}
            </span>
            <button
              onClick={() => onOpenPlace(place.id)}
              className="flex-1 truncate text-left text-sm font-medium"
            >
              {place.name}
            </button>
            <button
              onClick={() => unassign.mutate({ id: link.id, trip_id: tripId })}
              aria-label="Quitar del día"
              className="shrink-0 text-muted-foreground hover:text-danger p-1"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
