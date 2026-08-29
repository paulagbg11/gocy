"use client";

import { use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Map, CalendarDays, FileText, Settings } from "lucide-react";
import clsx from "clsx";
import { useTrip } from "@/lib/queries/trips";
import { useTripRealtime } from "@/lib/realtime/useTripRealtime";

const TABS = [
  { href: "map", label: "Mapa", icon: Map },
  { href: "days", label: "Días", icon: CalendarDays },
  { href: "docs", label: "Docs", icon: FileText },
];

export default function TripLayout({
  children,
  params,
}: LayoutProps<"/trips/[tripId]">) {
  const { tripId } = use(params);
  const { data: trip } = useTrip(tripId);
  const pathname = usePathname();
  useTripRealtime(tripId);

  return (
    <div className="flex-1 flex flex-col h-dvh">
      <header className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-border bg-surface">
        <Link
          href="/trips"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold truncate">{trip?.name ?? "…"}</h1>
        <Link
          href={`/trips/${tripId}/settings`}
          aria-label="Ajustes del viaje"
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings size={18} />
        </Link>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>

      <nav className="flex shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const href = `/trips/${tripId}/${tab.href}`;
          const active = pathname?.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={href}
              className={clsx(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors duration-150 ease-out",
                active ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
