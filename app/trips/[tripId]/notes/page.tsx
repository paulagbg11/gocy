"use client";

import { use } from "react";
import { NotesScreen } from "@/components/notes/NotesScreen";

export default function NotesPage({ params }: PageProps<"/trips/[tripId]/notes">) {
  const { tripId } = use(params);
  return <NotesScreen tripId={tripId} />;
}
