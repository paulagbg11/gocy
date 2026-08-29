"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { formatShortDate } from "@/lib/dates";
import type { TripDay } from "@/lib/supabase/types";

interface DaySelectorProps {
  days: TripDay[];
  selectedDayId: string | null; // null = "por decidir"
  onSelect: (dayId: string | null) => void;
  onToggleCompleted: (day: TripDay) => void;
  unassignedCount: number;
}

export function DaySelector({
  days,
  selectedDayId,
  onSelect,
  onToggleCompleted,
  unassignedCount,
}: DaySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pt-4 pb-3 [scrollbar-width:none]">
      {days.map((day) => {
        const selected = selectedDayId === day.id;
        return (
          // Contenedor relativo (no un <button> anidado, que no es HTML válido)
          // para poder colocar el check encima como control independiente.
          <div key={day.id} className="relative shrink-0 pt-1.5 pr-1.5">
            <button
              onClick={() => onSelect(day.id)}
              className={clsx(
                "flex flex-col items-center justify-center rounded-[var(--radius-sm)] px-3.5 h-14 min-w-16 transition-colors duration-150 ease-out",
                selected
                  ? "bg-accent text-accent-foreground"
                  : day.completed
                    ? "bg-surface-2 text-muted-foreground"
                    : "bg-surface-2 text-foreground hover:brightness-95",
              )}
            >
              <span className="text-xs font-medium opacity-80">Día {day.day_index}</span>
              <span className={clsx("text-sm font-semibold", day.completed && !selected && "line-through")}>
                {formatShortDate(day.date)}
              </span>
            </button>

            <button
              onClick={() => onToggleCompleted(day)}
              aria-label={day.completed ? `Día ${day.day_index} completado` : `Marcar Día ${day.day_index} como completado`}
              aria-pressed={day.completed}
              className={clsx(
                "absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border transition-colors duration-150 ease-out",
                day.completed
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-border bg-surface text-muted-foreground/35 hover:text-muted-foreground",
              )}
            >
              <Check size={12} strokeWidth={3} />
            </button>
          </div>
        );
      })}

      <button
        onClick={() => onSelect(null)}
        className={clsx(
          "flex flex-col items-center justify-center shrink-0 self-start mt-1.5 rounded-[var(--radius-sm)] px-3.5 h-14 min-w-20 transition-colors duration-150 ease-out",
          selectedDayId === null
            ? "bg-accent text-accent-foreground"
            : "bg-surface-2 text-foreground hover:brightness-95",
        )}
      >
        <span className="text-xs font-medium opacity-80">Por decidir</span>
        <span className="text-sm font-semibold">{unassignedCount}</span>
      </button>
    </div>
  );
}
