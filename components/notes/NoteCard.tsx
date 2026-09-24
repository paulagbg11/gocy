"use client";

import { Check, Link2, Pin } from "lucide-react";
import clsx from "clsx";
import { notePaper, prettyUrl } from "@/lib/notes";
import { useToggleNoteItem } from "@/lib/queries/notes";
import type { Note, NoteItem } from "@/lib/supabase/types";

/** Cuántas casillas se enseñan en el papel antes de resumir el resto. */
const PREVIEW_ITEMS = 5;

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

  const done = items.filter((i) => i.done).length;
  const preview = items.slice(0, PREVIEW_ITEMS);
  const rest = items.length - preview.length;
  const hasText = !!note.title || !!note.body;

  return (
    <div
      className="mb-3 break-inside-avoid rounded-[var(--radius-md)] border p-3.5 shadow-[var(--shadow-sm)]"
      style={{ ...notePaper(note.color), rotate: `${tilt(note.id)}deg` }}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
          aria-label={`Editar la nota ${note.title || "sin título"}`}
        >
          {note.title ? (
            <p className="font-semibold leading-snug text-balance break-words">{note.title}</p>
          ) : (
            !note.body && <p className="font-medium text-muted-foreground">Sin título</p>
          )}
          {note.body && (
            <p
              className={clsx(
                "whitespace-pre-wrap break-words text-[13px] leading-relaxed",
                note.title ? "mt-1 text-muted-foreground" : "text-foreground",
              )}
            >
              {note.body}
            </p>
          )}
        </button>

        {note.pinned && (
          <Pin size={14} className="mt-0.5 shrink-0 text-accent" fill="currentColor" aria-label="Fijada" />
        )}
      </div>

      {items.length > 0 && (
        <ul className={clsx("flex flex-col gap-1", hasText && "mt-2.5")}>
          {preview.map((item) => (
            <li key={item.id}>
              <button
                onClick={() =>
                  toggleItem.mutate({ id: item.id, trip_id: item.trip_id, done: !item.done })
                }
                className="flex w-full items-start gap-2 text-left"
                aria-pressed={item.done}
              >
                <span
                  className={clsx(
                    "mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150 ease-out",
                    item.done
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-foreground/30",
                  )}
                >
                  {item.done && <Check size={11} strokeWidth={3.5} />}
                </span>
                <span
                  className={clsx(
                    "text-[13px] leading-snug break-words",
                    item.done && "text-muted-foreground line-through",
                  )}
                >
                  {item.text}
                </span>
              </button>
            </li>
          ))}
          {rest > 0 && (
            <li className="pl-[23px] text-[13px] text-muted-foreground">
              +{rest} {rest === 1 ? "más" : "más"}
            </li>
          )}
        </ul>
      )}

      {(note.url || items.length > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {note.url ? (
            <a
              href={note.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 items-center gap-1 text-[12px] font-medium text-accent"
            >
              <Link2 size={13} className="shrink-0" />
              <span className="truncate">{prettyUrl(note.url)}</span>
            </a>
          ) : (
            <span />
          )}
          {items.length > 0 && (
            <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
              {done}/{items.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
