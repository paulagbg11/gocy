"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/profile/ProfileProvider";

export default function TripsLayout({ children }: LayoutProps<"/trips">) {
  const { activeProfile, ready } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (ready && !activeProfile) {
      router.replace("/");
    }
  }, [ready, activeProfile, router]);

  if (!ready || !activeProfile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </main>
    );
  }

  return <>{children}</>;
}
