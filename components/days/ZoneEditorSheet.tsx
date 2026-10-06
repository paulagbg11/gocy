"use client";

import { useMemo, useState } from "react";
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

/**
 * Crear o editar una zona a mano: un nombre y los lugares sin día que entran
 * en ella. La zona es solo ese nombre apuntado en cada lugar, así que
 * "deshacerla" es quitárselo a todos; los lugares no se tocan.
 */
export function ZoneEditorSheet({
  tripId,
  draft,
  places,
  unassigned,
  onClose,
}: {
  tripId: string;
  draft: ZoneDraft | null;
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
  onClose,
}: {
  tripId: string;
  draft: ZoneDraft;
  places: Place[];
  unassigned: Place[];
  onClose: () => void;
}) {
  const updatePlace = useUpdatePlace();
  const [name, setName] = useState(draft.name);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(draft.placeIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los que ya estaban en la zona, arriba; el resto, por orden alfabético.
  const options = useMemo(() => {
    const initial = new Set(draft.placeIds);
    return [...unassigned].sort(
      (a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id)) || byName(a, b),
    );
  }, [unassigned, draft.placeIds]);

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
        <ul className="-mx-2 max-h-[40vh] divide-y divide-border overflow-y-auto">
          {options.map((place) => (
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
                  {place.zone && place.zone !== draft.originalName && (
                    <span className="block truncate text-xs text-muted-foreground">
                      Ahora en «{place.zone}»
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
