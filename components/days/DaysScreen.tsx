"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useTripDays, useSetDayCompleted } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { usePlaceDayLinks } from "@/lib/queries/place-day-links";
import { DaySelector } from "./DaySelector";
import { DayItinerary } from "./DayItinerary";
import { AddPlaceToDaySheet } from "./AddPlaceToDaySheet";
import { UnassignedPlaces } from "./UnassignedPlaces";
import { ExportTripPdf } from "./ExportTripPdf";
import { PlaceDetailSheet } from "@/components/places/PlaceDetailSheet";
import { Button } from "@/components/ui/Button";
import type { TripDay } from "@/lib/supabase/types";

export function DaysScreen({ tripId }: { tripId: string }) {
  const { data: days = [] } = useTripDays(tripId);
  const { data: places = [] } = usePlaces(tripId);
  const { data: links = [] } = usePlaceDayLinks(tripId);
  const setDayCompleted = useSetDayCompleted();

  // undefined = todavía no se ha elegido nada explícitamente -> por defecto Día 1;
  // null = el usuario ha elegido explícitamente "Por decidir".
  const [selectedDayId, setSelectedDayId] = useState<string | null | undefined>(undefined);
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
            <p className="text-sm text-muted-foreground">
              {entriesForDay.length === 1 ? "1 parada" : `${entriesForDay.length} paradas`}
            </p>
            <div className="flex gap-2">
              <ExportTripPdf tripId={tripId} />
              <Button size="sm" variant="secondary" onClick={() => setAddSheetOpen(true)}>
                <Plus size={16} /> Añadir
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <DayItinerary
              entries={entriesForDay}
              day={selectedDay}
              tripId={tripId}
              onOpenPlace={openPlace}
            />
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
        <UnassignedPlaces
          tripId={tripId}
          places={places}
          unassigned={unassignedPlaces}
          days={days}
          links={links}
          onOpenPlace={openPlace}
        />
      )}

      <PlaceDetailSheet tripId={tripId} places={places} />
    </div>
  );
}
