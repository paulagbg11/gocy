import Link from "next/link";
import { Plane, TrainFront, BedDouble, CalendarCheck, Ticket, StickyNote, Clock } from "lucide-react";
import { DOCUMENT_TYPE_LABEL, documentEventTime } from "@/lib/documents";
import type { DocumentType, TripDocument } from "@/lib/supabase/types";

const TYPE_ICON: Record<DocumentType, typeof Plane> = {
  flight: Plane,
  transport: TrainFront,
  lodging: BedDouble,
  reservation: CalendarCheck,
  ticket: Ticket,
  note: StickyNote,
};

export function DocumentCard({ tripId, document }: { tripId: string; document: TripDocument }) {
  const Icon = TYPE_ICON[document.type];
  const eventTime = documentEventTime(document.type, document.details);

  return (
    <Link
      href={`/trips/${tripId}/docs/${document.id}`}
      className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-surface px-3.5 py-3 shadow-[var(--shadow-sm)] transition-shadow duration-150 ease-out hover:shadow-[var(--shadow-md)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
        <Icon size={17} className="text-foreground" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium">{document.title}</span>
        <span className="block text-xs text-muted-foreground">{DOCUMENT_TYPE_LABEL[document.type]}</span>
      </span>
      {eventTime && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Clock size={12} />
          {eventTime}
        </span>
      )}
    </Link>
  );
}
