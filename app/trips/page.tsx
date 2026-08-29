"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useTrips } from "@/lib/queries/trips";
import { TripCard } from "@/components/trips/TripCard";
import { useProfile } from "@/components/profile/ProfileProvider";

export default function TripsPage() {
  const { data: trips, isLoading } = useTrips();
  const { activeProfile } = useProfile();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = trips?.filter((t) => t.end_date >= today) ?? [];
  const past = trips?.filter((t) => t.end_date < today) ?? [];

  return (
    <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-5 pt-8 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Hola, {activeProfile?.name}</p>
          <h1 className="text-2xl font-semibold">Vuestros viajes</h1>
        </div>
        <Link
          href="/trips/new"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-sm)] transition-transform duration-150 ease-out hover:scale-105"
          aria-label="Nuevo viaje"
        >
          <Plus size={22} />
        </Link>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando viajes…</p>}

      {!isLoading && trips?.length === 0 && (
        <div className="flex flex-col items-center text-center gap-3 py-16">
          <p className="text-muted-foreground">Todavía no tenéis ningún viaje.</p>
          <Link
            href="/trips/new"
            className="text-accent font-medium underline decoration-dotted"
          >
            Crear el primero
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Próximos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {upcoming.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Pasados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-80">
            {past.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
