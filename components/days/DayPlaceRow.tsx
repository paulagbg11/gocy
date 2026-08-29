"use client";

import { ChevronUp, ChevronDown, X, Clock } from "lucide-react";
import { CATEGORY_META } from "@/lib/categories";
import type { Place } from "@/lib/supabase/types";

interface DayPlaceRowProps {
  place: Place;
  order: number;
  scheduledAt?: string | null;
  onOpen: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function DayPlaceRow({
  place,
  order,
  scheduledAt,
  onOpen,
  onRemove,
  onMoveUp,
  onMoveDown,
}: DayPlaceRowProps) {
  const meta = CATEGORY_META[place.category];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-surface px-3 py-2.5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col shrink-0">
        <button
          onClick={onMoveUp}
          disabled={!onMoveUp}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          aria-label="Subir"
        >
          <ChevronUp size={16} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={!onMoveDown}
          className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          aria-label="Bajar"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{ background: meta.color }}
      >
        {order}
      </span>

      <button onClick={onOpen} className="flex-1 flex items-center gap-2 min-w-0 text-left">
        <Icon size={16} className="shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{place.name}</span>
      </button>

      {scheduledAt && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock size={12} />
          {new Date(scheduledAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}

      <button
        onClick={onRemove}
        aria-label="Quitar del día"
        className="shrink-0 text-muted-foreground hover:text-danger p-1"
      >
        <X size={16} />
      </button>
    </div>
  );
}
