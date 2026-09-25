"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LINE_COLORS, TRANSIT_MODES, stepColor, textOn } from "@/lib/days/transit";
import type { TransitStep } from "@/lib/supabase/types";

/**
 * Editor de los tramos de trayecto de una parada: uno por cada metro, tren o
 * bus que haya que coger. Todos los campos son opcionales; se rellena lo que
 * se sepa y el resto no aparece en la lista.
 */
export function TransitEditor({
  steps,
  onChange,
}: {
  steps: TransitStep[];
  onChange: (steps: TransitStep[]) => void;
}) {
  const update = (index: number, patch: Partial<TransitStep>) =>
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const remove = (index: number) => onChange(steps.filter((_, i) => i !== index));
  const add = () => {
    // El siguiente tramo sale de donde se bajó en el anterior.
    const last = steps[steps.length - 1];
    onChange([...steps, { mode: last?.mode ?? "metro", from: last?.to }]);
  };

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {steps.length > 1 ? `Tramo ${i + 1}` : "Tramo"}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Quitar tramo"
              className="p-1 text-muted-foreground hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TRANSIT_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => update(i, { mode: mode.value })}
                className={clsx(
                  "rounded-full px-2.5 py-1 text-sm transition-colors duration-150 ease-out",
                  step.mode === mode.value
                    ? "bg-accent text-accent-foreground"
                    : "bg-surface-2 text-foreground",
                )}
              >
                {mode.emoji} {mode.label}
              </button>
            ))}
          </div>

          {step.mode !== "walk" && (
            <>
              <Field label="Línea">
                <Input
                  placeholder="Victoria, Suffragette…"
                  value={step.line ?? ""}
                  onChange={(e) => update(i, { line: e.target.value })}
                />
              </Field>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color de la línea">
                {LINE_COLORS.map((color) => {
                  const selected = stepColor(step) === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`Color ${color}`}
                      onClick={() => update(i, { color })}
                      className={clsx(
                        "flex h-7 w-7 items-center justify-center rounded-full",
                        selected && "ring-2 ring-offset-2 ring-foreground",
                      )}
                      style={{ background: color }}
                    >
                      {selected && <Check size={14} color={textOn(color)} />}
                    </button>
                  );
                })}
              </div>
              <Field label="Dirección">
                <Input
                  placeholder="Lo que pone en el andén"
                  value={step.direction ?? ""}
                  onChange={(e) => update(i, { direction: e.target.value })}
                />
              </Field>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Field label={step.mode === "walk" ? "Desde" : "Subir en"}>
              <Input
                value={step.from ?? ""}
                onChange={(e) => update(i, { from: e.target.value })}
              />
            </Field>
            <Field label={step.mode === "walk" ? "Hasta" : "Bajar en"}>
              <Input
                value={step.to ?? ""}
                onChange={(e) => update(i, { to: e.target.value })}
              />
            </Field>
          </div>

          <div className={clsx("grid gap-2", step.mode === "walk" ? "grid-cols-1" : "grid-cols-3")}>
            {step.mode !== "walk" && (
              <>
                <Field label="Andén">
                  <Input
                    value={step.platform ?? ""}
                    onChange={(e) => update(i, { platform: e.target.value })}
                  />
                </Field>
                <Field label="Paradas">
                  <NumberInput
                    value={step.stops}
                    onChange={(stops) => update(i, { stops })}
                  />
                </Field>
              </>
            )}
            <Field label="Minutos">
              <NumberInput
                value={step.minutes}
                onChange={(minutes) => update(i, { minutes })}
              />
            </Field>
          </div>

          <Field label="Nota">
            <Textarea
              rows={2}
              placeholder="Salida, vagón, billete…"
              value={step.note ?? ""}
              onChange={(e) => update(i, { note: e.target.value })}
            />
          </Field>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={add}>
        <Plus size={16} />
        {steps.length === 0 ? "Añadir trayecto" : "Añadir otro tramo"}
      </Button>
    </div>
  );
}

/** Etiqueta pequeña encima: sin ella, con el campo ya relleno no se sabía si "6" eran paradas o minutos. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <Input
      inputMode="numeric"
      value={value ?? ""}
      onChange={(e) => {
        const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
        onChange(Number.isNaN(n) ? undefined : n);
      }}
    />
  );
}
