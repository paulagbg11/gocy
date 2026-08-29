import { createClient } from "@/lib/supabase/client";

/**
 * Garantiza que el navegador tiene una sesión (aunque sea anónima) para que
 * las políticas RLS de Supabase (acceso solo a `authenticated`) dejen pasar
 * las peticiones. Esto es independiente del perfil elegido en la Pantalla 0:
 * ver la sección "Autenticación y RLS" del plan para el porqué.
 */
export async function ensureAnonymousSession() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signInData.session;
}
