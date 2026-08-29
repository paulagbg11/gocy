import { createBrowserClient } from "@supabase/ssr";

// Sin generic <Database>: los tipos de fila (Place, Trip, TripDocument...) de
// ./types se aplican a mano con `as` en cada hook de lib/queries. El tipado
// genérico automático de supabase-js requiere tipos generados con
// `supabase gen types typescript`, que no hemos podido correr aquí.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
