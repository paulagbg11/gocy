"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useDocument } from "@/lib/queries/documents";
import { DocumentForm } from "@/components/docs/DocumentForm";
import { DocumentSummary } from "@/components/docs/DocumentSummary";
import { AttachmentUploader } from "@/components/docs/AttachmentUploader";

export default function DocumentDetailPage({
  params,
}: PageProps<"/trips/[tripId]/docs/[docId]">) {
  const { tripId, docId } = use(params);
  const { data: document, isLoading } = useDocument(docId);
  // Se entra en modo lectura: el formulario con todos los campos vacíos era
  // mucho ruido para lo que casi siempre se viene a hacer, que es mirar un dato.
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto w-full max-w-md flex-1 min-h-0 overflow-x-hidden overflow-y-auto px-4 py-4">
      <Link
        href={`/trips/${tripId}/docs`}
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Documentos
      </Link>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {document &&
        (editing ? (
          <>
            <h1 className="mb-5 text-xl font-semibold">{document.title}</h1>
            <DocumentForm tripId={tripId} editing={document} onSaved={() => setEditing(false)} />
            <div className="mt-6">
              <AttachmentUploader tripId={tripId} documentId={docId} />
            </div>
            <button
              onClick={() => setEditing(false)}
              className="mt-4 w-full text-center text-sm text-muted-foreground"
            >
              Cancelar
            </button>
          </>
        ) : (
          <DocumentSummary
            tripId={tripId}
            document={document}
            onEdit={() => setEditing(true)}
          />
        ))}
    </div>
  );
}
