/**
 * Saca el texto de un PDF en el propio móvil, sin enviarlo a ningún sitio.
 * pdf.js pesa lo suyo, así que se carga solo al elegir un PDF.
 *
 * Se usa la versión "legacy": la normal necesita cosas de JavaScript que los
 * iPhone con un par de años todavía no tienen.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const pdf = await task.promise;
  try {
    const pages: string[] = [];
    // Una reserva dice lo importante al principio; el resto son condiciones.
    for (let n = 1; n <= Math.min(pdf.numPages, 5); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      let lastEnd: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const x = item.transform[4];
        // Los PDF no siempre traen los espacios: si entre un trozo y el
        // siguiente hay hueco, se pone uno.
        if (lastEnd !== null && x - lastEnd > item.height * 0.2 && !/\s$/.test(text)) text += " ";
        text += item.str;
        lastEnd = x + item.width;
        if (item.hasEOL) {
          text += "\n";
          lastEnd = null;
        }
      }
      pages.push(text);
    }
    return pages.join("\n");
  } finally {
    await task.destroy();
  }
}
