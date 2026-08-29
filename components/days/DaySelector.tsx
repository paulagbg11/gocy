"use client";

import clsx from "clsx";
import { formatShortDate } from "@/lib/dates";
import type { TripDay } from "@/lib/supabase/types";

interface DaySelectorProps {
  days: TripDay[];
  selectedDayId: string | null; // null = "por decidir"
  onSelect: (dayId: string | null) => void;
  unassignedCount: number;
}

export function DaySelector({ days, selectedDayId, onSelect, unassignedCount }: DaySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
      {days.map((day) => (
        <button
          key={day.id}
          onClick={() => onSelect(day.id)}
          className={clsx(
            "flex flex-col items-center justify-center shrink-0 rounded-[var(--radius-sm)] px-3.5 h-14 min-w-16 transition-colors duration-150 ease-out",
            selectedDayId === day.id
              ? "bg-accent text-accent-foreground"
              : "bg-surface-2 text-foreground hover:brightness-95",
          )}
        >
          <span className="text-xs font-medium opacity-80">Día {day.day_index}</span>
          <span className="text-sm font-semibold">{formatShortDate(day.date)}</span>
        </button>
      ))}
      <button
        onClick={() => onSelect(null)}
        className={clsx(
          "flex flex-col items-center justify-center shrink-0 rounded-[var(--radius-sm)] px-3.5 h-14 min-w-20 transition-colors duration-150 ease-out",
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
