"use client";

import { useMemo, useState } from "react";
import { Map } from "@vis.gl/react-google-maps";
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Pencil, X } from "lucide-react";
import clsx from "clsx";
import { MapProvider } from "@/components/map/MapProvider";
import { CategoryPin, NAMES_MIN_ZOOM } from "@/components/map/CategoryPin";
import { ZoomWatcher } from "@/components/map/ZoomWatcher";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import { FitBounds } from "@/components/map/FitBounds";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { useCategoriesById } from "@/lib/queries/categories";
import { useSaveDayPlan, useUnassignPlaceFromDay, type DayPlanPatch } from "@/lib/queries/place-day-links";
import { useUpdatePlace } from "@/lib/queries/places";
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
import type { TripDay } from "@/lib/supabase/types";

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };

type MapSize = "compact" | "half" | "full";

/** Más arriba que abajo: la gota del pin sobresale ~44 px por encima de su punto. */
const COMPACT_MAP_PADDING = { top: 48, bottom: 12, left: 24, right: 24 };

/**
 * Un día del viaje: mapa con la ruta arriba y la lista de paradas debajo, las
 * dos con el mismo orden y la misma numeración.
 *
 * El mapa va pequeño por defecto (antes se comía media pantalla y la lista no
 * se leía) y se amplía en dos pasos: media pantalla, con la lista debajo, y
 * pantalla completa, tapando también cabecera y pestañas, donde además los
 * pines llevan el nombre al acercarse.
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
  const updatePlace = useUpdatePlace();
  const unassign = useUnassignPlaceFromDay();
  const [mapSize, setMapSize] = useState<MapSize>("compact");
  const [zoom, setZoom] = useState(0);
  const fullscreen = mapSize === "full";
  const [editing, setEditing] = useState<ItineraryEntry | null>(null);

  const sequence = useMemo(() => sortItinerary(entries), [entries]);
  const points = sequence.map(({ place }) => ({ lat: place.lat, lng: place.lng }));

  const saveSequence = (next: ItineraryEntry[], extra: DayPlanPatch[] = []) => {
    const patches = new globalThis.Map<string, DayPlanPatch>();
    for (const p of [...orderPatches(next), ...extra]) {
      patches.set(p.id, { ...patches.get(p.id), ...p });
    }
    if (patches.size > 0) savePlan.mutate({ trip_id: tripId, patches: [...patches.values()] });
  };

  const move = (index: number, direction: -1 | 1) =>
    saveSequence(moveEntry(sequence, index, direction));

  const saveStop = (entry: ItineraryEntry, time: string, notes: string) => {
    const scheduledAt = time ? timeValueToIso(day.date, time) : null;
    if (scheduledAt !== entry.link.scheduled_at) {
      // Con hora nueva, se recoloca entre las demás horas; al quitarla, se
      // queda en su sitio y pasa a poder moverse con las flechas.
      const updated = sequence.map((e) =>
        e.link.id === entry.link.id ? { ...e, link: { ...e.link, scheduled_at: scheduledAt } } : e,
      );
      const next = scheduledAt ? placeByTime(updated, entry.link.id, Date.parse(scheduledAt)) : updated;
      saveSequence(next, [{ id: entry.link.id, scheduled_at: scheduledAt }]);
    }
    if (notes.trim() !== (entry.place.notes ?? "").trim()) {
      updatePlace.mutate({ id: entry.place.id, trip_id: tripId, notes: notes.trim() || null });
    }
    setEditing(null);
  };

  const removeStop = (entry: ItineraryEntry) => {
    unassign.mutate({ id: entry.link.id, trip_id: tripId });
    setEditing(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Es el mismo mapa en los tres tamaños: solo cambia su caja, así no se
          vuelve a cargar al ampliarlo. */}
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
            <ZoomWatcher onChange={setZoom} />
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
                showName={fullscreen && zoom >= NAMES_MIN_ZOOM}
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
        onClose={() => setEditing(null)}
        onSave={saveStop}
        onRemove={removeStop}
      />
    </div>
  );
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
  const notes = entry.place.notes?.trim();

  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-sm)] bg-surface pl-1.5 pr-2 py-2.5 shadow-[var(--shadow-sm)]">
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
        aria-label="Hora y notas"
        className={clsx(
          "flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-sm tabular-nums",
          timed ? "bg-accent/10 font-semibold text-accent" : "text-muted-foreground bg-surface-2",
        )}
      >
        {timed ? toLocalTimeValue(entry.link.scheduled_at!) : <Pencil size={14} />}
      </button>
    </div>
  );
}
