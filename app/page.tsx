"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/profile/ProfileProvider";
import { ProfilePicker } from "@/components/profile/ProfilePicker";

export default function Home() {
  const { activeProfile, hasChosenProfile, ready } = useProfile();
  const router = useRouter();

  // Quien ya eligió perfil en este móvil va directo a sus viajes, sin esperar
  // a que carguen los perfiles. Antes la pantalla de "¿Quién eres?" asomaba
  // medio segundo en cada arranque, justo lo que tardaban en llegar.
  //
  // La excepción es un perfil guardado que ya no existe (ready y sin perfil
  // activo): ahí sí hay que volver a elegir, y sin esta condición /trips nos
  // devolvería aquí una y otra vez.
  const goToTrips = hasChosenProfile && (!ready || !!activeProfile);

  useEffect(() => {
    if (goToTrips || (ready && activeProfile)) router.replace("/trips");
  }, [goToTrips, ready, activeProfile, router]);

  // Mientras no se sabe si hay perfil, nada: la pantalla de elegir solo sale
  // cuando de verdad hace falta (la primera vez en un móvil).
  if (goToTrips || !ready || activeProfile) return null;

  return <ProfilePicker />;
}
