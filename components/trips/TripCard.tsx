import Link from "next/link";
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
      <div
        className="h-28 w-full bg-surface-2 bg-cover bg-center"
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      />
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
