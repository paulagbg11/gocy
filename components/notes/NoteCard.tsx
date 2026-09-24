"use client";

import { Check, Link2, Pin } from "lucide-react";
import clsx from "clsx";
import { noteHue, prettyUrl } from "@/lib/notes";
import { useToggleNoteItem } from "@/lib/queries/notes";
import type { Note, NoteItem } from "@/lib/supabase/types";

/** Cuántas casillas se enseñan en el papel antes de resumir el resto. */
const PREVIEW_ITEMS = 4;

/**
 * Inclinación fija por nota. Sale del id y no del índice para que un papel no
 * cambie de ángulo cuando se añade otro por encima.
 */
function tilt(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  return ((hash % 5) - 2) * 0.7;
}

export function NoteCard({
  note,
  items,
  onEdit,
}: {
  note: Note;
  items: NoteItem[];
  onEdit: () => void;
}) {
  const toggleItem = useToggleNoteItem();

  const hue = noteHue(note.color);
  const done = items.filter((i) => i.done).length;
  const preview = items.slice(0, PREVIEW_ITEMS);
  const rest = items.length - preview.length;
  const hasText = !!note.title || !!note.body;

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[var(--radius-md)] shadow-[var(--shadow-md)] transition-opacity duration-200 ease-out",
        note.done && "opacity-55",
      )}
      style={{
        // Degradado suave en vez de un color plano: da el aspecto de papel con
        // algo de luz encima en lugar de un rectángulo de color.
        background: `linear-gradient(158deg,
          color-mix(in oklab, ${hue} 26%, var(--surface)) 0%,
          color-mix(in oklab, ${hue} 14%, var(--surface)) 62%,
          color-mix(in oklab, ${hue} 19%, var(--surface)) 100%)`,
        rotate: `${tilt(note.id)}deg`,
      }}
    >
      {/* Pliegue de la esquina: el mismo truco de siempre, un triángulo con el
          color del fondo encima de una sombra. */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 h-7 w-7"
        style={{
          background: `linear-gradient(135deg, transparent 0 50%, color-mix(in oklab, ${hue} 45%, var(--surface)) 50% 100%)`,
        }}
        aria-hidden
      />

      <div className="p-4 pb-5">
        <div className="flex items-start gap-2">
          <button
            onClick={onEdit}
            className="min-w-0 flex-1 text-left"
            aria-label={`Editar la nota ${note.title || "sin título"}`}
          >
            {note.title ? (
              <p
                className={clsx(
                  "text-[17px] leading-snug font-semibold break-words text-balance",
                  note.done && "line-through decoration-[1.5px]",
                )}
              >
                {note.title}
              </p>
            ) : (
              !note.body && <p className="font-medium text-muted-foreground">Sin título</p>
            )}
            {note.body && (
              <p
                className={clsx(
                  "break-words whitespace-pre-wrap",
                  note.title ? "mt-1 text-[13.5px] text-muted-foreground" : "text-[15px]",
                  note.done && "line-through",
                )}
              >
                {note.body}
              </p>
            )}
          </button>

          {note.pinned && (
            <Pin size={15} className="mt-1 shrink-0 text-accent" fill="currentColor" aria-label="Fijada" />
          )}
        </div>

        {items.length > 0 && (
          <ul className={clsx("-mx-1.5 flex flex-col", hasText && "mt-2.5")}>
            {preview.map((item) => (
              <li key={item.id}>
                {/* Fila alta y a todo lo ancho: antes el objetivo era la
                    casilla de 15 px y se marcaba la línea de al lado sin
                    querer. Ahora se puede tocar en cualquier punto. */}
                <button
                  onClick={() =>
                    toggleItem.mutate({ id: item.id, trip_id: item.trip_id, done: !item.done })
                  }
                  className="flex min-h-[38px] w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-1.5 py-1 text-left active:bg-black/5"
                  aria-pressed={item.done}
                >
                  <span
                    className={clsx(
                      "flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors duration-150 ease-out",
                      item.done ? "border-accent bg-accent text-accent-foreground" : "border-foreground/25",
                    )}
                  >
                    {item.done && <Check size={14} strokeWidth={3.5} />}
                  </span>
                  <span
                    className={clsx(
                      "text-[14.5px] leading-snug break-words",
                      item.done && "text-muted-foreground line-through",
                    )}
                  >
                    {item.text}
                  </span>
                </button>
              </li>
            ))}
            {rest > 0 && (
              <li className="px-1.5 pt-1 text-[13px] text-muted-foreground">+{rest} más</li>
            )}
          </ul>
        )}

        {(note.url || items.length > 0) && (
          <div className="mt-3 flex items-center justify-between gap-2">
            {note.url ? (
              <a
                href={note.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-1 text-[12px] font-medium text-accent"
              >
                <Link2 size={13} className="shrink-0" />
                <span className="truncate">{prettyUrl(note.url)}</span>
              </a>
            ) : (
              <span />
            )}
            {items.length > 0 && (
              <span className="shrink-0 pr-4 text-[12px] font-medium tabular-nums text-muted-foreground">
                {done}/{items.length}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
