const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Reduce una foto antes de subirla. Las fotos de móvil vienen a 3-5 MB y
 * 4000px de ancho para acabar en una tarjeta de 112px de alto: subirlas tal
 * cual gasta almacenamiento, datos y hace que las portadas tarden en aparecer.
 *
 * Si algo falla (formato raro, canvas no disponible), devuelve el archivo
 * original: es mejor subir una foto grande que no subir nada.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    // Ya es suficientemente pequeña y no es un formato pesado: déjala igual.
    if (scale === 1 && file.size < 600_000) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
