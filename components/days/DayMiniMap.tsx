"use client";

import { Map } from "@vis.gl/react-google-maps";
import { MapProvider } from "@/components/map/MapProvider";
import { CategoryPin } from "@/components/map/CategoryPin";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { FitBounds } from "@/components/map/FitBounds";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { useCategoriesById } from "@/lib/queries/categories";
import { DayPlaceRow } from "./DayPlaceRow";
import { useUpdatePlaceDayLink, useUnassignPlaceFromDay } from "@/lib/queries/place-day-links";
import type { Place, PlaceDayLink } from "@/lib/supabase/types";

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };

interface Entry {
  link: PlaceDayLink;
  place: Place;
}

export function DayMiniMap({
  entries,
  tripId,
  onOpenPlace,
}: {
  entries: Entry[];
  tripId: string;
  onOpenPlace: (placeId: string) => void;
}) {
  const updateLink = useUpdatePlaceDayLink();
  const unassign = useUnassignPlaceFromDay();
  const categoriesById = useCategoriesById();
  const sorted = [...entries].sort(
    (a, b) => (a.link.order_in_day ?? 0) - (b.link.order_in_day ?? 0),
  );

  const swap = (i: number, j: number) => {
    const a = sorted[i];
    const b = sorted[j];
    if (!a || !b) return;
    const aOrder = a.link.order_in_day ?? i;
    const bOrder = b.link.order_in_day ?? j;
    updateLink.mutate({ id: a.link.id, trip_id: tripId, order_in_day: bOrder });
    updateLink.mutate({ id: b.link.id, trip_id: tripId, order_in_day: aOrder });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* El mapa ocupa ~60% del espacio disponible (antes era una franja fija
          de 192px) y la lista el resto, que además hace scroll si hace falta. */}
      <div className="flex-[3] min-h-[220px]">
        <MapProvider>
          <Map
            className="h-full w-full"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI
          >
            <MapResizeFix />
            <FitBounds points={sorted.map(({ place }) => ({ lat: place.lat, lng: place.lng }))} />
            <RoutePolyline path={sorted.map(({ place }) => ({ lat: place.lat, lng: place.lng }))} />
            {sorted.map(({ place }, i) => (
              <CategoryPin
                key={place.id}
                place={place}
                category={categoriesById.get(place.category_id)}
                order={i + 1}
                onClick={() => onOpenPlace(place.id)}
              />
            ))}
          </Map>
        </MapProvider>
      </div>

      <div className="flex-[2] min-h-0 overflow-y-auto flex flex-col gap-2 px-4 py-3">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada asignado a este día todavía.</p>
        )}
        {sorted.map(({ link, place }, i) => (
          <DayPlaceRow
            key={link.id}
            place={place}
            order={i + 1}
            scheduledAt={link.scheduled_at}
            onOpen={() => onOpenPlace(place.id)}
            onRemove={() => unassign.mutate({ id: link.id, trip_id: tripId })}
            onMoveUp={i > 0 ? () => swap(i, i - 1) : undefined}
            onMoveDown={i < sorted.length - 1 ? () => swap(i, i + 1) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
