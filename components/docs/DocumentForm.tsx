"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPE_LABEL } from "@/lib/documents";
import { useCreateDocument, useUpdateDocument, useDeleteDocument } from "@/lib/queries/documents";
import { useProfile } from "@/components/profile/ProfileProvider";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { DocumentDetails, DocumentType, TripDocument } from "@/lib/supabase/types";

const FIELDS_BY_TYPE: Record<DocumentType, { key: string; label: string; type?: string }[]> = {
  flight: [
    { key: "airline", label: "Aerolínea" },
    { key: "flight_number", label: "Nº de vuelo" },
    { key: "departure_airport", label: "Aeropuerto de salida" },
    { key: "departure_time", label: "Hora de salida", type: "datetime-local" },
    { key: "arrival_airport", label: "Aeropuerto de llegada" },
    { key: "arrival_time", label: "Hora de llegada", type: "datetime-local" },
    { key: "confirmation_code", label: "Localizador" },
  ],
  lodging: [
    { key: "address", label: "Dirección" },
    { key: "check_in", label: "Check-in", type: "datetime-local" },
    { key: "check_out", label: "Check-out", type: "datetime-local" },
    { key: "confirmation_code", label: "Nº de reserva" },
  ],
  reservation: [
    { key: "place_name", label: "Lugar" },
    { key: "date_time", label: "Fecha y hora", type: "datetime-local" },
    { key: "party_size", label: "Nº de personas", type: "number" },
    { key: "confirmation_code", label: "Nº de reserva" },
  ],
  note: [],
};

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
      <SegmentedControl
        options={(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => ({
          value: t,
          label: DOCUMENT_TYPE_LABEL[t],
        }))}
        value={type}
        onChange={setType}
        className="self-start"
      />

      <div>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vuelo de ida, Hotel Central…"
        />
      </div>

      {FIELDS_BY_TYPE[type].map((field) => (
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
        <Button type="submit" size="lg" disabled={submitting} className="flex-1">
          {submitting ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
