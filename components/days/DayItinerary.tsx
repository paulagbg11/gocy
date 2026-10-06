"use client";

import { useMemo, useRef, useState } from "react";
import { Map } from "@vis.gl/react-google-maps";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  EyeOff,
  GripVertical,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Pencil,
  Star,
  X,
} from "lucide-react";
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
import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI, categoryTones } from "@/lib/categories";
import {
  moveEntryTo,
  orderPatches,
  placeByTime,
  sortItinerary,
  timeOf,
  timeValueToIso,
  toLocalTimeValue,
  type ItineraryEntry,
} from "@/lib/days/itinerary";
import { StopSheet } from "./StopSheet";
import { TransitSteps, TransitSummary } from "./TransitSteps";
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

  // Los trayectos salen plegados: la lista del día se lee de un vistazo y cada
  // uno se abre cuando toca cogerlo.
  const [openTransit, setOpenTransit] = useState<ReadonlySet<string>>(new Set());

  const sequence = useMemo(() => sortItinerary(entries), [entries]);

  const withTransit = sequence.filter((e) => (e.link.transit?.length ?? 0) > 0);
  const allTransitOpen = withTransit.every((e) => openTransit.has(e.link.id));
  const toggleTransit = (linkId: string) =>
    setOpenTransit((open) => {
      const next = new Set(open);
      if (!next.delete(linkId)) next.add(linkId);
      return next;
    });
  const toggleAllTransit = () =>
    setOpenTransit(allTransitOpen ? new Set() : new Set(withTransit.map((e) => e.link.id)));

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

  // Reordenar arrastrando. Al empezar se miden las filas una sola vez; mientras
  // se arrastra, la fila sigue al dedo y las demás se apartan con un transform,
  // sin tocar el orden real hasta soltar.
  const listRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new globalThis.Map<string, HTMLLIElement>());
  const dragStart = useRef<{ y: number; scroll: number; mids: number[] } | null>(null);
  const [drag, setDrag] = useState<{
    from: number;
    to: number;
    dy: number;
    height: number;
  } | null>(null);

  const startDrag = (index: number, e: React.PointerEvent) => {
    const rects = sequence.map((entry) => rowEls.current.get(entry.link.id)?.getBoundingClientRect());
    const own = rects[index];
    if (!own) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = {
      y: e.clientY,
      scroll: listRef.current?.scrollTop ?? 0,
      mids: rects.map((r) => (r ? r.top + r.height / 2 : 0)),
    };
    setDrag({ from: index, to: index, dy: 0, height: own.height });
  };

  const moveDrag = (e: React.PointerEvent) => {
    const start = dragStart.current;
    const list = listRef.current;
    if (!start || !drag || !list) return;
    // Cerca del borde de la lista, se desplaza para poder llegar más lejos.
    const box = list.getBoundingClientRect();
    if (e.clientY < box.top + 40) list.scrollTop -= 10;
    else if (e.clientY > box.bottom - 40) list.scrollTop += 10;
    const dy = e.clientY - start.y + (list.scrollTop - start.scroll);
    const center = start.mids[drag.from] + dy;
    const to = start.mids.filter((mid, i) => i !== drag.from && mid < center).length;
    setDrag({ ...drag, dy, to });
  };

  const endDrag = (commit: boolean) => {
    if (commit && drag) saveSequence(moveEntryTo(sequence, drag.from, drag.to));
    dragStart.current = null;
    setDrag(null);
  };

  /** Cuánto se desplaza cada fila mientras se arrastra otra (o ella misma). */
  const dragOffset = (index: number) => {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < index && index <= drag.to) return -drag.height;
    if (drag.to <= index && index < drag.from) return drag.height;
    return 0;
  };

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

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4">
        {sequence.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada asignado a este día todavía.</p>
        )}
        {withTransit.length > 0 && (
          <div className="mb-3 flex justify-end">
            <button
              onClick={toggleAllTransit}
              className="flex items-center gap-1 text-[13px] font-medium text-accent"
            >
              {allTransitOpen ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
              {allTransitOpen ? "Plegar trayectos" : "Desplegar trayectos"}
            </button>
          </div>
        )}
        <ol>
          {sequence.map((entry, i) => (
            <StopRow
              key={entry.link.id}
              entry={entry}
              order={i + 1}
              last={i === sequence.length - 1}
              color={categoriesById.get(entry.place.category_id)?.color ?? FALLBACK_CATEGORY_COLOR}
              emoji={categoriesById.get(entry.place.category_id)?.emoji ?? FALLBACK_CATEGORY_EMOJI}
              transitOpen={openTransit.has(entry.link.id)}
              onToggleTransit={() => toggleTransit(entry.link.id)}
              onOpen={() => onOpenPlace(entry.place.id)}
              onEdit={() => setEditing(entry)}
              rowRef={(el) => {
                if (el) rowEls.current.set(entry.link.id, el);
                else rowEls.current.delete(entry.link.id);
              }}
              offset={dragOffset(i)}
              dragging={drag?.from === i}
              settling={!!drag && drag.from !== i}
              onDragStart={(e) => startDrag(i, e)}
              onDragMove={moveDrag}
              onDragEnd={endDrag}
              onNudge={(direction) => saveSequence(moveEntryTo(sequence, i, i + direction))}
            />
          ))}
        </ol>
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

/**
 * Una parada en la línea de tiempo del día: la hora a la izquierda, el número
 * (el mismo que lleva su pin en el mapa) sobre la línea que une las paradas, y
 * a la derecha el nombre, la nota y el trayecto hasta la siguiente.
 */
function StopRow({
  entry,
  order,
  last,
  color,
  emoji,
  transitOpen,
  onToggleTransit,
  onOpen,
  onEdit,
  rowRef,
  offset,
  dragging,
  settling,
  onDragStart,
  onDragMove,
  onDragEnd,
  onNudge,
}: {
  entry: ItineraryEntry;
  order: number;
  last: boolean;
  color: string;
  emoji: string;
  transitOpen: boolean;
  onToggleTransit: () => void;
  onOpen: () => void;
  onEdit: () => void;
  rowRef: (el: HTMLLIElement | null) => void;
  /** Desplazamiento vertical mientras hay un arrastre en curso. */
  offset: number;
  dragging: boolean;
  /** Otra fila se está arrastrando: esta se aparta con una transición. */
  settling: boolean;
  onDragStart: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: (commit: boolean) => void;
  onNudge: (direction: -1 | 1) => void;
}) {
  // Solo se arrastran las paradas sin hora: las que tienen hora las coloca
  // la propia hora.
  const timed = timeOf(entry) !== null;
  const notes = stopNotes(entry)?.trim();
  const transit = entry.link.transit;
  const tones = categoryTones(color);

  return (
    <li
      ref={rowRef}
      className={clsx(
        "relative flex gap-2.5",
        settling && "transition-transform duration-150 ease-out",
        dragging && "z-10 rounded-[var(--radius-sm)] bg-surface shadow-[var(--shadow-md)]",
      )}
      style={offset ? { transform: `translateY(${offset}px)` } : undefined}
    >
      <div className="flex h-6 w-11 shrink-0 items-center justify-end">
        {timed ? (
          <button
            onClick={onEdit}
            aria-label="Cambiar la hora"
            className="text-[13px] tabular-nums text-muted-foreground"
          >
            {toLocalTimeValue(entry.link.scheduled_at!)}
          </button>
        ) : (
          // touch-none: sin él, el navegador se queda el gesto para hacer
          // scroll y el arrastre se corta al primer movimiento.
          <button
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={() => onDragEnd(true)}
            onPointerCancel={() => onDragEnd(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") onNudge(-1);
              if (e.key === "ArrowDown") onNudge(1);
            }}
            aria-label="Arrastrar para cambiar el orden"
            className={clsx(
              "flex h-8 w-8 touch-none select-none items-center justify-center text-muted-foreground",
              dragging ? "cursor-grabbing text-foreground" : "cursor-grab",
            )}
          >
            <GripVertical size={18} />
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
          // Los mismos tonos que el pin de esta parada en el mapa.
          style={{ background: tones.fill, color: tones.ink }}
        >
          {order}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <div className={clsx("min-w-0 flex-1", !last && "pb-5")}>
        <div className="flex items-start gap-1">
          <button onClick={onOpen} className="min-w-0 flex-1 text-left">
            <span className="flex min-h-6 items-center gap-1.5">
              <span className="truncate text-[15px] font-medium">{entry.place.name}</span>
              {entry.place.essential && (
                <Star size={13} aria-label="Imprescindible" className="shrink-0 fill-amber-400 text-amber-400" />
              )}
              <span className="shrink-0 text-sm">{emoji}</span>
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
            className="-mr-1.5 flex h-6 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Pencil size={14} />
          </button>
        </div>

        {transit && transit.length > 0 && (
          <div className="mt-2">
            <button
              onClick={onToggleTransit}
              aria-expanded={transitOpen}
              className="flex w-full items-center gap-1.5 text-left"
            >
              <ChevronDown
                size={16}
                className={clsx(
                  "shrink-0 text-muted-foreground transition-transform duration-150 ease-out",
                  !transitOpen && "-rotate-90",
                )}
              />
              {transitOpen ? (
                <span className="text-[13px] font-medium text-muted-foreground">Trayecto</span>
              ) : (
                <TransitSummary steps={transit} />
              )}
            </button>
            {transitOpen && (
              <div className="mt-2">
                <TransitSteps steps={transit} />
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
