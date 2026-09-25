"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Map } from "@vis.gl/react-google-maps";
import { usePlaces } from "@/lib/queries/places";
import { findExistingPlace } from "@/lib/places";
import { useTrip } from "@/lib/queries/trips";
import { useVisibleCategories } from "@/lib/queries/categories";
import { MapProvider } from "./MapProvider";
import { CategoryPin } from "./CategoryPin";
import { FitBounds } from "./FitBounds";
import { MapResizeFix } from "./MapResizeFix";
import { FocusPlace, type FocusTarget } from "./FocusPlace";
import { ZoomWatcher } from "./ZoomWatcher";
import { DestinationCenter } from "./DestinationCenter";
import { PlaceSearchBox, type SelectedPlace } from "./PlaceSearchBox";
import { LiveLocationMarker } from "./LiveLocationMarker";
import { LocationPrompt } from "./LocationPrompt";
import { PlaceDetailSheet } from "@/components/places/PlaceDetailSheet";
import { PlaceForm } from "@/components/places/PlaceForm";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useGeolocationPermission } from "@/lib/tracking/useGeolocationPermission";
import { isTripActive, useTrackingPreference } from "@/lib/tracking/useTripTracking";
import type { Place } from "@/lib/supabase/types";

// Centro por defecto (Madrid) mientras no hay pines o no se ha resuelto la ubicación.
const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };
const DEFAULT_ZOOM = 12;

/**
 * A partir de este zoom (unos pocos barrios a la vista) los pines llevan el nombre debajo.
 * Más alejado, con todo el viaje a la vista, los nombres se pisarían entre sí.
 */
const NAMES_MIN_ZOOM = 14;

/** Tiempo que el pin recién añadido (o buscado) se queda resaltado. */
const HIGHLIGHT_MS = 4000;

export function MapScreen({ tripId }: { tripId: string }) {
  const { data: places = [] } = usePlaces(tripId);
  const { data: trip } = useTrip(tripId);
  const visibleCategories = useVisibleCategories(tripId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [pendingPlace, setPendingPlace] = useState<SelectedPlace | null>(null);
  const [duplicate, setDuplicate] = useState<Place | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const showNames = zoom >= NAMES_MIN_ZOOM;

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

  /**
   * Buscar un sitio que ya está guardado no lo duplica: se avisa y se ofrece
   * ir al que ya existe. Antes se abría el formulario sin más y acababa
   * habiendo dos Big Ben.
   */
  const handleSearchSelect = (selected: SelectedPlace) => {
    const existing = findExistingPlace(places, selected);
    if (existing) setDuplicate(existing);
    else setPendingPlace(selected);
  };

  /**
   * Lleva el mapa hasta un lugar y lo resalta (más grande y por encima de los
   * demás) un momento, para ubicarlo al añadirlo en vez de ir a ciegas. Si su
   * categoría estaba filtrada, se vuelve a mostrar: si no, no habría pin.
   */
  const focusPlace = (place: Place, aboveSheet = false) => {
    setDeselected((prev) => {
      if (!prev.has(place.category_id)) return prev;
      const next = new Set(prev);
      next.delete(place.category_id);
      return next;
    });
    setFocus({ lat: place.lat, lng: place.lng, aboveSheet });
    setHighlightedId(place.id);
  };

  // El resaltado dura lo justo para encontrarlo con la vista.
  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId]);

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
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
        >
          <MapResizeFix />
          <ZoomWatcher onChange={setZoom} />
          {showLiveLocation && <LiveLocationMarker />}
          <DestinationCenter destination={trip?.destination} hasPlaces={places.length > 0} />
          {/* Se reencuadra al entrar y al tocar los filtros, no al añadir lugares. */}
          <FitBounds
            points={filtered.map((p) => ({ lat: p.lat, lng: p.lng }))}
            fitKey={[...deselected].sort().join("|")}
          />
          <FocusPlace target={focus} />
          {filtered.map((place) => (
            <CategoryPin
              key={place.id}
              place={place}
              category={categoriesById.get(place.category_id)}
              showName={showNames}
              selected={place.id === highlightedId}
              onClick={() => openPlace(place.id)}
            />
          ))}
        </Map>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3">
          <div className="pointer-events-auto rounded-[var(--radius-md)] bg-surface shadow-[var(--shadow-md)] p-1.5">
            <PlaceSearchBox onSelect={handleSearchSelect} />
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
          <PlaceForm
            tripId={tripId}
            fromSearch={pendingPlace}
            onCreated={(place) => focusPlace(place)}
            onDone={() => setPendingPlace(null)}
          />
        )}
      </Sheet>

      <Sheet open={!!duplicate} onClose={() => setDuplicate(null)} title="Ya está en el viaje">
        {duplicate && (
          <div className="flex flex-col gap-4">
            <p className="text-[15px]">
              <span className="font-medium">{duplicate.name}</span> ya lo teníais guardado
              {categoriesById.get(duplicate.category_id)
                ? ` en ${categoriesById.get(duplicate.category_id)!.name}`
                : ""}
              , así que no se ha añadido otra vez.
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  focusPlace(duplicate, true);
                  openPlace(duplicate.id);
                  setDuplicate(null);
                }}
              >
                Ver el lugar
              </Button>
              <Button variant="secondary" onClick={() => setDuplicate(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
