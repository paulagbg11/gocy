"use client";

import { useMemo, useState } from "react";
import { Map, Marker } from "@vis.gl/react-google-maps";
import { useCategoriesById } from "@/lib/queries/categories";
import { distanceMeters, formatDistance, type LatLng } from "@/lib/geo";
import { MapProvider } from "@/components/map/MapProvider";
import { CategoryPin } from "@/components/map/CategoryPin";
import { FitBounds } from "@/components/map/FitBounds";
import { MapResizeFix } from "@/components/map/MapResizeFix";
import { PlaceSearchBox, type SelectedPlace } from "@/components/map/PlaceSearchBox";
import { useUpdatePlace } from "@/lib/queries/places";
import { byName } from "@/lib/places";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Place } from "@/lib/supabase/types";

export interface ZoneDraft {
  /** El nombre con el que está guardada, o null si es nueva (o era automática). */
  originalName: string | null;
  name: string;
  placeIds: string[];
}

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 };

/**
 * Crear o editar una zona a mano. Lo normal es buscar un barrio o un sitio
 * del mapa ("Soho", "Camden"): la zona coge su nombre y se marcan solos los
 * lugares sin día que quedan dentro del radio, y luego se ajusta a mano.
 *
 * La zona es solo ese nombre apuntado en cada lugar, así que "deshacerla" es
 * quitárselo a todos; los lugares no se tocan. El punto buscado no se guarda:
 * al reabrirla, las distancias se miden desde el centro de sus lugares.
 */
export function ZoneEditorSheet({
  tripId,
  draft,
  places,
  unassigned,
  radius,
  onClose,
}: {
  tripId: string;
  draft: ZoneDraft | null;
  /** Radio de cercanía del viaje, en metros. */
  radius: number;
  /** Todos los del viaje: al renombrar, también cambian los que ya tienen día. */
  places: Place[];
  unassigned: Place[];
  onClose: () => void;
}) {
  return (
    <Sheet open={!!draft} onClose={onClose} title={draft?.originalName ? "Editar zona" : "Nueva zona"}>
      {draft && (
        <ZoneEditor
          // Con key: cada zona que se abre empieza con sus propios datos.
          key={`${draft.originalName}|${draft.placeIds.join(",")}`}
          tripId={tripId}
          draft={draft}
          places={places}
          unassigned={unassigned}
          radius={radius}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function ZoneEditor({
  tripId,
  draft,
  places,
  unassigned,
  radius,
  onClose,
}: {
  tripId: string;
  draft: ZoneDraft;
  radius: number;
  places: Place[];
  unassigned: Place[];
  onClose: () => void;
}) {
  const updatePlace = useUpdatePlace();
  const [name, setName] = useState(draft.name);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(draft.placeIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriesById = useCategoriesById();

  // El punto buscado en el mapa. Al editar una zona que ya existe no hay
  // ninguno: se usa el centro de sus lugares.
  const [searched, setSearched] = useState<LatLng | null>(null);
  const center = useMemo<LatLng | null>(() => {
    if (searched) return searched;
    const members = unassigned.filter((p) => draft.placeIds.includes(p.id));
    if (members.length === 0) return null;
    return {
      lat: members.reduce((sum, p) => sum + p.lat, 0) / members.length,
      lng: members.reduce((sum, p) => sum + p.lng, 0) / members.length,
    };
  }, [searched, unassigned, draft.placeIds]);

  const pickArea = (area: SelectedPlace) => {
    setSearched({ lat: area.lat, lng: area.lng });
    setName(area.name);
    setSelected(
      new Set(unassigned.filter((p) => distanceMeters(area, p) <= radius).map((p) => p.id)),
    );
    setError(null);
  };

  // Con centro, por cercanía a él; sin centro (zona nueva sin buscar), A–Z.
  const options = useMemo(
    () =>
      unassigned
        .map((place) => ({ place, meters: center ? distanceMeters(center, place) : null }))
        .sort((a, b) =>
          a.meters !== null && b.meters !== null ? a.meters - b.meters : byName(a.place, b.place),
        ),
    [unassigned, center],
  );

  const mapPoints = useMemo(() => {
    const inZone = unassigned.filter((p) => selected.has(p.id));
    const shown = inZone.length > 0 ? inZone : unassigned;
    return [...(searched ? [searched] : []), ...shown].map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [unassigned, selected, searched]);

  const toggle = (placeId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(placeId)) next.add(placeId);
      return next;
    });

  /** Guarda en cada lugar la zona que le toca, solo en los que cambia. */
  const apply = async (zoneOf: (place: Place) => string | null) => {
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        places.flatMap((place) => {
          const zone = zoneOf(place);
          return zone === (place.zone ?? null)
            ? []
            : [updatePlace.mutateAsync({ id: place.id, trip_id: tripId, zone })];
        }),
      );
      onClose();
    } catch {
      setError("No se ha podido guardar. Si es la primera vez, falta ejecutar la migración 0016 en Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    const zoneName = name.trim();
    if (!zoneName) return setError("Ponle un nombre a la zona.");
    if (selected.size === 0) return setError("Elige al menos un lugar.");
    const listed = new Set(unassigned.map((p) => p.id));
    apply((place) => {
      if (selected.has(place.id)) return zoneName;
      const current = place.zone ?? null;
      if (current !== draft.originalName || current === null) return current;
      // Era de esta zona. Si está en la lista y se ha desmarcado, sale; si ya
      // tiene día (no está en la lista), solo se le cambia el nombre.
      return listed.has(place.id) ? null : zoneName;
    });
  };

  const dissolve = () =>
    apply((place) => (place.zone === draft.originalName ? null : (place.zone ?? null)));

  return (
    <div className="flex flex-col gap-4">
      <MapProvider>
        <PlaceSearchBox onSelect={pickArea} placeholder="Buscar un barrio o un sitio: Soho, Camden…" />
        <div className="h-52 overflow-hidden rounded-[var(--radius-md)]">
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
            {/* Solo se reencuadra al abrir y al buscar: marcar y desmarcar no mueve el mapa. */}
            <FitBounds
              points={mapPoints}
              fitKey={searched ? `${searched.lat},${searched.lng}` : "inicio"}
              // Poco margen: el mapa es bajito y cada píxel de margen aleja el zoom.
              padding={{ top: 44, bottom: 4, left: 24, right: 24 }}
            />
            {searched && <Marker position={searched} title="Lo que has buscado" />}
            {unassigned.map((place) => (
              <CategoryPin
                key={place.id}
                place={place}
                category={categoriesById.get(place.category_id)}
                selected={selected.has(place.id)}
                onClick={() => toggle(place.id)}
              />
            ))}
          </Map>
        </div>
      </MapProvider>

      <div>
        <Label htmlFor="zone-name">Nombre</Label>
        <Input
          id="zone-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Westminster, día de mercados…"
        />
      </div>

      <div>
        <Label>Lugares sin día ({selected.size})</Label>
        <ul className="-mx-2 max-h-[28vh] divide-y divide-border overflow-y-auto">
          {options.map(({ place, meters }) => (
            <li key={place.id}>
              <label className="flex items-center gap-3 px-2 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(place.id)}
                  onChange={() => toggle(place.id)}
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{place.name}</span>
                  {(meters !== null || (place.zone && place.zone !== draft.originalName)) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        meters !== null ? `a ${formatDistance(meters)}` : null,
                        place.zone && place.zone !== draft.originalName ? `ahora en «${place.zone}»` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        {draft.originalName && (
          <Button type="button" variant="secondary" onClick={dissolve} disabled={saving}>
            Deshacer zona
          </Button>
        )}
        <Button type="button" size="lg" onClick={save} disabled={saving} className="flex-1">
          {saving ? "Guardando…" : "Guardar zona"}
        </Button>
      </div>
    </div>
  );
}
