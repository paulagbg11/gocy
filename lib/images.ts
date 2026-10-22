const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export interface ResizedImage {
  file: File;
  /** Medidas de lo que se sube; null si no se pudo leer la imagen. */
  width: number | null;
  height: number | null;
}

/**
 * Reduce una foto antes de subirla. Las fotos de móvil vienen a 3-5 MB y
 * 4000px de ancho para acabar en una tarjeta de 112px de alto: subirlas tal
 * cual gasta almacenamiento, datos y hace que las portadas tarden en aparecer.
 *
 * Si algo falla (formato raro, canvas no disponible), devuelve el archivo
 * original: es mejor subir una foto grande que no subir nada.
 */
export async function downscaleImage(file: File): Promise<File> {
  return (await resizeImage(file, MAX_DIMENSION)).file;
}

/** Como `downscaleImage`, pero con el tamaño máximo a elegir y las medidas finales. */
export async function resizeImage(file: File, maxDimension: number): Promise<ResizedImage> {
  const original = { file, width: null, height: null };
  if (!file.type.startsWith("image/")) return original;

  try {
    const bitmap = await createImageBitmap(file);
    const asIs = { file, width: bitmap.width, height: bitmap.height };
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    // Ya es suficientemente pequeña y no es un formato pesado: déjala igual.
    if (scale === 1 && file.size < 600_000) {
      bitmap.close();
      return asIs;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return asIs;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return asIs;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg" }), width, height };
  } catch {
    return original;
  }
}
