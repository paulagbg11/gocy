"use client";

import { ArrowRight } from "lucide-react";
import { stepColor, textOn, transitModeInfo } from "@/lib/days/transit";
import type { TransitStep } from "@/lib/supabase/types";

/**
 * Los tramos de trayecto de una parada, en grande: pensado para mirarlo con
 * prisa en un andén, no para leerlo como una nota. Arriba la línea con su
 * color y hacia dónde va (lo que pone en el cartel del andén); debajo, dónde
 * subir y dónde bajar.
 */
export function TransitSteps({ steps }: { steps: TransitStep[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <li key={i}>
          <TransitStepCard step={step} />
        </li>
      ))}
    </ol>
  );
}

function TransitStepCard({ step }: { step: TransitStep }) {
  const mode = transitModeInfo(step.mode);
  const color = stepColor(step);
  // Andando no se "sube" ni se "baja" de nada.
  const walk = step.mode === "walk";
  const details = [
    step.stops ? (step.stops === 1 ? "1 parada" : `${step.stops} paradas`) : null,
    step.minutes ? `${step.minutes} min` : null,
  ].filter(Boolean);

  return (
    <div
      className="rounded-[var(--radius-sm)] bg-surface-2 py-2.5 pl-3 pr-3 border-l-[5px]"
      style={{ borderLeftColor: color }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-bold"
          style={{ background: color, color: textOn(color) }}
        >
          <span aria-hidden>{mode.emoji}</span>
          {step.line || mode.label}
        </span>
        {step.direction && (
          <span className="flex min-w-0 items-center gap-1 text-base font-semibold leading-tight">
            <ArrowRight size={16} className="shrink-0" />
            {step.direction}
          </span>
        )}
      </div>

      {(step.from || step.platform) && (
        <p className="mt-1.5 text-[15px] leading-snug">
          {step.from && (
            <>
              <span className="text-muted-foreground">{walk ? "Desde " : "Sube en "}</span>
              <span className="font-medium">{step.from}</span>
            </>
          )}
          {step.from && step.platform && <span className="text-muted-foreground"> · </span>}
          {step.platform && (
            <>
              <span className="text-muted-foreground">Andén </span>
              <span className="font-medium">{step.platform}</span>
            </>
          )}
        </p>
      )}

      {(step.to || details.length > 0) && (
        <p className="mt-0.5 text-[15px] leading-snug">
          {step.to && (
            <>
              <span className="text-muted-foreground">{walk ? "Hasta " : "Baja en "}</span>
              <span className="font-semibold">{step.to}</span>
            </>
          )}
          {details.length > 0 && (
            <span className="text-muted-foreground">
              {step.to ? " · " : ""}
              {details.join(" · ")}
            </span>
          )}
        </p>
      )}

      {step.note && (
        <p className="mt-1 whitespace-pre-line text-[13px] leading-snug text-muted-foreground">
          {step.note}
        </p>
      )}
    </div>
  );
}
