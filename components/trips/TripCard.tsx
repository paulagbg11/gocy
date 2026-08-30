import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { formatDateRange } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/lib/supabase/types";

export function TripCard({ trip }: { trip: Trip }) {
  const coverUrl = trip.cover_image_path
    ? createClient().storage.from("trip-covers").getPublicUrl(trip.cover_image_path).data.publicUrl
    : null;

  return (
    <Link
      href={`/trips/${trip.id}/map`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-md)] bg-surface shadow-[var(--shadow-sm)] transition-shadow duration-150 ease-out hover:shadow-[var(--shadow-md)]"
    >
      <div className="relative h-28 w-full bg-surface-2">
        {coverUrl && (
          // next/image en vez de background-image: así se descarga una versión
          // del tamaño de la tarjeta y no la foto original entera.
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <h3 className="font-semibold leading-tight">{trip.name}</h3>
        {trip.destination && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin size={14} /> {trip.destination}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatDateRange(trip.start_date, trip.end_date)}
        </p>
      </div>
    </Link>
  );
}
