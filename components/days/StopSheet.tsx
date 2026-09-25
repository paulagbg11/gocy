"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { toLocalTimeValue, type ItineraryEntry } from "@/lib/days/itinerary";
import { cleanSteps } from "@/lib/days/transit";
import { TransitEditor } from "./TransitEditor";
import type { TransitStep } from "@/lib/supabase/types";

interface StopSheetProps {
  entry: ItineraryEntry | null;
  /** Aeropuerto, estación…: el trayecto sale ya abierto. */
  isTransport: boolean;
  onClose: () => void;
  /** `time` es "HH:mm", o "" para dejar la parada sin hora. */
  onSave: (entry: ItineraryEntry, time: string, notes: string, transit: TransitStep[] | null) => void;
  onRemove: (entry: ItineraryEntry) => void;
}

/** Hora, trayecto y nota de una parada del día. */
export function StopSheet({ entry, isTransport, onClose, onSave, onRemove }: StopSheetProps) {
  return (
    <Sheet open={!!entry} onClose={onClose} title={entry?.place.name}>
      {/* key: al abrir otra parada, el formulario empieza con sus valores. */}
      {entry && (
        <StopForm
          key={entry.link.id}
          entry={entry}
          isTransport={isTransport}
          onSave={onSave}
          onRemove={onRemove}
        />
      )}
    </Sheet>
  );
}

function StopForm({
  entry,
  isTransport,
  onSave,
  onRemove,
}: {
  entry: ItineraryEntry;
  isTransport: boolean;
  onSave: StopSheetProps["onSave"];
  onRemove: StopSheetProps["onRemove"];
}) {
  const [time, setTime] = useState(
    entry.link.scheduled_at ? toLocalTimeValue(entry.link.scheduled_at) : "",
  );
  const [notes, setNotes] = useState(entry.place.notes ?? "");
  // En una estación sin trayecto todavía, se empieza con un tramo en blanco
  // para que los campos ya estén a la vista. Si se deja vacío, no se guarda.
  const [transit, setTransit] = useState<TransitStep[]>(
    entry.link.transit ?? (isTransport ? [{ mode: "metro" }] : []),
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(entry, time, notes, cleanSteps(transit));
      }}
    >
      <div>
        <Label htmlFor="stop-time">Hora</Label>
        <div className="flex gap-2">
          <Input
            id="stop-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1"
          />
          {/* En iOS el selector de hora no deja vaciarlo: sin este botón,
              una vez puesta la hora no había forma de quitarla. */}
          <Button type="button" variant="secondary" onClick={() => setTime("")} disabled={!time}>
            Sin hora
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Sin hora, la parada se mueve con las flechas y se queda donde la pongas.
        </p>
      </div>

      <div>
        <Label>Trayecto a la siguiente parada</Label>
        <TransitEditor steps={transit} onChange={setTransit} />
      </div>

      <div>
        <Label htmlFor="stop-notes">Notas</Label>
        <Textarea
          id="stop-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Entradas, qué pedir, por dónde entrar…"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Son las notas del lugar: también salen en su ficha del mapa.
        </p>
      </div>

      <div className="flex gap-2 mt-1">
        <Button type="button" variant="danger" onClick={() => onRemove(entry)}>
          Quitar del día
        </Button>
        <Button type="submit" size="lg" className="flex-1">
          Guardar
        </Button>
      </div>
    </form>
  );
}
