"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  Check,
  Copy,
  Paperclip,
  Pencil,
  Plane,
  Plus,
  StickyNote,
  Ticket,
  TrainFront,
} from "lucide-react";
import {
  DOCUMENT_FIELDS,
  DOCUMENT_TYPE_LABEL,
  documentJourney,
  formatFieldValue,
} from "@/lib/documents";
import { useAttachments } from "@/lib/queries/documents";
import { Button } from "@/components/ui/Button";
import type { DocumentType, TripDocument } from "@/lib/supabase/types";

const TYPE_ICON: Record<DocumentType, typeof Plane> = {
  flight: Plane,
  transport: TrainFront,
  lodging: BedDouble,
  reservation: CalendarCheck,
  ticket: Ticket,
  note: StickyNote,
};

/** El localizador se enseña aparte: es el dato que se busca con prisa. */
const CODE_FIELD = "confirmation_code";

/**
 * Vista de lectura de un documento.
 *
 * Enseña solo lo que está relleno, para que quepa de un vistazo sin
 * desplazarse. Los campos vacíos aparecen al darle a Editar, que es donde
 * tiene sentido verlos.
 */
export function DocumentSummary({
  tripId,
  document,
  onEdit,
}: {
  tripId: string;
  document: TripDocument;
  onEdit: () => void;
}) {
  const { data: attachments = [] } = useAttachments(document.id);
  const [copied, setCopied] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const Icon = TYPE_ICON[document.type];
  const journey = documentJourney(document.type, document.details);
  const raw = document.details as Record<string, unknown>;

  const code = typeof raw[CODE_FIELD] === "string" ? (raw[CODE_FIELD] as string) : null;
  const shownInHeader = new Set([...(journey?.fields ?? []), CODE_FIELD]);

  const rest = DOCUMENT_FIELDS[document.type]
    .filter((field) => !shownInHeader.has(field.key))
    .map((field) => ({ field, value: formatFieldValue(field, raw[field.key]) }))
    .filter((entry): entry is { field: (typeof DOCUMENT_FIELDS)[DocumentType][number]; value: string } =>
      entry.value !== null,
    );

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Sin portapapeles (contexto no seguro): el código se ve igual y se
      // puede seleccionar a mano, así que no hace falta avisar de nada.
    }
  };

  const openAttachment = async (id: string) => {
    setOpeningId(id);
    try {
      const res = await fetch(`/api/attachments/${id}`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon size={15} />
          <span className="text-xs font-semibold tracking-wide uppercase">
            {DOCUMENT_TYPE_LABEL[document.type]}
          </span>
        </div>
        <h1 className="mt-1.5 text-xl leading-tight font-semibold text-balance">{document.title}</h1>

        {journey && (
          <div className="mt-4 flex items-stretch gap-3">
            {[journey.from, journey.to].map((end, i) => (
              <div key={end.label} className="flex flex-1 items-center gap-3">
                {i === 1 && (
                  <ArrowRight size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {end.label}
                  </p>
                  {end.place && (
                    <p className="truncate text-[15px] font-semibold">{end.place}</p>
                  )}
                  {end.time && (
                    <p className="text-[19px] leading-tight font-semibold tabular-nums">
                      {end.time}
                    </p>
                  )}
                  {end.date && <p className="text-xs text-muted-foreground">{end.date}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {code && (
          <button
            onClick={copyCode}
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Localizador
              </span>
              <span className="block truncate font-mono text-[17px] font-semibold">{code}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copiado" : "Copiar"}
            </span>
          </button>
        )}
      </div>

      {rest.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-sm)]">
          {rest.map(({ field, value }) => (
            <div key={field.key} className="min-w-0">
              <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {field.label}
              </dt>
              <dd className="text-[15px] break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {document.notes && (
        <div className="rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Notas
          </p>
          <p className="mt-1 text-[15px] whitespace-pre-wrap">{document.notes}</p>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] bg-surface p-4 shadow-[var(--shadow-sm)]">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Adjuntos
          </p>
          {attachments.map((a) => (
            <button
              key={a.id}
              onClick={() => openAttachment(a.id)}
              disabled={openingId === a.id}
              className="flex items-center gap-2 text-left text-[15px]"
            >
              <Paperclip size={14} className="shrink-0 text-muted-foreground" />
              <span className="truncate underline decoration-dotted">
                {openingId === a.id ? "Abriendo…" : (a.file_name ?? "Archivo")}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onEdit} className="flex-1">
          <Pencil size={16} /> Editar
        </Button>
        <Link
          href={`/trips/${tripId}/docs/new`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors duration-150 ease-out hover:brightness-95"
        >
          <Plus size={16} /> Añadir
        </Link>
      </div>
    </div>
  );
}
