"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Paperclip, X } from "lucide-react";
import { DOCUMENT_FIELDS, DOCUMENT_TYPE_LABEL, DOCUMENT_TYPE_ORDER } from "@/lib/documents";
import {
  useCreateDocument,
  useUpdateDocument,
  useDeleteDocument,
  useUploadAttachment,
} from "@/lib/queries/documents";
import { guessReservation } from "@/lib/docs/readReservation";
import { useProfile } from "@/components/profile/ProfileProvider";
import { Chip } from "@/components/ui/Chip";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { DocumentDetails, DocumentType, TripDocument } from "@/lib/supabase/types";

interface DocumentFormProps {
  tripId: string;
  editing?: TripDocument;
  onSaved?: (id: string) => void;
}

export function DocumentForm({ tripId, editing, onSaved }: DocumentFormProps) {
  const router = useRouter();
  const { activeProfile } = useProfile();
  const createDoc = useCreateDocument();
  const updateDoc = useUpdateDocument();
  const deleteDoc = useDeleteDocument();

  const [type, setType] = useState<DocumentType>(editing?.type ?? "note");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [details, setDetails] = useState<Record<string, string>>(
    (editing?.details as Record<string, string>) ?? {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: string) => setDetails((d) => ({ ...d, [key]: value }));

  // Al crear, lo primero es el PDF de la reserva: se lee en el móvil, se
  // rellena lo que se entienda y, al guardar, queda como adjunto. Es opcional.
  const uploadAttachment = useUploadAttachment();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<string | null>(null);

  const handleFile = async (picked: File) => {
    setFile(picked);
    setReadResult(null);
    if (picked.type !== "application/pdf") {
      setReadResult("Solo sé leer PDF. Lo adjunto igualmente; rellena los campos a mano.");
      return;
    }
    setReading(true);
    try {
      const { extractPdfText } = await import("@/lib/docs/pdfText");
      const text = await extractPdfText(picked);
      if (text.trim().length < 20) {
        setReadResult("Este PDF es una imagen, sin texto que leer. Lo adjunto igualmente; rellena los campos a mano.");
        return;
      }
      const guess = guessReservation(text, picked.name);
      const guessedType = guess.type ?? type;
      if (guess.type) setType(guess.type);
      if (guess.title && !title.trim()) setTitle(guess.title);
      // Lo que ya estuviera escrito a mano no se pisa.
      setDetails((current) => {
        const next = { ...guess.details };
        for (const [key, value] of Object.entries(current)) if (value) next[key] = value;
        return next;
      });
      const filled = DOCUMENT_FIELDS[guessedType]
        .filter((field) => guess.details[field.key])
        .map((field) => field.label.toLowerCase());
      // Lo visto pero no rellenado (una fecha sin hora) se dice, para
      // escribirlo a mano sin volver a abrir el PDF.
      const seen = guess.hints.length > 0 ? ` He visto ${guess.hints.join(" y ")}.` : "";
      setReadResult(
        filled.length > 0
          ? `He rellenado: ${filled.join(", ")}.${seen} Revísalo antes de guardar: se lee con reglas sencillas y puede equivocarse.`
          : `No he sabido sacar los datos de este PDF.${seen} Lo adjunto igualmente; rellena los campos a mano.`,
      );
    } catch {
      setReadResult("No se ha podido leer el PDF. Lo adjunto igualmente; rellena los campos a mano.");
    } finally {
      setReading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setReadResult(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Ponle un título");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await updateDoc.mutateAsync({
          id: editing.id,
          trip_id: tripId,
          type,
          title,
          notes: notes || null,
          details: details as DocumentDetails,
        });
        onSaved?.(editing.id);
      } else {
        const doc = await createDoc.mutateAsync({
          trip_id: tripId,
          type,
          title,
          notes: notes || null,
          details: details as DocumentDetails,
          created_by: activeProfile?.id ?? null,
        });
        if (file) {
          try {
            await uploadAttachment.mutateAsync({ tripId, documentId: doc.id, file });
          } catch {
            // El documento ya está creado: se avisa y se sigue, en vez de
            // dejar el formulario abierto y acabar guardándolo dos veces.
            alert("El documento se ha guardado, pero el archivo no se ha podido adjuntar. Adjúntalo desde el propio documento.");
          }
        }
        router.replace(`/trips/${tripId}/docs/${doc.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`¿Borrar "${editing.title}"?`)) return;
    await deleteDoc.mutateAsync({ id: editing.id, trip_id: tripId });
    router.replace(`/trips/${tripId}/docs`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!editing && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-dashed border-muted-foreground/40 p-4">
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) handleFile(picked);
            }}
          />
          {file ? (
            <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-sm">
              {reading ? (
                <Loader2 size={14} className="shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Paperclip size={14} className="shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{reading ? "Leyendo…" : file.name}</span>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Quitar archivo"
                className="shrink-0 text-muted-foreground hover:text-danger"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
              <FileUp size={16} />
              Subir el PDF de la reserva
            </Button>
          )}
          <p className="text-xs leading-snug text-muted-foreground">
            {readResult ??
              "Relleno los campos que consiga leer y lo dejo adjunto. Si no tienes PDF, rellénalo a mano aquí debajo."}
          </p>
        </div>
      )}

      {/* Chips que hacen wrap en vez de una barra segmentada: con 6 tipos, una
          barra en una sola línea se saldría de la pantalla en móvil. */}
      <div className="flex flex-wrap gap-2">
        {DOCUMENT_TYPE_ORDER.map((t) => (
          <Chip key={t} type="button" active={type === t} onClick={() => setType(t)}>
            {DOCUMENT_TYPE_LABEL[t]}
          </Chip>
        ))}
      </div>

      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vuelo de ida, Hotel Central…"
        />
      </div>

      {DOCUMENT_FIELDS[type].map((field) => (
        <div key={field.key}>
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type={field.type ?? "text"}
            value={details[field.key] ?? ""}
            onChange={(e) => setField(field.key, e.target.value)}
          />
        </div>
      ))}

      <div>
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-2 mt-1">
        {editing && (
          <Button type="button" variant="danger" onClick={handleDelete}>
            Borrar
          </Button>
        )}
        <Button type="submit" size="lg" disabled={submitting || reading} className="flex-1">
          {submitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
