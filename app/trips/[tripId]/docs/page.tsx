"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useDocuments } from "@/lib/queries/documents";
import { DOCUMENT_TYPE_LABEL, DOCUMENT_TYPE_ORDER } from "@/lib/documents";
import { DocumentCard } from "@/components/docs/DocumentCard";
import { Chip } from "@/components/ui/Chip";
import type { DocumentType } from "@/lib/supabase/types";

export default function DocsPage({ params }: PageProps<"/trips/[tripId]/docs">) {
  const { tripId } = use(params);
  const { data: documents = [], isLoading } = useDocuments(tripId);
  const [filter, setFilter] = useState<DocumentType | "all">("all");

  const filtered = useMemo(
    () => (filter === "all" ? documents : documents.filter((d) => d.type === filter)),
    [documents, filter],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-start justify-between gap-2 px-4 py-3">
        {/* wrap en vez de scroll horizontal: con 7 filtros, una sola línea
            obligaba a arrastrar para ver los últimos tipos. */}
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            Todos
          </Chip>
          {DOCUMENT_TYPE_ORDER.map((t) => (
            <Chip key={t} active={filter === t} onClick={() => setFilter(t)}>
              {DOCUMENT_TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
        <Link
          href={`/trips/${tripId}/docs/new`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
          aria-label="Nuevo documento"
        >
          <Plus size={18} />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Todavía no hay nada guardado aquí.
          </p>
        )}
        {filtered.map((doc) => (
          <DocumentCard key={doc.id} tripId={tripId} document={doc} />
        ))}
      </div>
    </div>
  );
}
