"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Chip } from "@/components/ui/Chip";
import { toLocalTimeValue, type ItineraryEntry, type StopMark } from "@/lib/days/itinerary";
import { cleanSteps } from "@/lib/days/transit";
import { TransitEditor } from "./TransitEditor";
import type { TransitStep } from "@/lib/supabase/types";

interface StopSheetProps {
  entry: ItineraryEntry | null;
  /** Aeropuerto, estación…: el trayecto sale ya abierto. */
  isTransport: boolean;
  /** En cuántos otros días aparece este lugar (para ofrecer copiar la nota). */
  otherVisits: number;
  /** Todas las paradas del día, con su número: para agruparlas como opciones. */
  dayStops: { entry: ItineraryEntry; mark: StopMark }[];
  onClose: () => void;
  /**
   * `time` es "HH:mm", o "" para dejar la parada sin hora. `choiceWith` son las
   * otras paradas del día (por id) entre las que hay que elegir junto a esta.
   */
  onSave: (
    entry: ItineraryEntry,
    time: string,
    notes: string,
    transit: TransitStep[] | null,
    copyNotesToAllVisits: boolean,
    choiceWith: string[],
  ) => void;
  onRemove: (entry: ItineraryEntry) => void;
}

/** Hora, trayecto y nota de una parada del día. */
export function StopSheet({
  entry,
  isTransport,
  otherVisits,
  dayStops,
  onClose,
  onSave,
  onRemove,
}: StopSheetProps) {
  return (
    <Sheet open={!!entry} onClose={onClose} title={entry?.place.name}>
      {/* key: al abrir otra parada, el formulario empieza con sus valores. */}
      {entry && (
        <StopForm
          key={entry.link.id}
          entry={entry}
          isTransport={isTransport}
          otherVisits={otherVisits}
          dayStops={dayStops}
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
  otherVisits,
  dayStops,
  onSave,
  onRemove,
}: {
  entry: ItineraryEntry;
  isTransport: boolean;
  otherVisits: number;
  dayStops: StopSheetProps["dayStops"];
  onSave: StopSheetProps["onSave"];
  onRemove: StopSheetProps["onRemove"];
}) {
  const [time, setTime] = useState(
    entry.link.scheduled_at ? toLocalTimeValue(entry.link.scheduled_at) : "",
  );
  // Sin la migración 0012 la parada no tiene nota propia (undefined) y se
  // parte de la del lugar, que es la que se veía hasta ahora.
  const [notes, setNotes] = useState(
    (entry.link.notes === undefined ? entry.place.notes : entry.link.notes) ?? "",
  );
  // Por defecto la nota es solo de este día: la del check-in del hotel no
  // pinta nada en los demás.
  const [copyToAll, setCopyToAll] = useState(false);
  // En una estación sin trayecto todavía, se empieza con un tramo en blanco
  // para que los campos ya estén a la vista. Si se deja vacío, no se guarda.
  const [transit, setTransit] = useState<TransitStep[]>(
    entry.link.transit ?? (isTransport ? [{ mode: "metro" }] : []),
  );

  // Las otras paradas del día y, marcadas, las que ya son opción junto a esta.
  const others = dayStops.filter((s) => s.entry.link.id !== entry.link.id);
  const ownGroup = dayStops.find((s) => s.entry.link.id === entry.link.id)?.mark.choice?.group;
  const [choiceWith, setChoiceWith] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        others
          .filter((s) => ownGroup && s.mark.choice?.group === ownGroup)
          .map((s) => s.entry.link.id),
      ),
  );
  const toggleChoice = (linkId: string) =>
    setChoiceWith((current) => {
      const next = new Set(current);
      if (!next.delete(linkId)) next.add(linkId);
      return next;
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(entry, time, notes, cleanSteps(transit), copyToAll, [...choiceWith]);
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
          Solo para este día. Las notas generales del lugar están en su ficha del mapa.
        </p>
        {otherVisits > 0 && (
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={copyToAll}
              onChange={(e) => setCopyToAll(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              Copiar también a{" "}
              {otherVisits === 1 ? "la otra vez" : `las otras ${otherVisits} veces`} que sale este
              lugar
            </span>
          </label>
        )}
      </div>

      {others.length > 0 && (
        <div>
          <Label>A elegir entre varias</Label>
          <div className="flex flex-wrap gap-2">
            {others.map(({ entry: other, mark }) => (
              <Chip
                key={other.link.id}
                active={choiceWith.has(other.link.id)}
                onClick={() => toggleChoice(other.link.id)}
                className="max-w-full"
              >
                <span className="truncate">
                  {mark.label} · {other.place.name}
                </span>
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {choiceWith.size > 0
              ? "Saldrán juntas como opciones: se va a una de ellas, no a todas."
              : "Marca las paradas que son alternativa a esta (varios sitios para cenar, por ejemplo): saldrán juntas como opciones en vez de una detrás de otra."}
          </p>
        </div>
      )}

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
