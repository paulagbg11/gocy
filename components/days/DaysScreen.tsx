"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useTripDays, useSetDayCompleted } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { usePlaceDayLinks, useAssignPlaceToDay, nextOrderInDay } from "@/lib/queries/place-day-links";
import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import { useCategoriesById } from "@/lib/queries/categories";
import { DaySelector } from "./DaySelector";
import { DayMiniMap } from "./DayMiniMap";
import { TimelineView } from "./TimelineView";
import { AddPlaceToDaySheet } from "./AddPlaceToDaySheet";
import { PlaceDetailSheet } from "@/components/places/PlaceDetailSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import type { TripDay } from "@/lib/supabase/types";

export function DaysScreen({ tripId }: { tripId: string }) {
  const { data: days = [] } = useTripDays(tripId);
  const { data: places = [] } = usePlaces(tripId);
  const { data: links = [] } = usePlaceDayLinks(tripId);
  const assign = useAssignPlaceToDay();
  const setDayCompleted = useSetDayCompleted();
  const categoriesById = useCategoriesById();

  // undefined = todavía no se ha elegido nada explícitamente -> por defecto Día 1;
  // null = el usuario ha elegido explícitamente "Por decidir".
  const [selectedDayId, setSelectedDayId] = useState<string | null | undefined>(undefined);
  const [mode, setMode] = useState<"map" | "timeline">("map");
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Día por defecto (mientras no se elija otro a mano): el primero que quede
  // sin completar, para que al marcar el Día 1 la pantalla abra ya en el Día 2.
  // Si están todos completados, se queda en el último.
  const defaultDay = days.find((d) => !d.completed) ?? days[days.length - 1] ?? null;

  const showingUnassigned = selectedDayId === null || (selectedDayId === undefined && days.length === 0);
  const selectedDay = showingUnassigned
    ? null
    : (days.find((d) => d.id === selectedDayId) ?? defaultDay);

  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  const entriesForDay = useMemo(() => {
    if (!selectedDay) return [];
    return links
      .filter((l) => l.day_id === selectedDay.id)
      .map((link) => ({ link, place: placesById.get(link.place_id) }))
      .filter((e): e is { link: (typeof links)[number]; place: NonNullable<typeof e.place> } => !!e.place);
  }, [links, selectedDay, placesById]);

  const assignedPlaceIds = useMemo(() => new Set(links.map((l) => l.place_id)), [links]);
  const unassignedPlaces = places.filter((p) => !assignedPlaceIds.has(p.id));

  const openPlace = (placeId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("place", placeId);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const toggleCompleted = (day: TripDay) => {
    const completed = !day.completed;
    setDayCompleted.mutate({ dayId: day.id, tripId, completed });
    // Al dar por terminado el día que estás viendo, vuelve al modo automático
    // para que la pantalla salte sola al siguiente día pendiente.
    if (completed && selectedDay?.id === day.id) setSelectedDayId(undefined);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <DaySelector
        days={days}
        selectedDayId={showingUnassigned ? null : (selectedDay?.id ?? null)}
        onSelect={setSelectedDayId}
        onToggleCompleted={toggleCompleted}
        unassignedCount={unassignedPlaces.length}
      />

      {selectedDay ? (
        <>
          <div className="flex items-center justify-between px-4 pb-2">
            <SegmentedControl
              options={[
                { value: "map", label: "Mapa" },
                { value: "timeline", label: "Timeline" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <Button size="sm" variant="secondary" onClick={() => setAddSheetOpen(true)}>
              <Plus size={16} /> Añadir
            </Button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {mode === "map" ? (
              <DayMiniMap entries={entriesForDay} tripId={tripId} onOpenPlace={openPlace} />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto py-3">
                <TimelineView
                  entries={entriesForDay}
                  day={selectedDay}
                  tripId={tripId}
                  onOpenPlace={openPlace}
                />
              </div>
            )}
          </div>

          <AddPlaceToDaySheet
            open={addSheetOpen}
            onClose={() => setAddSheetOpen(false)}
            tripId={tripId}
            day={selectedDay}
            places={places}
            links={links}
          />
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-sm text-muted-foreground mb-3">
            Lugares guardados sin día asignado todavía.
          </p>
          <div className="flex flex-col gap-1.5">
            {unassignedPlaces.map((place) => {
              const category = categoriesById.get(place.category_id);
              const color = category?.color ?? FALLBACK_CATEGORY_COLOR;
              const emoji = category?.emoji ?? FALLBACK_CATEGORY_EMOJI;
              return (
                <div
                  key={place.id}
                  className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-surface px-3 py-2.5 shadow-[var(--shadow-sm)]"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: color }}
                  >
                    {emoji}
                  </span>
                  <button
                    onClick={() => openPlace(place.id)}
                    className="flex-1 truncate text-left text-sm font-medium"
                  >
                    {place.name}
                  </button>
                  {days.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const dayId = e.target.value;
                        if (!dayId) return;
                        assign.mutate({
                          trip_id: tripId,
                          place_id: place.id,
                          day_id: dayId,
                          order_in_day: nextOrderInDay(links, dayId),
                        });
                      }}
                      className="shrink-0 rounded-[var(--radius-sm)] border border-border bg-surface text-xs h-8 px-1.5"
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
                  )}
                </div>
              );
            })}
            {unassignedPlaces.length === 0 && (
              <p className="text-sm text-muted-foreground">Todo está organizado 🎉</p>
            )}
          </div>
        </div>
      )}

      <PlaceDetailSheet tripId={tripId} places={places} />
    </div>
  );
}
