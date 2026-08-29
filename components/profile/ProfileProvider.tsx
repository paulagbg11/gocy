"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth/ensureAnonymousSession";
import type { Profile } from "@/lib/supabase/types";

const STORAGE_KEY = "gocy:profileId";

interface ProfileContextValue {
  sessionReady: boolean;
  /**
   * true solo cuando ya sabemos con certeza si hay perfil activo o no (sesión
   * lista Y la consulta de perfiles ya se resolvió al menos una vez). Usar
   * esto para decidir si redirigir por "no hay perfil" — usar solo
   * `sessionReady` deja una ventana donde `profiles` todavía está vacío por
   * no haber cargado, no porque no exista el perfil, y eso mandaba a la
   * gente de vuelta a la Pantalla 0 en cada recarga aunque ya hubieran
   * elegido perfil.
   */
  ready: boolean;
  profiles: Profile[];
  activeProfile: Profile | null;
  chooseProfile: (profileId: string) => void;
  clearProfile: () => void;
  renameProfile: (profileId: string, name: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY),
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    ensureAnonymousSession()
      .catch((err) => console.error("No se pudo iniciar sesión anónima en Supabase:", err))
      .finally(() => setSessionReady(true));
  }, []);

  const {
    data: profiles = [],
    isSuccess: profilesLoaded,
    isError: profilesErrored,
  } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("profiles").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: sessionReady,
  });

  const chooseProfile = useCallback((profileId: string) => {
    localStorage.setItem(STORAGE_KEY, profileId);
    setActiveProfileId(profileId);
  }, []);

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveProfileId(null);
  }, []);

  const renameProfile = useCallback(
    async (profileId: string, name: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ name }).eq("id", profileId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    [queryClient],
  );

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const ready = sessionReady && (profilesLoaded || profilesErrored);

  return (
    <ProfileContext.Provider
      value={{ sessionReady, ready, profiles, activeProfile, chooseProfile, clearProfile, renameProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile debe usarse dentro de ProfileProvider");
  return ctx;
}
