"use client";

import { useState } from "react";
import { Check, Pin, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { useProfile } from "@/components/profile/ProfileProvider";
import { DEFAULT_NOTE_COLOR, NOTE_COLORS, noteHue, normalizeUrl } from "@/lib/notes";
import {
  useAddNoteItem,
  useCreateNote,
  useDeleteNote,
  useDeleteNoteItem,
  useToggleNoteItem,
  useUpdateNote,
} from "@/lib/queries/notes";
import type { Note, NoteItem } from "@/lib/supabase/types";

interface NoteEditorProps {
  tripId: string;
  /** null = nota nueva. */
  note: Note | null;
  items: NoteItem[];
  onClose: () => void;
}

/**
 * Se monta solo mientras el panel está abierto, y con `key` por nota: así los
 * campos arrancan ya con sus valores y no hace falta un efecto que los
 * reinicie (que además provocaba un render de más en cada apertura).
 */
export function NoteEditor({ tripId, note, items, onClose }: NoteEditorProps) {
  const { activeProfile } = useProfile();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const addItem = useAddNoteItem();
  const toggleItem = useToggleNoteItem();
  const deleteItem = useDeleteNoteItem();

  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [url, setUrl] = useState(note?.url ?? "");
  const [color, setColor] = useState<string>(note?.color ?? DEFAULT_NOTE_COLOR);
  const [draftItem, setDraftItem] = useState("");
  /** Casillas de una nota que todavía no existe: se guardan al crearla. */
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isNew = !note;
  const canSave = !!title.trim() || !!body.trim() || pendingItems.length > 0 || items.length > 0;

  const addDraftItem = () => {
    const text = draftItem.trim();
    if (!text) return;
    if (isNew) {
      setPendingItems((prev) => [...prev, text]);
    } else {
      addItem.mutate({ note_id: note.id, trip_id: tripId, text, sort_order: items.length });
    }
    setDraftItem("");
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const fields = {
        title: title.trim(),
        body: body.trim() || null,
        url: normalizeUrl(url),
        color,
      };
      if (isNew) {
        const created = await createNote.mutateAsync({
          trip_id: tripId,
          created_by: activeProfile?.id ?? null,
          ...fields,
        });
        await Promise.all(
          pendingItems.map((text, i) =>
            addItem.mutateAsync({ note_id: created.id, trip_id: tripId, text, sort_order: i }),
          ),
        );
      } else {
        await updateNote.mutateAsync({ id: note.id, trip_id: tripId, ...fields });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    await deleteNote.mutateAsync({ id: note.id, trip_id: tripId });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? "Nueva nota" : "Editar nota"}>
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="note-title">Título</Label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enchufes, ETA, qué meter en la maleta…"
          />
        </div>

        <div>
          <Label htmlFor="note-body">Nota</Label>
          <Textarea
            id="note-body"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Lo que haga falta recordar"
          />
        </div>

        <div>
          <Label htmlFor="note-url">Enlace</Label>
          <Input
            id="note-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div>
          <Label>Lista</Label>
          <div className="flex flex-col gap-1.5">
            {/* En una nota que ya existe cada casilla es una fila propia y se
                guarda al momento; en una nueva se quedan aquí hasta crearla. */}
            {!isNew &&
              items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      toggleItem.mutate({ id: item.id, trip_id: tripId, done: !item.done })
                    }
                    aria-pressed={item.done}
                    aria-label={item.done ? "Desmarcar" : "Marcar"}
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ease-out",
                      item.done
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-foreground/25",
                    )}
                  >
                    {item.done && <Check size={13} strokeWidth={3.5} />}
                  </button>
                  <span
                    className={clsx(
                      "min-w-0 flex-1 break-words text-[15px]",
                      item.done && "text-muted-foreground line-through",
                    )}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteItem.mutate({ id: item.id, trip_id: tripId })}
                    aria-label="Quitar de la lista"
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

            {isNew &&
              pendingItems.map((text, i) => (
                <div key={`${text}-${i}`} className="flex items-center gap-2">
                  <span className="h-5 w-5 shrink-0 rounded-[5px] border border-foreground/25" />
                  <span className="min-w-0 flex-1 break-words text-[15px]">{text}</span>
                  <button
                    onClick={() => setPendingItems((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="Quitar de la lista"
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-danger"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

            <div className="flex items-center gap-2">
              <Input
                value={draftItem}
                onChange={(e) => setDraftItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftItem();
                  }
                }}
                placeholder="Añadir a la lista"
                aria-label="Añadir a la lista"
              />
              <Button
                variant="secondary"
                onClick={addDraftItem}
                disabled={!draftItem.trim()}
                aria-label="Añadir a la lista"
                className="shrink-0 px-3"
              >
                <Plus size={18} />
              </Button>
            </div>
          </div>
        </div>

        <div>
          <Label>Color del papel</Label>
          <div className="flex flex-wrap gap-2.5">
            {NOTE_COLORS.map((option) => (
              <button
                key={option.id}
                onClick={() => setColor(option.id)}
                aria-label={option.label}
                aria-pressed={color === option.id}
                className={clsx(
                  // Anillo separado en vez de borde pegado: sobre un círculo de
                  // color pastel, un borde del mismo grosor apenas se veía.
                  "h-9 w-9 rounded-full transition-transform duration-150 ease-out",
                  color === option.id &&
                    "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface",
                )}
                style={{ background: noteHue(option.id) }}
              />
            ))}
          </div>
        </div>

        {!isNew && (
          <button
            onClick={() => updateNote.mutate({ id: note.id, trip_id: tripId, pinned: !note.pinned })}
            aria-pressed={note.pinned}
            className="flex items-center gap-2 self-start text-[15px] font-medium text-muted-foreground"
          >
            <Pin
              size={17}
              className={note.pinned ? "text-accent" : ""}
              fill={note.pinned ? "currentColor" : "none"}
            />
            {note.pinned ? "Fijada arriba del tablón" : "Fijar arriba del tablón"}
          </button>
        )}

        <div className="mt-1 flex items-center gap-2">
          <Button onClick={handleSave} disabled={!canSave || saving} className="flex-1">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
          {!isNew && (
            <Button variant="danger" onClick={handleDelete} aria-label="Borrar la nota">
              <Trash2 size={18} />
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
