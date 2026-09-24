"use client";

import { useMemo, useState } from "react";
import { Plus, StickyNote } from "lucide-react";
import { useNoteItems, useNotes } from "@/lib/queries/notes";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";
import type { Note, NoteItem } from "@/lib/supabase/types";

/**
 * Alto aproximado de un papel, para repartirlos entre las dos columnas sin
 * medir nada en pantalla. No tiene que ser exacto: solo evitar que una columna
 * quede mucho más larga que la otra.
 */
function weight(note: Note, items: NoteItem[]) {
  return (
    3 +
    Math.ceil(note.title.length / 16) +
    Math.ceil((note.body?.length ?? 0) / 22) +
    Math.min(items.length, 4) * 2 +
    (items.length > 4 ? 1 : 0) +
    (note.url ? 1 : 0)
  );
}

export function NotesScreen({ tripId }: { tripId: string }) {
  const { data: notes = [], isLoading } = useNotes(tripId);
  const { data: items = [] } = useNoteItems(tripId);

  const [editing, setEditing] = useState<Note | null>(null);
  const [open, setOpen] = useState(false);

  const itemsByNote = useMemo(() => {
    const map = new Map<string, NoteItem[]>();
    for (const item of items) {
      const list = map.get(item.note_id);
      if (list) list.push(item);
      else map.set(item.note_id, [item]);
    }
    return map;
  }, [items]);

  /**
   * Dos columnas repartidas a mano en vez de `columns-2`.
   *
   * Con columnas CSS el navegador partía la tarjeta entre una columna y la
   * siguiente pese a `break-inside-avoid`, y dejaba en la segunda un trocito
   * del borde: esa era la "línea rara" que aparecía al lado de la nota.
   */
  const columns = useMemo(() => {
    const ordered = [...notes].sort(
      (a, b) => Number(a.done) - Number(b.done) || Number(b.pinned) - Number(a.pinned),
    );
    const left: Note[] = [];
    const right: Note[] = [];
    let leftWeight = 0;
    let rightWeight = 0;
    for (const note of ordered) {
      const w = weight(note, itemsByNote.get(note.id) ?? []);
      if (leftWeight <= rightWeight) {
        left.push(note);
        leftWeight += w;
      } else {
        right.push(note);
        rightWeight += w;
      }
    }
    return [left, right];
  }, [notes, itemsByNote]);

  const openEditor = (note: Note | null) => {
    setEditing(note);
    setOpen(true);
  };

  // La nota que se está editando se lee de la lista viva, no del estado: así
  // el panel refleja lo que cambie la otra persona mientras está abierto.
  const current = editing ? (notes.find((n) => n.id === editing.id) ?? editing) : null;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {notes.length === 0
            ? "Cosas que no se te pueden olvidar"
            : `${notes.length} ${notes.length === 1 ? "nota" : "notas"}`}
        </p>
        <button
          onClick={() => openEditor(null)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-md)]"
          aria-label="Nueva nota"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-6">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {!isLoading && notes.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
            <StickyNote size={30} className="text-muted-foreground" />
            <p className="font-medium">El tablón está vacío</p>
          </div>
        )}

        <div className="flex items-start gap-3">
          {columns.map((column, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col gap-3">
              {column.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  items={itemsByNote.get(note.id) ?? []}
                  onEdit={() => openEditor(note)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {open && (
        <NoteEditor
          key={current?.id ?? "nueva"}
          tripId={tripId}
          note={current}
          items={current ? (itemsByNote.get(current.id) ?? []) : []}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
