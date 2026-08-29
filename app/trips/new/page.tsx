"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TripForm } from "@/components/trips/TripForm";

export default function NewTripPage() {
  return (
    <main className="flex-1 flex flex-col max-w-md w-full mx-auto px-5 pt-8 pb-16">
      <Link
        href="/trips"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 w-fit"
      >
        <ArrowLeft size={16} /> Viajes
      </Link>
      <h1 className="text-2xl font-semibold mb-6">Nuevo viaje</h1>
      <TripForm />
    </main>
  );
}
