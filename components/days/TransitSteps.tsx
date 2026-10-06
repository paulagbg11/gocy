"use client";

import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { hasLineColor, stepColor, textOn, transitModeInfo } from "@/lib/days/transit";
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

/**
 * El trayecto plegado, en una línea: las líneas que hay que coger, en orden, y
 * lo que se tarda en total.
 */
export function TransitSummary({ steps }: { steps: TransitStep[] }) {
  const minutes = steps.reduce((sum, step) => sum + (step.minutes ?? 0), 0);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {steps.map((step, i) => (
        <LineBadge key={i} step={step} small />
      ))}
      {minutes > 0 && <span className="ml-0.5 text-xs text-muted-foreground">{minutes} min</span>}
    </span>
  );
}

/** La pastilla de la línea. Sin color, va en el gris neutro de la app. */
function LineBadge({ step, small }: { step: TransitStep; small?: boolean }) {
  const mode = transitModeInfo(step.mode);
  const colored = hasLineColor(step);
  const color = stepColor(step);
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center gap-1 rounded-md",
        small ? "px-1.5 py-px text-xs font-semibold" : "px-2 py-0.5 text-sm font-bold",
        !colored && "bg-surface-2 text-foreground",
      )}
      style={colored ? { background: color, color: textOn(color) } : undefined}
    >
      <span aria-hidden>{mode.emoji}</span>
      <span className="truncate">{step.line || mode.label}</span>
    </span>
  );
}

function TransitStepCard({ step }: { step: TransitStep }) {
  // Andando no se "sube" ni se "baja" de nada.
  const walk = step.mode === "walk";
  const details = [
    step.stops ? (step.stops === 1 ? "1 parada" : `${step.stops} paradas`) : null,
    step.minutes ? `${step.minutes} min` : null,
  ].filter(Boolean);

  return (
    <div
      className="rounded-[var(--radius-sm)] border-l-[3px] border-l-surface-2 bg-surface px-3 py-2.5"
      style={hasLineColor(step) ? { borderLeftColor: stepColor(step) } : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <LineBadge step={step} />
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
