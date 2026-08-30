"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Map } from "@vis.gl/react-google-maps";
import { usePlaces } from "@/lib/queries/places";
import { useTrip } from "@/lib/queries/trips";
import { useVisibleCategories } from "@/lib/queries/categories";
import { MapProvider } from "./MapProvider";
import { CategoryPin } from "./CategoryPin";
import { FitBounds } from "./FitBounds";
import { MapResizeFix } from "./MapResizeFix";
import { DestinationCenter } from "./DestinationCenter";
import { PlaceSearchBox, type SelectedPlace } from "./PlaceSearchBox";
import { LiveLocationMarker } from "./LiveLocationMarker";
import { LocationPrompt } from "./LocationPrompt";
import { PlaceDetailSheet } from "@/components/places/PlaceDetailSheet";
import { PlaceForm } from "@/components/places/PlaceForm";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { useGeolocationPermission } from "@/lib/tracking/useGeolocationPermission";
import { isTripActive, useTrackingPreference } from "@/lib/tracking/useTripTracking";

// Centro por defecto (Madrid) mientras no hay pines o no se ha resuelto la ubicación.
const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };

export function MapScreen({ tripId }: { tripId: string }) {
  const { data: places = [] } = usePlaces(tripId);
  const { data: trip } = useTrip(tripId);
  const visibleCategories = useVisibleCategories(tripId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [pendingPlace, setPendingPlace] = useState<SelectedPlace | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);

  // El punto en vivo solo tiene sentido durante los días del viaje: fuera de
  // esas fechas el mapa se comporta como siempre.
  const { permission, request } = useGeolocationPermission();
  const { enabled: trackingEnabled } = useTrackingPreference(tripId);
  const tripActive = isTripActive(trip) && trackingEnabled;
  const showLiveLocation = tripActive && permission === "granted";

  // `Map` aquí es el componente de @vis.gl/react-google-maps (importado más
  // arriba), así que usamos globalThis.Map para el Map de JS.
  const categoriesById = useMemo(
    () => new globalThis.Map(visibleCategories.map((c) => [c.id, c] as const)),
    [visibleCategories],
  );

  const filtered = useMemo(
    () => places.filter((p) => categoriesById.has(p.category_id) && !deselected.has(p.category_id)),
    [places, categoriesById, deselected],
  );

  const toggleCategory = (categoryId: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const openPlace = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("place", id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <MapProvider>
        <Map
          className="flex-1 min-h-0 w-full"
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
        >
          <MapResizeFix />
          {showLiveLocation && <LiveLocationMarker />}
          <DestinationCenter destination={trip?.destination} hasPlaces={places.length > 0} />
          <FitBounds points={filtered.map((p) => ({ lat: p.lat, lng: p.lng }))} />
          {filtered.map((place) => (
            <CategoryPin
              key={place.id}
              place={place}
              category={categoriesById.get(place.category_id)}
              onClick={() => openPlace(place.id)}
            />
          ))}
        </Map>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
          <div className="pointer-events-auto rounded-[var(--radius-md)] bg-surface shadow-[var(--shadow-md)] p-1.5">
            <PlaceSearchBox onSelect={setPendingPlace} />
          </div>
          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {visibleCategories.map((cat) => (
              <Chip
                key={cat.id}
                active={!deselected.has(cat.id)}
                color={cat.color}
                onClick={() => toggleCategory(cat.id)}
              >
                {cat.emoji} {cat.name}
              </Chip>
            ))}
          </div>

          {tripActive && !promptDismissed && permission !== "granted" && (
            <LocationPrompt
              permission={permission}
              onRequest={request}
              onDismiss={() => setPromptDismissed(true)}
            />
          )}
        </div>

        <PlaceDetailSheet tripId={tripId} places={places} />
      </MapProvider>

      <Sheet open={!!pendingPlace} onClose={() => setPendingPlace(null)} title="Nuevo lugar">
        {pendingPlace && (
          <PlaceForm tripId={tripId} fromSearch={pendingPlace} onDone={() => setPendingPlace(null)} />
        )}
      </Sheet>
    </div>
  );
}
