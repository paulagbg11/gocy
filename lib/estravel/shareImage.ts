export type ShareResult = "shared" | "downloaded" | "opened" | "cancelled" | "failed";

/**
 * Entrega la imagen generada al móvil.
 *
 * En iOS Safari un <a download> con una URL `data:` no descarga nada (el
 * atributo download está muy limitado), así que el camino bueno es el menú de
 * compartir del sistema: permite guardar en Fotos, mandarla por WhatsApp, etc.
 * Si no está disponible se intenta la descarga clásica con un blob, y como
 * último recurso se abre en otra pestaña para poder guardarla a mano.
 */
export async function shareOrDownloadImage(
  dataUrl: string,
  filename: string,
): Promise<ShareResult> {
  let blob: Blob;
  try {
    blob = await (await fetch(dataUrl)).blob();
  } catch {
    return "failed";
  }

  const file = new File([blob], filename, { type: "image/png" });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      // Si la usuaria cierra el menú no hay que intentar descargarla también.
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const supportsDownload = "download" in link;

  if (supportsDownload) {
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return "downloaded";
  }

  window.open(objectUrl, "_blank");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return "opened";
}
