"use client";

import { useMemo, useState } from "react";
import { Map } from "@vis.gl/react-google-maps";
import { ChevronDown, ChevronUp, EyeOff, Map as MapIcon, Maximize2, Minimize2, Pencil, X } from "lucide-react";
import clsx from "clsx";
import { MapProvider } from "@/components/map/MapProvider";
import { CategoryPin } from "@/components/map/CategoryPin";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { FitBounds } from "@/components/map/FitBounds";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { useCategoriesById } from "@/lib/queries/categories";
import {
  usePlaceDayLinks,
  useSaveDayPlan,
  useUnassignPlaceFromDay,
  type DayPlanPatch,
} from "@/lib/queries/place-day-links";
import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI } from "@/lib/categories";
import {
  moveEntry,
  orderPatches,
  placeByTime,
  sortItinerary,
  timeOf,
  timeValueToIso,
  toLocalTimeValue,
  type ItineraryEntry,
} from "@/lib/days/itinerary";
import { StopSheet } from "./StopSheet";
import { TransitSteps } from "./TransitSteps";
import { isTransportCategory } from "@/lib/days/transit";
import type { TransitStep, TripDay } from "@/lib/supabase/types";

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };

type MapSize = "hidden" | "compact" | "half" | "full";

/**
 * Se recuerda en el móvil si el mapa se dejó cerrado: quien planifica solo
 * con la lista no quiere cerrarlo cada vez que cambia de día.
 */
const MAP_HIDDEN_KEY = "gocy:day-map-hidden";

function readMapHidden() {
  try {
    return localStorage.getItem(MAP_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberMapHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(MAP_HIDDEN_KEY, "1");
    else localStorage.removeItem(MAP_HIDDEN_KEY);
  } catch {
    // Sin almacenamiento (modo privado…): simplemente no se recuerda.
  }
}

/** Más arriba que abajo: la gota del pin sobresale ~44 px por encima de su punto. */
const COMPACT_MAP_PADDING = { top: 48, bottom: 12, left: 24, right: 24 };

/**
 * Un día del viaje: mapa con la ruta arriba y la lista de paradas debajo, las
 * dos con el mismo orden y la misma numeración.
 *
 * El mapa va pequeño por defecto (antes se comía media pantalla y la lista no
 * se leía) y se amplía en dos pasos: media pantalla, con la lista debajo, y
 * pantalla completa, tapando también cabecera y pestañas. Ampliado, cada pin
 * lleva debajo su número y su nombre. También se puede cerrar del todo y
 * quedarse solo con la planificación.
 */
export function DayItinerary({
  entries,
  day,
  tripId,
  onOpenPlace,
}: {
  entries: ItineraryEntry[];
  day: TripDay;
  tripId: string;
  onOpenPlace: (placeId: string) => void;
}) {
  const categoriesById = useCategoriesById();
  const savePlan = useSaveDayPlan();
  const { data: allLinks = [] } = usePlaceDayLinks(tripId);
  const unassign = useUnassignPlaceFromDay();
  // Este componente solo se pinta en el cliente (necesita los días, que vienen
  // de Supabase), así que se puede leer localStorage al crear el estado.
  const [mapSize, setMapSizeState] = useState<MapSize>(() =>
    readMapHidden() ? "hidden" : "compact",
  );
  const setMapSize = (size: MapSize) => {
    setMapSizeState(size);
    rememberMapHidden(size === "hidden");
  };
  const fullscreen = mapSize === "full";
  const [editing, setEditing] = useState<ItineraryEntry | null>(null);

  const sequence = useMemo(() => sortItinerary(entries), [entries]);

  /** Las otras veces que este lugar sale en el viaje (otros días). */
  const otherVisitsOf = (entry: ItineraryEntry) =>
    allLinks.filter((l) => l.place_id === entry.place.id && l.id !== entry.link.id);
  const points = sequence.map(({ place }) => ({ lat: place.lat, lng: place.lng }));

  const saveSequence = (
    next: ItineraryEntry[],
    extra: DayPlanPatch[] = [],
    options?: Parameters<typeof savePlan.mutate>[1],
  ) => {
    const patches = new globalThis.Map<string, DayPlanPatch>();
    for (const p of [...orderPatches(next), ...extra]) {
      patches.set(p.id, { ...patches.get(p.id), ...p });
    }
    if (patches.size > 0) {
      savePlan.mutate({ trip_id: tripId, patches: [...patches.values()] }, options);
    }
  };

  const move = (index: number, direction: -1 | 1) =>
    saveSequence(moveEntry(sequence, index, direction));

  const saveStop = (
    entry: ItineraryEntry,
    time: string,
    notes: string,
    transit: TransitStep[] | null,
    copyNotesToAllVisits: boolean,
  ) => {
    const extra: DayPlanPatch[] = [];
    let next = sequence;

    const scheduledAt = time ? timeValueToIso(day.date, time) : null;
    if (scheduledAt !== entry.link.scheduled_at) {
      // Con hora nueva, se recoloca entre las demás horas; al quitarla, se
      // queda en su sitio y pasa a poder moverse con las flechas.
      const updated = sequence.map((e) =>
        e.link.id === entry.link.id ? { ...e, link: { ...e.link, scheduled_at: scheduledAt } } : e,
      );
      next = scheduledAt ? placeByTime(updated, entry.link.id, Date.parse(scheduledAt)) : updated;
      extra.push({ id: entry.link.id, scheduled_at: scheduledAt });
    }

    if (JSON.stringify(transit) !== JSON.stringify(entry.link.transit ?? null)) {
      extra.push({ id: entry.link.id, transit });
    }

    const newNotes = notes.trim() || null;
    if (newNotes !== (stopNotes(entry) ?? null) || copyNotesToAllVisits) {
      extra.push({ id: entry.link.id, notes: newNotes });
      if (copyNotesToAllVisits) {
        for (const other of otherVisitsOf(entry)) extra.push({ id: other.id, notes: newNotes });
      }
    }

    saveSequence(next, extra, {
      // Sin las columnas de 0011 (trayectos) o 0012 (notas por día), Supabase
      // rechaza el cambio y se desharía sin decir nada.
      onError: () =>
        alert(
          "No se ha podido guardar. Si es la primera vez que usas trayectos o notas por día, falta ejecutar las migraciones 0011 y 0012 en Supabase.",
        ),
    });
    setEditing(null);
  };

  const removeStop = (entry: ItineraryEntry) => {
    unassign.mutate({ id: entry.link.id, trip_id: tripId });
    setEditing(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {mapSize === "hidden" ? (
        <button
          onClick={() => setMapSize("compact")}
          className="mx-4 mb-1 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-surface-2 py-2 text-sm font-medium text-muted-foreground"
        >
          <MapIcon size={16} />
          Mostrar mapa
        </button>
      ) : (
        // Es el mismo mapa en los tres tamaños: solo cambia su caja, así no se
        // vuelve a cargar al ampliarlo.
        <div
          className={clsx(
            fullscreen ? "fixed inset-0 z-40 bg-surface" : "relative shrink-0",
            mapSize === "compact" && "h-44",
            mapSize === "half" && "h-[55%]",
          )}
        >
          <MapProvider>
            <Map
              className="h-full w-full"
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={12}
              gestureHandling="greedy"
              disableDefaultUI
              zoomControl={fullscreen}
            >
              <MapResizeFix />
              {/* Se reencuadra también al cambiar el tamaño del mapa. */}
              <FitBounds
                points={points}
                fitKey={`${mapSize}|${points.map((p) => `${p.lat},${p.lng}`).join("|")}`}
                padding={mapSize === "compact" ? COMPACT_MAP_PADDING : 64}
              />
              <RoutePolyline path={points} />
              {sequence.map(({ place, link }, i) => (
                <CategoryPin
                  key={link.id}
                  place={place}
                  category={categoriesById.get(place.category_id)}
                  order={i + 1}
                  // En el mapa del día los nombres van siempre que haya sitio
                  // (no solo al acercarse): son pocas paradas y es la forma de
                  // saber qué es cada una. En el mapa pequeño, solo el número.
                  showName={mapSize !== "compact"}
                  onClick={() => onOpenPlace(place.id)}
                />
              ))}
            </Map>
          </MapProvider>
          {fullscreen ? (
            <button
              onClick={() => setMapSize("half")}
              aria-label="Salir de pantalla completa"
              className="absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] rounded-full bg-surface p-2.5 shadow-[var(--shadow-md)] text-foreground"
            >
              <X size={20} />
            </button>
          ) : (
            <div className="absolute bottom-2 right-2 flex gap-2">
              {mapSize === "compact" && (
                <MapButton label="Cerrar mapa" onClick={() => setMapSize("hidden")}>
                  <EyeOff size={18} />
                </MapButton>
              )}
              {mapSize === "half" && (
                <MapButton label="Reducir mapa" onClick={() => setMapSize("compact")}>
                  <Minimize2 size={18} />
                </MapButton>
              )}
              <MapButton
                label={mapSize === "compact" ? "Ampliar mapa" : "Pantalla completa"}
                onClick={() => setMapSize(mapSize === "compact" ? "half" : "full")}
              >
                <Maximize2 size={18} />
              </MapButton>
            </div>
          )}
        </div>
      )}

      <div
        className={clsx(
          "flex-1 min-h-0 overflow-y-auto flex-col gap-2 px-4 py-3",
          "flex",
        )}
      >
        {sequence.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada asignado a este día todavía.</p>
        )}
        {sequence.map((entry, i) => (
          <StopRow
            key={entry.link.id}
            entry={entry}
            order={i + 1}
            color={categoriesById.get(entry.place.category_id)?.color ?? FALLBACK_CATEGORY_COLOR}
            emoji={categoriesById.get(entry.place.category_id)?.emoji ?? FALLBACK_CATEGORY_EMOJI}
            onOpen={() => onOpenPlace(entry.place.id)}
            onEdit={() => setEditing(entry)}
            onMoveUp={i > 0 ? () => move(i, -1) : undefined}
            onMoveDown={i < sequence.length - 1 ? () => move(i, 1) : undefined}
          />
        ))}
      </div>

      <StopSheet
        entry={editing}
        isTransport={
          !!editing && isTransportCategory(categoriesById.get(editing.place.category_id))
        }
        otherVisits={editing ? otherVisitsOf(editing).length : 0}
        onClose={() => setEditing(null)}
        onSave={saveStop}
        onRemove={removeStop}
      />
    </div>
  );
}

/**
 * La nota de la parada en este día. Si aún no se ha ejecutado la migración
 * 0012 la columna no existe (undefined) y se enseña la del lugar, como antes,
 * para que no desaparezcan las notas que ya había.
 */
function stopNotes(entry: ItineraryEntry) {
  return entry.link.notes === undefined ? entry.place.notes : entry.link.notes;
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="rounded-full bg-surface p-2 shadow-[var(--shadow-md)] text-foreground"
    >
      {children}
    </button>
  );
}

function StopRow({
  entry,
  order,
  color,
  emoji,
  onOpen,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  entry: ItineraryEntry;
  order: number;
  color: string;
  emoji: string;
  onOpen: () => void;
  onEdit: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  // Solo se mueven a mano las paradas sin hora: las que tienen hora las
  // coloca la propia hora.
  const timed = timeOf(entry) !== null;
  const notes = stopNotes(entry)?.trim();
  const transit = entry.link.transit;

  return (
    <div className="rounded-[var(--radius-sm)] bg-surface pl-1.5 pr-2 py-2.5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2.5">
        <div className="flex w-6 shrink-0 flex-col items-center">
          {!timed && (
            <>
              <button
                onClick={onMoveUp}
                disabled={!onMoveUp}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                aria-label="Subir"
              >
                <ChevronUp size={18} />
              </button>
              <button
                onClick={onMoveDown}
                disabled={!onMoveDown}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                aria-label="Bajar"
              >
                <ChevronDown size={18} />
              </button>
            </>
          )}
        </div>

        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ background: color }}
        >
          {order}
        </span>

        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <span className="flex items-center gap-1.5">
            <span className="shrink-0">{emoji}</span>
            <span className="truncate text-[15px] font-medium">{entry.place.name}</span>
          </span>
          {notes && (
            <span className="mt-0.5 block whitespace-pre-line text-[13px] leading-snug text-muted-foreground line-clamp-3">
              {notes}
            </span>
          )}
        </button>

        <button
          onClick={onEdit}
          aria-label="Hora, trayecto y notas"
          className={clsx(
            "flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm tabular-nums",
            timed ? "bg-accent/10 font-semibold text-accent" : "text-muted-foreground bg-surface-2",
          )}
        >
          {timed ? toLocalTimeValue(entry.link.scheduled_at!) : <Pencil size={14} />}
        </button>
      </div>
      {/* El trayecto va a todo el ancho de la tarjeta y en grande: es lo que
          se mira con prisa en el andén. */}
      {transit && transit.length > 0 && (
        <div className="mt-2.5 pl-1.5">
          <TransitSteps steps={transit} />
        </div>
      )}
    </div>
  );
}
