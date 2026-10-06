"use client";

import { useMemo, useState } from "react";
import { Map } from "@vis.gl/react-google-maps";
import { ArrowUp, Check, LocateFixed, MapPin, Plus, Search, X } from "lucide-react";
import clsx from "clsx";
import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI, categoryTones } from "@/lib/categories";
import { useCategoriesById } from "@/lib/queries/categories";
import { useAssignPlaceToDay, nextOrderInDay } from "@/lib/queries/place-day-links";
import { byName, findExistingPlace, nameIncludes } from "@/lib/places";
import { bearingDegrees, compassPoint, distanceMeters } from "@/lib/geo";
import { pinsOf, sortItinerary, stopMarks } from "@/lib/days/itinerary";
import { formatNearby, isZoneAnchor } from "@/lib/days/nearby";
import { MapProvider } from "@/components/map/MapProvider";
import { CategoryPin } from "@/components/map/CategoryPin";
import { FitBounds } from "@/components/map/FitBounds";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { PlaceForm } from "@/components/places/PlaceForm";
import type { SelectedPlace } from "@/components/map/PlaceSearchBox";
import { usePlaceSearch } from "@/components/map/usePlaceSearch";
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
/** Más cerca que esto, la flecha de dirección no dice nada: es el mismo sitio. */
const MIN_ARROW_METERS = 15;

/** Postgres: violación de unicidad. Es lo que sale al repetir sin la 0017. */
const isDuplicateError = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

/**
 * Añadir lugares a un día viendo qué queda cerca de qué, sin salir a la
 * pestaña Mapa. Se elige un punto de partida (una parada del día o cualquier
 * otro sitio, tocándolo en el mapa o en la lista) y los candidatos se ordenan
 * por cercanía a él, cada uno con una flecha que dice hacia dónde queda: dos
 * sitios con la flecha igual pillan de camino el uno del otro. La hoja no se
 * cierra al añadir: lo normal es meter varios sitios de la misma zona seguidos.
 *
 * El buscador filtra por nombre entre todo lo guardado (también lo que ya
 * está en este día, que se puede repetir) y, si el sitio no está guardado, lo
 * busca en Google Maps para crearlo sin salir de aquí.
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

  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  // Un sitio de Google que aún no está guardado: se crea en su propia hoja.
  const [pendingPlace, setPendingPlace] = useState<SelectedPlace | null>(null);

  /** Las paradas que ya tiene el día, en su orden. */
  const sequence = useMemo(() => {
    const byId = new globalThis.Map(places.map((p) => [p.id, p]));
    const entries = links
      .filter((l) => l.day_id === day.id)
      .flatMap((link) => {
        const place = byId.get(link.place_id);
        return place ? [{ link, place }] : [];
      });
    return sortItinerary(entries);
  }, [links, places, day.id]);

  /** Un pin por lugar del día, con su número (o números, si se repite). */
  const dayPins = useMemo(() => pinsOf(sequence, stopMarks(sequence)), [sequence]);
  const labelInDay = useMemo(
    () => new globalThis.Map(dayPins.map((pin) => [pin.place.id, pin.label])),
    [dayPins],
  );

  const assignedIds = useMemo(() => new Set(links.map((l) => l.place_id)), [links]);
  const otherDaysOf = (place: Place) =>
    new Set(links.filter((l) => l.place_id === place.id && l.day_id !== day.id).map((l) => l.day_id))
      .size;

  // Por defecto, solo lo que aún no tiene día: es lo que queda por repartir.
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);

  // Punto de partida. undefined = el automático: la última parada del día que
  // no sea logística (aeropuerto, estación, hotel). null = sin punto, A–Z.
  const [anchorChoice, setAnchorChoice] = useState<string | null | undefined>(undefined);
  const defaultAnchor = useMemo(
    () =>
      [...sequence].reverse().find((e) => isZoneAnchor(categoriesById.get(e.place.category_id)))
        ?.place ?? null,
    [sequence, categoriesById],
  );
  const anchor =
    anchorChoice === undefined
      ? defaultAnchor
      : (places.find((p) => p.id === anchorChoice) ?? null);

  /** Marca un sitio como punto de partida; si ya lo era, lo quita. */
  const toggleAnchor = (placeId: string) =>
    setAnchorChoice(anchor?.id === placeId ? null : placeId);

  const candidates = useMemo(() => {
    // Buscando por nombre entra todo lo guardado: es la forma de llegar al
    // hotel o a la estación para repetirlos.
    const list = places.filter((p) =>
      searching ? nameIncludes(p.name, query) : !onlyUnassigned || !assignedIds.has(p.id),
    );
    if (!anchor) return list.sort(byName).map((place) => ({ place, meters: null, bearing: null }));
    return list
      .map((place) => ({
        place,
        meters: distanceMeters(anchor, place),
        bearing: bearingDegrees(anchor, place),
      }))
      .sort((a, b) => a.meters - b.meters);
  }, [places, assignedIds, onlyUnassigned, anchor, searching, query]);

  const mapPoints = useMemo(() => {
    const toPoint = (p: Place) => ({ lat: p.lat, lng: p.lng });
    if (anchor) {
      return [anchor, ...candidates.slice(0, NEAREST_IN_VIEW).map((c) => c.place)].map(toPoint);
    }
    const visits = dayPins
      .map((pin) => pin.place)
      .filter((p) => isZoneAnchor(categoriesById.get(p.category_id)));
    return [...visits, ...candidates.map((c) => c.place)].map(toPoint);
  }, [anchor, candidates, dayPins, categoriesById]);

  const add = (place: Place) => {
    const inDay = labelInDay.get(place.id);
    const others = otherDaysOf(place);
    const question = inDay
      ? `"${place.name}" ya está en el Día ${day.day_index} (parada ${inDay}). ¿Quieres añadirlo otra vez?`
      : others > 0
        ? `"${place.name}" ya está asignado a ${others === 1 ? "otro día" : `${others} días`}. ¿Seguro que quieres repetirlo también en el Día ${day.day_index}?`
        : null;
    if (question && !confirm(question)) return;
    assign.mutate(
      {
        trip_id: tripId,
        place_id: place.id,
        day_id: day.id,
        order_in_day: nextOrderInDay(links, day.id),
      },
      {
        onError: (err) =>
          alert(
            isDuplicateError(err)
              ? "Para repetir un lugar en el mismo día falta ejecutar la migración 0017 en Supabase."
              : "No se ha podido añadir al día.",
          ),
      },
    );
    // Lo recién añadido pasa a ser el punto de partida: así se va encadenando
    // la zona sitio a sitio.
    if (isZoneAnchor(categoriesById.get(place.category_id))) setAnchorChoice(place.id);
  };

  return (
    <MapProvider>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un sitio, guardado o nuevo…"
            aria-label="Buscar un sitio"
            className="px-9"
          />
          {searching && (
            <button
              onClick={() => setQuery("")}
              aria-label="Borrar la búsqueda"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-muted-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mientras se busca, el mapa y el punto de partida se esconden (sin
            desmontarlos) para que los resultados queden pegados al buscador y
            no debajo del teclado. */}
        <div className={clsx("flex flex-col gap-3", searching && "hidden")}>
          <div className="h-44 overflow-hidden rounded-[var(--radius-md)]">
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
                fitKey={`${anchor?.id ?? "todo"}|${onlyUnassigned}|${searching}`}
                padding={{ top: 52, bottom: 16, left: 28, right: 28 }}
              />
              {candidates
                .filter(({ place }) => !labelInDay.has(place.id))
                .map(({ place }) => (
                  <CategoryPin
                    key={place.id}
                    place={place}
                    category={categoriesById.get(place.category_id)}
                    selected={place.id === anchor?.id}
                    onClick={() => toggleAnchor(place.id)}
                  />
                ))}
              {/* Las paradas del día, con su número, para ver por dónde va ya. */}
              {dayPins.map(({ place, label }) => (
                <CategoryPin
                  key={place.id}
                  place={place}
                  category={categoriesById.get(place.category_id)}
                  order={label}
                  selected={place.id === anchor?.id}
                  onClick={() => toggleAnchor(place.id)}
                />
              ))}
            </Map>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              {anchor
                ? "Por cercanía a este punto; la flecha dice hacia dónde queda cada sitio:"
                : "Elige de dónde partir, o toca un sitio en el mapa:"}
            </p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {/* Un punto de partida que no es parada del día (elegido en el mapa o en la lista). */}
              {anchor && !labelInDay.has(anchor.id) && (
                <Chip active onClick={() => setAnchorChoice(null)}>
                  {anchor.name}
                </Chip>
              )}
              {dayPins.map(({ place, label }) => (
                <Chip
                  key={place.id}
                  active={anchor?.id === place.id}
                  onClick={() => toggleAnchor(place.id)}
                >
                  {label} · {place.name}
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
        </div>

        {candidates.length === 0 ? (
          !searching && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {places.length === 0
                ? "Todavía no hay ningún lugar guardado. Búscalo arriba para añadirlo."
                : onlyUnassigned
                  ? "No queda nada sin día 🎉"
                  : "No hay más lugares guardados."}
            </p>
          )
        ) : (
          // Con key: al cambiar el punto de partida la lista vuelve arriba, que es
          // donde está lo más cercano.
          <ul
            key={anchor?.id ?? "az"}
            className="-mx-2 max-h-[38vh] divide-y divide-border overflow-y-auto"
          >
            {candidates.map(({ place, meters, bearing }) => {
              const category = categoriesById.get(place.category_id);
              const inDay = labelInDay.get(place.id);
              const others = otherDaysOf(place);
              const isAnchor = place.id === anchor?.id;
              const details = [
                isAnchor ? "Punto de partida" : meters !== null ? formatNearby(meters) : null,
                inDay ? `ya está en este día (${inDay})` : others > 0 ? "ya está en otro día" : null,
              ].filter(Boolean);
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
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {!isAnchor && meters !== null && bearing !== null && meters >= MIN_ARROW_METERS && (
                        // Norte arriba, como el mapa: la flecha apunta igual que
                        // se ve el sitio desde el punto de partida.
                        <ArrowUp
                          size={14}
                          strokeWidth={2.75}
                          role="img"
                          aria-label={`Hacia el ${compassPoint(bearing)}`}
                          className="shrink-0 text-accent"
                          style={{ transform: `rotate(${Math.round(bearing)}deg)` }}
                        />
                      )}
                      <span className="truncate">{details.join(" · ")}</span>
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

        {searching && (
          <GoogleResults
            query={query}
            places={places}
            hasSaved={candidates.length > 0}
            onNew={setPendingPlace}
            // Google lo llama de otra forma, pero ya está guardado: se enseña.
            onExisting={(place) => setQuery(place.name)}
          />
        )}

        {sequence.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check size={13} />
            {sequence.length === 1 ? "1 parada" : `${sequence.length} paradas`} en el Día {day.day_index}
          </p>
        )}
      </div>

      <Sheet open={!!pendingPlace} onClose={() => setPendingPlace(null)} title="Nuevo lugar">
        {pendingPlace && (
          <PlaceForm
            tripId={tripId}
            fromSearch={pendingPlace}
            defaultDayId={day.id}
            onCreated={(place) => {
              setQuery("");
              if (isZoneAnchor(categoriesById.get(place.category_id))) setAnchorChoice(place.id);
            }}
            onDone={() => setPendingPlace(null)}
          />
        )}
      </Sheet>
    </MapProvider>
  );
}

/**
 * Lo que Google Maps encuentra para lo escrito y aún no está guardado en el
 * viaje. Al tocar uno se abre el formulario de lugar nuevo, con este día ya
 * marcado.
 */
function GoogleResults({
  query,
  places,
  hasSaved,
  onNew,
  onExisting,
}: {
  query: string;
  places: Place[];
  /** Hay coincidencias entre lo guardado: cambia el texto de cuando no hay nada. */
  hasSaved: boolean;
  onNew: (place: SelectedPlace) => void;
  onExisting: (place: Place) => void;
}) {
  const { predictions, resolve } = usePlaceSearch(query, places);
  const [resolving, setResolving] = useState<string | null>(null);

  const savedIds = new Set(places.map((p) => p.google_place_id));
  const fresh = predictions.filter((p) => !savedIds.has(p.placeId));

  const pick = async (prediction: (typeof fresh)[number]) => {
    setResolving(prediction.placeId);
    const selected = await resolve(prediction);
    setResolving(null);
    if (!selected) return alert("No se ha podido cargar ese sitio de Google Maps.");
    const existing = findExistingPlace(places, selected);
    if (existing) onExisting(existing);
    else onNew(selected);
  };

  if (fresh.length === 0) {
    return hasSaved ? null : (
      <p className="py-3 text-center text-sm text-muted-foreground">
        {query.trim().length < 3
          ? "Sigue escribiendo para buscarlo también en Google Maps."
          : "Nada con ese nombre, ni guardado ni en Google Maps."}
      </p>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">Nuevo, de Google Maps</p>
      <ul className="-mx-2 divide-y divide-border">
        {fresh.map((prediction) => (
          <li key={prediction.placeId}>
            <button
              onClick={() => pick(prediction)}
              disabled={resolving !== null}
              className="flex w-full items-center gap-2.5 px-2 py-2 text-left disabled:opacity-60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
                <MapPin size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{prediction.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {resolving === prediction.placeId ? "Cargando…" : prediction.detail}
                </span>
              </span>
              <Plus size={18} className="shrink-0 text-accent" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
