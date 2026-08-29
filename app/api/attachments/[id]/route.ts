import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Los adjuntos viven en el bucket privado "trip-attachments"; esta ruta emite
// una URL firmada de corta duración en cada visualización en vez de guardar
// una URL larga en la base de datos (que caducaría igualmente).
export async function GET(_request: Request, { params }: RouteContext<"/api/attachments/[id]">) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (error || !attachment) {
    return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("trip-attachments")
    .createSignedUrl(attachment.storage_path, 60);
  if (signError || !signed) {
    return NextResponse.json({ error: "No se pudo generar la URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
