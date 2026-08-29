"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useDocument } from "@/lib/queries/documents";
import { DocumentForm } from "@/components/docs/DocumentForm";
import { AttachmentUploader } from "@/components/docs/AttachmentUploader";

export default function DocumentDetailPage({
  params,
}: PageProps<"/trips/[tripId]/docs/[docId]">) {
  const { tripId, docId } = use(params);
  const { data: document, isLoading } = useDocument(docId);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 max-w-md mx-auto">
      <Link
        href={`/trips/${tripId}/docs`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit"
      >
        <ArrowLeft size={16} /> Documentos
      </Link>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {document && (
        <>
          <h1 className="text-xl font-semibold mb-5">{document.title}</h1>
          <DocumentForm tripId={tripId} editing={document} />
          <div className="mt-6">
            <AttachmentUploader tripId={tripId} documentId={docId} />
          </div>
        </>
      )}
    </div>
  );
}
