"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocumentForm } from "@/components/docs/DocumentForm";

export default function NewDocumentPage({ params }: PageProps<"/trips/[tripId]/docs/new">) {
  const { tripId } = use(params);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 max-w-md mx-auto">
      <Link
        href={`/trips/${tripId}/docs`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit"
      >
        <ArrowLeft size={16} /> Documentos
      </Link>
      <h1 className="text-xl font-semibold mb-5">Nuevo documento</h1>
      <DocumentForm tripId={tripId} />
    </div>
  );
}
