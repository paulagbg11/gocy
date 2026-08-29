"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/profile/ProfileProvider";
import { ProfilePicker } from "@/components/profile/ProfilePicker";

export default function Home() {
  const { activeProfile, sessionReady } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (sessionReady && activeProfile) {
      router.replace("/trips");
    }
  }, [sessionReady, activeProfile, router]);

  return <ProfilePicker />;
}
