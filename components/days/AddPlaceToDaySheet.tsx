"use client";

import { useMemo, useState } from "react";
import { Map } from "@vis.gl/react-google-maps";
import { Check, LocateFixed, Plus } from "lucide-react";
import clsx from "clsx";
import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI, categoryTones } from "@/lib/categories";
import { useCategoriesById } from "@/lib/queries/categories";
import { useAssignPlaceToDay, nextOrderInDay } from "@/lib/queries/place-day-links";
import { byName } from "@/lib/places";
import { distanceMeters } from "@/lib/geo";
import { sortItinerary } from "@/lib/days/itinerary";
import { formatNearby, isZoneAnchor } from "@/lib/days/nearby";
import { MapProvider } from "@/components/map/MapProvider";
import { CategoryPin } from "@/components/map/CategoryPin";
import { FitBounds } from "@/components/map/FitBounds";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import type { Place, PlaceDayLink, TripDay } from "@/lib/supabase/types";

interface AddPlaceToDaySheetProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  day: TripDay;
  places: Place[];
  links: PlaceDayLink[];
}

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };
/** Cuántos candidatos, de los más cercanos, entran en el encuadre del mapa. */
const NEAREST_IN_VIEW = 6;

/**
 * Añadir lugares a un día viendo qué queda cerca de qué, sin salir a la
 * pestaña Mapa. Se elige un punto de partida (una parada del día o cualquier
 * otro sitio, tocándolo en el mapa o en la lista) y los candidatos se ordenan
 * por cercanía a él. La hoja no se cierra al añadir: lo normal es meter
 * varios sitios de la misma zona seguidos.
 */
export function AddPlaceToDaySheet(props: AddPlaceToDaySheetProps) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={`Añadir al Día ${props.day.day_index}`}>
      {/* Aparte y con key: cada vez que se abre, o al cambiar de día, empieza de cero. */}
      <Planner key={props.day.id} {...props} />
    </Sheet>
  );
}

function Planner({ tripId, day, places, links }: AddPlaceToDaySheetProps) {
  const assign = useAssignPlaceToDay();
  const categoriesById = useCategoriesById();

  /** Las paradas que ya tiene el día, en su orden y con su número. */
  const dayStops = useMemo(() => {
    const byId = new globalThis.Map(places.map((p) => [p.id, p]));
    const entries = links
      .filter((l) => l.day_id === day.id)
      .flatMap((link) => {
        const place = byId.get(link.place_id);
        return place ? [{ link, place }] : [];
      });
    return sortItinerary(entries).map((e) => e.place);
  }, [links, places, day.id]);

  const assignedIds = useMemo(() => new Set(links.map((l) => l.place_id)), [links]);
  const dayIds = useMemo(() => new Set(dayStops.map((p) => p.id)), [dayStops]);
  const otherDaysOf = (place: Place) =>
    links.filter((l) => l.place_id === place.id && l.day_id !== day.id).length;

  // Por defecto, solo lo que aún no tiene día: es lo que queda por repartir.
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);

  // Punto de partida. undefined = el automático: la última parada del día que
  // no sea logística (aeropuerto, estación, hotel). null = sin punto, A–Z.
  const [anchorChoice, setAnchorChoice] = useState<string | null | undefined>(undefined);
  const defaultAnchor = useMemo(
    () => [...dayStops].reverse().find((p) => isZoneAnchor(categoriesById.get(p.category_id))) ?? null,
    [dayStops, categoriesById],
  );
  const anchor =
    anchorChoice === undefined
      ? defaultAnchor
      : (places.find((p) => p.id === anchorChoice) ?? null);

  /** Marca un sitio como punto de partida; si ya lo era, lo quita. */
  const toggleAnchor = (placeId: string) =>
    setAnchorChoice(anchor?.id === placeId ? null : placeId);

  const candidates = useMemo(() => {
    const list = places.filter(
      (p) => !dayIds.has(p.id) && (!onlyUnassigned || !assignedIds.has(p.id)),
    );
    if (!anchor) return list.sort(byName).map((place) => ({ place, meters: null }));
    return list
      .map((place) => ({ place, meters: distanceMeters(anchor, place) }))
      .sort((a, b) => a.meters - b.meters);
  }, [places, dayIds, assignedIds, onlyUnassigned, anchor]);

  const mapPoints = useMemo(() => {
    const toPoint = (p: Place) => ({ lat: p.lat, lng: p.lng });
    if (anchor) {
      return [anchor, ...candidates.slice(0, NEAREST_IN_VIEW).map((c) => c.place)].map(toPoint);
    }
    const visits = dayStops.filter((p) => isZoneAnchor(categoriesById.get(p.category_id)));
    return [...visits, ...candidates.map((c) => c.place)].map(toPoint);
  }, [anchor, candidates, dayStops, categoriesById]);

  const add = (place: Place) => {
    const others = otherDaysOf(place);
    if (
      others > 0 &&
      !confirm(
        `"${place.name}" ya está asignado a ${others === 1 ? "otro día" : `${others} días`}. ¿Seguro que quieres repetirlo también en el Día ${day.day_index}?`,
      )
    ) {
      return;
    }
    assign.mutate({
      trip_id: tripId,
      place_id: place.id,
      day_id: day.id,
      order_in_day: nextOrderInDay(links, day.id),
    });
    // Lo recién añadido pasa a ser el punto de partida: así se va encadenando
    // la zona sitio a sitio.
    if (isZoneAnchor(categoriesById.get(place.category_id))) setAnchorChoice(place.id);
  };

  if (places.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay ningún lugar guardado. Añádelo primero desde la pestaña Mapa.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-44 overflow-hidden rounded-[var(--radius-md)]">
        <MapProvider>
          <Map
            className="h-full w-full"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI
            // Con un solo sitio (o dos casi pegados) el encuadre se iba al
            // zoom máximo y no se veía en qué barrio estaba.
            maxZoom={16}
          >
            <MapResizeFix />
            <FitBounds
              points={mapPoints}
              fitKey={`${anchor?.id ?? "todo"}|${onlyUnassigned}`}
              padding={{ top: 52, bottom: 16, left: 28, right: 28 }}
            />
            {candidates.map(({ place }) => (
              <CategoryPin
                key={place.id}
                place={place}
                category={categoriesById.get(place.category_id)}
                selected={place.id === anchor?.id}
                onClick={() => toggleAnchor(place.id)}
              />
            ))}
            {/* Las paradas del día, con su número, para ver por dónde va ya. */}
            {dayStops.map((place, i) => (
              <CategoryPin
                key={place.id}
                place={place}
                category={categoriesById.get(place.category_id)}
                order={i + 1}
                selected={place.id === anchor?.id}
                onClick={() => toggleAnchor(place.id)}
              />
            ))}
          </Map>
        </MapProvider>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">
          {anchor ? "Ordenado por cercanía a:" : "Elige de dónde partir, o toca un sitio en el mapa:"}
        </p>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {/* Un punto de partida que no es parada del día (elegido en el mapa o en la lista). */}
          {anchor && !dayIds.has(anchor.id) && (
            <Chip active onClick={() => setAnchorChoice(null)}>
              {anchor.name}
            </Chip>
          )}
          {dayStops.map((place, i) => (
            <Chip
              key={place.id}
              active={anchor?.id === place.id}
              onClick={() => toggleAnchor(place.id)}
            >
              {i + 1} · {place.name}
            </Chip>
          ))}
          <Chip active={!anchor} onClick={() => setAnchorChoice(null)}>
            A–Z
          </Chip>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyUnassigned}
          onChange={(e) => setOnlyUnassigned(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        Solo los que aún no tienen día
      </label>

      {candidates.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {onlyUnassigned ? "No queda nada sin día 🎉" : "No hay más lugares guardados."}
        </p>
      ) : (
        // Con key: al cambiar el punto de partida la lista vuelve arriba, que es
        // donde está lo más cercano.
        <ul
          key={anchor?.id ?? "az"}
          className="-mx-2 max-h-[38vh] divide-y divide-border overflow-y-auto"
        >
          {candidates.map(({ place, meters }) => {
            const category = categoriesById.get(place.category_id);
            const others = otherDaysOf(place);
            const isAnchor = place.id === anchor?.id;
            return (
              <li key={place.id} className="flex items-center gap-2.5 px-2 py-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]"
                  style={{
                    background: categoryTones(category?.color ?? FALLBACK_CATEGORY_COLOR).fill,
                  }}
                >
                  {category?.emoji ?? FALLBACK_CATEGORY_EMOJI}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{place.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[
                      isAnchor ? "Punto de partida" : meters !== null ? formatNearby(meters) : null,
                      others > 0 ? "ya está en otro día" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button
                  onClick={() => toggleAnchor(place.id)}
                  aria-label={isAnchor ? `Dejar de partir de ${place.name}` : `Ver qué hay cerca de ${place.name}`}
                  aria-pressed={isAnchor}
                  className={clsx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isAnchor ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <LocateFixed size={17} />
                </button>
                <button
                  onClick={() => add(place)}
                  aria-label={`Añadir ${place.name} al Día ${day.day_index}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
                >
                  <Plus size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {dayStops.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check size={13} />
          {dayStops.length === 1 ? "1 parada" : `${dayStops.length} paradas`} en el Día {day.day_index}
        </p>
      )}
    </div>
  );
}
