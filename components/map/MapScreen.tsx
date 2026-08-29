"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Map } from "@vis.gl/react-google-maps";
import { usePlaces } from "@/lib/queries/places";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories";
import { MapProvider } from "./MapProvider";
import { CategoryPin } from "./CategoryPin";
import { FitBounds } from "./FitBounds";
import { MapResizeFix } from "./MapResizeFix";
import { PlaceSearchBox, type SelectedPlace } from "./PlaceSearchBox";
import { PlaceDetailSheet } from "@/components/places/PlaceDetailSheet";
import { PlaceForm } from "@/components/places/PlaceForm";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import type { PlaceCategory } from "@/lib/supabase/types";

// Centro por defecto (Madrid) mientras no hay pines o no se ha resuelto la ubicación.
const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };

export function MapScreen({ tripId }: { tripId: string }) {
  const { data: places = [] } = usePlaces(tripId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeCategories, setActiveCategories] = useState<Set<PlaceCategory>>(
    new Set(CATEGORY_ORDER),
  );
  const [pendingPlace, setPendingPlace] = useState<SelectedPlace | null>(null);

  const filtered = useMemo(
    () => places.filter((p) => activeCategories.has(p.category)),
    [places, activeCategories],
  );

  const toggleCategory = (cat: PlaceCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
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
          <FitBounds points={filtered.map((p) => ({ lat: p.lat, lng: p.lng }))} />
          {filtered.map((place) => (
            <CategoryPin key={place.id} place={place} onClick={() => openPlace(place.id)} />
          ))}
        </Map>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
          <div className="pointer-events-auto rounded-[var(--radius-md)] bg-surface shadow-[var(--shadow-md)] p-1.5">
            <PlaceSearchBox onSelect={setPendingPlace} />
          </div>
          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {CATEGORY_ORDER.map((cat) => (
              <Chip
                key={cat}
                active={activeCategories.has(cat)}
                color={CATEGORY_META[cat].color}
                onClick={() => toggleCategory(cat)}
              >
                {CATEGORY_META[cat].label}
              </Chip>
            ))}
          </div>
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
