"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, MapPin, Pencil, Plus, Star } from "lucide-react";
import clsx from "clsx";
import { FALLBACK_CATEGORY_COLOR, FALLBACK_CATEGORY_EMOJI, categoryTones } from "@/lib/categories";
import { useCategoriesById } from "@/lib/queries/categories";
import Link from "next/link";
import { useUpdatePlace } from "@/lib/queries/places";
import { useTrip } from "@/lib/queries/trips";
import { nextOrderInDay, useAssignPlaceToDay } from "@/lib/queries/place-day-links";
import { ESSENTIAL_MIGRATION_HINT, byName, isMissingEssentialColumn } from "@/lib/places";
import { distanceMeters } from "@/lib/geo";
import { ZONE_RADIUS_M, formatRadius, groupByZone, isZoneAnchor } from "@/lib/days/nearby";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ExportTripPdf } from "./ExportTripPdf";
import { ZoneEditorSheet, type ZoneDraft } from "./ZoneEditorSheet";
import type { Category, Place, PlaceDayLink, TripDay } from "@/lib/supabase/types";

/**
 * "Por decidir": lo que está guardado y todavía no tiene día. Pensado para
 * ver de un vistazo cuánto falta por repartir: arriba el avance y lo
 * imprescindible, y debajo el resto por categorías, en orden alfabético.
 */
export function UnassignedPlaces({
  tripId,
  places,
  unassigned,
  days,
  links,
  onOpenPlace,
}: {
  tripId: string;
  /** Todos los lugares del viaje, para el avance. */
  places: Place[];
  unassigned: Place[];
  days: TripDay[];
  links: PlaceDayLink[];
  onOpenPlace: (placeId: string) => void;
}) {
  const categoriesById = useCategoriesById();
  const assign = useAssignPlaceToDay();
  const updatePlace = useUpdatePlace();

  const essentials = useMemo(() => unassigned.filter((p) => p.essential).sort(byName), [unassigned]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, Place[]>();
    for (const place of unassigned) {
      if (place.essential) continue;
      byCategory.set(place.category_id, [...(byCategory.get(place.category_id) ?? []), place]);
    }
    return [...byCategory.entries()]
      .map(([categoryId, list]) => ({
        id: categoryId,
        category: categoriesById.get(categoryId),
        places: list.sort(byName),
      }))
      .sort((a, b) => (a.category?.sort_order ?? 999) - (b.category?.sort_order ?? 999));
  }, [unassigned, categoriesById]);

  // "Por zona" contesta a lo que la lista por categorías no dice: qué queda al
  // lado de qué, y por tanto qué conviene meter en el mismo día.
  const [view, setView] = useState<"category" | "zone">("category");

  // El radio se ajusta por viaje en Ajustes: Londres a pie no es la Toscana
  // en coche.
  const { data: trip } = useTrip(tripId);
  const radius = trip?.zone_radius_m ?? ZONE_RADIUS_M;

  const [editingZone, setEditingZone] = useState<ZoneDraft | null>(null);

  const zones = useMemo(() => {
    const essentialFirst = (a: Place, b: Place) =>
      Number(!!b.essential) - Number(!!a.essential) || byName(a, b);
    const placesById = new Map(places.map((p) => [p.id, p]));
    // Los días que ya pasan por la zona: es la pista de a cuál añadirla.
    const daysNear = (members: Place[]) =>
      days.filter((day) =>
        links.some((link) => {
          if (link.day_id !== day.id) return false;
          const stop = placesById.get(link.place_id);
          return (
            !!stop &&
            isZoneAnchor(categoriesById.get(stop.category_id)) &&
            members.some((member) => distanceMeters(member, stop) <= radius)
          );
        }),
      );

    // Las zonas puestas a mano mandan: sus lugares no entran en las automáticas.
    const manualNames = [...new Set(unassigned.flatMap((p) => (p.zone ? [p.zone] : [])))].sort(
      (a, b) => a.localeCompare(b, "es", { sensitivity: "base" }),
    );
    const manual = manualNames.map((name) => {
      const members = unassigned.filter((p) => p.zone === name).sort(essentialFirst);
      return { key: `manual:${name}`, name, manual: true, places: members, nearDays: daysNear(members) };
    });

    // En las automáticas los imprescindibles van dentro de su zona, no
    // aparte: lo que importa es qué tienen alrededor.
    const auto = groupByZone(
      unassigned.filter((p) => !p.zone),
      radius,
    );
    return {
      groups: [
        ...manual,
        // Las zonas con más sitios primero: son las que llenan un día.
        ...auto
          .filter((z) => z.places.length > 1)
          .sort((a, b) => b.places.length - a.places.length)
          .map((z) => ({
            key: z.center.id,
            // La zona se llama como su imprescindible más céntrico, si lo
            // tiene: suena más que el sitio que casualmente cae en medio.
            name: (
              z.places
                .filter((p) => p.essential)
                .sort((a, b) => distanceMeters(z.center, a) - distanceMeters(z.center, b))[0] ?? z.center
            ).name,
            manual: false,
            places: z.places.sort(essentialFirst),
            nearDays: daysNear(z.places),
          })),
      ],
      // Lo que no tiene nada guardado cerca va junto al final.
      alone: auto.filter((z) => z.places.length === 1).map((z) => z.center).sort(essentialFirst),
    };
  }, [unassigned, places, days, links, categoriesById, radius]);

  const assignedCount = places.length - unassigned.length;
  const progress = places.length > 0 ? assignedCount / places.length : 0;

  const assignTo = (place: Place, dayId: string) =>
    assign.mutate({
      trip_id: tripId,
      place_id: place.id,
      day_id: dayId,
      order_in_day: nextOrderInDay(links, dayId),
    });

  const toggleEssential = (place: Place) =>
    updatePlace.mutate(
      { id: place.id, trip_id: tripId, essential: !place.essential },
      {
        onError: (err) =>
          alert(isMissingEssentialColumn(err) ? ESSENTIAL_MIGRATION_HINT : "No se ha podido guardar."),
      },
    );

  const row = (place: Place) => (
    <PlaceRow
      key={place.id}
      place={place}
      category={categoriesById.get(place.category_id)}
      days={days}
      onOpen={() => onOpenPlace(place.id)}
      onAssign={(dayId) => assignTo(place, dayId)}
      onToggleEssential={() => toggleEssential(place)}
    />
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-1 pb-4">
      <div className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold leading-none tabular-nums">{unassigned.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {unassigned.length === 1 ? "lugar sin día" : "lugares sin día"}
              {essentials.length > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {essentials.length === 1 ? "1 imprescindible" : `${essentials.length} imprescindibles`}
                  </span>
                </>
              )}
            </p>
          </div>
          <ExportTripPdf tripId={tripId} />
        </div>
        {places.length > 0 && (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {assignedCount} de {places.length} guardados ya tienen día
            </p>
          </>
        )}
      </div>

      {unassigned.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">Todo está organizado 🎉</p>
      )}

      {unassigned.length > 0 && (
        <SegmentedControl
          className="mt-5 w-full [&>button]:flex-1"
          options={[
            { value: "category", label: "Por categoría" },
            { value: "zone", label: "Por zona" },
          ]}
          value={view}
          onChange={setView}
        />
      )}

      {view === "category" && essentials.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 dark:text-amber-300">
            <Star size={14} className="fill-amber-400 text-amber-400" />
            Imprescindibles sin día
          </h2>
          <ul className="divide-y divide-border rounded-[var(--radius-md)] bg-amber-400/10 px-3">
            {essentials.map(row)}
          </ul>
        </section>
      )}

      {view === "zone" && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Se juntan solos los que quedan a menos de {formatRadius(radius)}.{" "}
            <Link href={`/trips/${tripId}/settings#cercania`} className="font-medium text-accent">
              Cambiar
            </Link>
          </p>
          <button
            onClick={() => setEditingZone({ originalName: null, name: "", placeIds: [] })}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-muted-foreground/40 py-2 text-sm font-medium text-accent"
          >
            <Plus size={16} />
            Nueva zona
          </button>
          {zones.groups.map((zone) => (
            <section key={zone.key} className="mt-5">
              <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                <MapPin
                  size={14}
                  className={clsx("shrink-0 text-accent", zone.manual && "fill-accent/25")}
                />
                <span className="truncate">{zone.manual ? zone.name : `Zona de ${zone.name}`}</span>
                <span className="shrink-0 font-normal tabular-nums">· {zone.places.length}</span>
                {/* Una zona automática también se puede editar: al guardarla pasa a ser vuestra. */}
                <button
                  onClick={() =>
                    setEditingZone({
                      originalName: zone.manual ? zone.name : null,
                      name: zone.manual ? zone.name : `Zona de ${zone.name}`,
                      placeIds: zone.places.map((p) => p.id),
                    })
                  }
                  aria-label={`Editar la zona ${zone.name}`}
                  className="-my-1 ml-auto flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground"
                >
                  <Pencil size={13} />
                </button>
              </h2>
              <p className="mb-1 pl-5 text-xs text-muted-foreground">
                {zone.nearDays.length > 0
                  ? `Ya pasáis cerca el ${zone.nearDays.map((d) => `Día ${d.day_index}`).join(", ")}`
                  : "Ningún día pasa cerca todavía"}
              </p>
              <ul className="divide-y divide-border">{zone.places.map(row)}</ul>
            </section>
          ))}
          {zones.alone.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-1 text-[13px] font-semibold text-muted-foreground">
                Más apartados <span className="font-normal tabular-nums">· {zones.alone.length}</span>
              </h2>
              <ul className="divide-y divide-border">{zones.alone.map(row)}</ul>
            </section>
          )}
        </>
      )}

      {view === "category" && groups.map(({ id, category, places: list }) => (
        <section key={id} className="mt-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: categoryTones(category?.color ?? FALLBACK_CATEGORY_COLOR).edge }}
            />
            {category?.name ?? "Sin categoría"}
            <span className="font-normal tabular-nums">· {list.length}</span>
          </h2>
          <ul className="divide-y divide-border">{list.map(row)}</ul>
        </section>
      ))}
      <ZoneEditorSheet
        tripId={tripId}
        draft={editingZone}
        places={places}
        unassigned={unassigned}
        onClose={() => setEditingZone(null)}
      />
    </div>
  );
}

function PlaceRow({
  place,
  category,
  days,
  onOpen,
  onAssign,
  onToggleEssential,
}: {
  place: Place;
  category: Category | undefined;
  days: TripDay[];
  onOpen: () => void;
  onAssign: (dayId: string) => void;
  onToggleEssential: () => void;
}) {
  const color = category?.color ?? FALLBACK_CATEGORY_COLOR;
  return (
    <li className="flex items-center gap-2.5 py-2">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px]"
        style={{ background: categoryTones(color).fill }}
      >
        {category?.emoji ?? FALLBACK_CATEGORY_EMOJI}
      </span>
      <button onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[15px] font-medium">
        {place.name}
      </button>
      <button
        onClick={onToggleEssential}
        aria-pressed={!!place.essential}
        aria-label={place.essential ? "Quitar de imprescindibles" : "Marcar como imprescindible"}
        className="flex h-8 w-8 shrink-0 items-center justify-center"
      >
        <Star
          size={18}
          className={clsx(
            place.essential ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50",
          )}
        />
      </button>
      {days.length > 0 && (
        // El desplegable nativo, invisible encima del botón: en el móvil abre
        // la rueda del sistema, que es más cómoda que una lista propia.
        <span className="relative flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent/10 px-2.5 text-[13px] font-medium text-accent">
          <CalendarPlus size={14} />
          Día
          <select
            value=""
            aria-label={`Asignar ${place.name} a un día`}
            onChange={(e) => e.target.value && onAssign(e.target.value)}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          >
            <option value="" disabled>
              Asignar a…
            </option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                Día {d.day_index}
              </option>
            ))}
          </select>
        </span>
      )}
    </li>
  );
}
