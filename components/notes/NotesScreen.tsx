"use client";

import { useMemo, useState } from "react";
import { Plus, StickyNote } from "lucide-react";
import { useNoteItems, useNotes } from "@/lib/queries/notes";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";
import type { Note, NoteItem } from "@/lib/supabase/types";

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

  // Las fijadas arriba; dentro de cada grupo se mantiene el orden de la
  // consulta, que ya viene de la más reciente a la más antigua.
  const ordered = useMemo(
    () => [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [notes],
  );

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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
          aria-label="Nueva nota"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {!isLoading && ordered.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
            <StickyNote size={30} className="text-muted-foreground" />
            <p className="font-medium">El tablón está vacío</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Apuntad aquí lo que no cabe en un lugar ni en un documento: sacar el ETA, qué
              enchufes lleva el país, la lista de la maleta… Cada nota puede llevar un enlace y
              sus propias casillas.
            </p>
          </div>
        )}

        {/* Columnas CSS en vez de rejilla: los papeles tienen alturas muy
            distintas y así se encajan sin dejar huecos entre filas. */}
        <div className="columns-2 gap-3 sm:columns-3">
          {ordered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              items={itemsByNote.get(note.id) ?? []}
              onEdit={() => openEditor(note)}
            />
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
