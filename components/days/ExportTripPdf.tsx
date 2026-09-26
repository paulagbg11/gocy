"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { useTrip, useTripDays } from "@/lib/queries/trips";
import { usePlaces } from "@/lib/queries/places";
import { usePlaceDayLinks } from "@/lib/queries/place-day-links";
import { useDocuments } from "@/lib/queries/documents";
import { useCategoriesById } from "@/lib/queries/categories";
import { buildTripSummary } from "@/lib/pdf/tripSummary";
import { buildPdfMaps } from "@/lib/pdf/maps";
import { shareOrDownloadFile } from "@/lib/estravel/shareImage";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

type Status =
  | { step: "idle" }
  | { step: "working"; message: string }
  | { step: "ready"; blob: Blob; filename: string }
  | { step: "error"; message: string };

/**
 * Botón "PDF" de la pestaña de días y su hoja. El PDF se genera en dos pasos:
 * primero se prepara (mapas y maqueta, unos segundos) y luego se comparte con
 * otro toque. Compartir justo al terminar de generarlo no vale en iOS: Safari
 * solo abre el menú de compartir justo después de tocar algo, y tras varios
 * segundos de espera lo rechaza.
 */
export function ExportTripPdf({ tripId }: { tripId: string }) {
  const { data: trip } = useTrip(tripId);
  const { data: days = [] } = useTripDays(tripId);
  const { data: places = [] } = usePlaces(tripId);
  const { data: links = [] } = usePlaceDayLinks(tripId);
  const { data: documents = [] } = useDocuments(tripId);
  const categoriesById = useCategoriesById();

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ step: "idle" });

  const close = () => {
    setOpen(false);
    if (status.step !== "working") setStatus({ step: "idle" });
  };

  const generate = async () => {
    if (!trip) return;
    try {
      setStatus({ step: "working", message: "Preparando los mapas…" });
      const summary = buildTripSummary({ trip, days, places, links, documents, categoriesById });
      const [maps, { pdf }, { TripPdfDocument }] = await Promise.all([
        buildPdfMaps(summary),
        import("@react-pdf/renderer"),
        import("./pdf/TripPdfDocument"),
      ]);
      setStatus({ step: "working", message: "Maquetando el PDF…" });
      const blob = await pdf(<TripPdfDocument summary={summary} maps={maps} />).toBlob();
      const safeName = trip.name.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "viaje";
      setStatus({ step: "ready", blob, filename: `${safeName} - guía del viaje.pdf` });
    } catch (err) {
      console.error(err);
      setStatus({
        step: "error",
        message: "No se ha podido generar el PDF. Comprueba la conexión y vuelve a intentarlo.",
      });
    }
  };

  const share = async () => {
    if (status.step !== "ready") return;
    const result = await shareOrDownloadFile(status.blob, status.filename, "application/pdf");
    if (result === "failed")
      setStatus({ step: "error", message: "No se ha podido guardar el PDF." });
  };

  const sizeKb = status.step === "ready" ? Math.round(status.blob.size / 1024) : 0;

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={!trip}>
        <FileText size={16} /> PDF
      </Button>

      <Sheet open={open} onClose={close} title="Guía del viaje en PDF">
        <p className="text-sm text-muted-foreground">
          Un resumen para planificar de un vistazo: mapa general, todos los días con sus paradas,
          reservas y billetes, y lo que tenéis guardado sin día. Luego, una página por día con su
          mapa numerado, el horario, las notas y cómo ir de una parada a la siguiente.
        </p>

        <div className="mt-5">
          {status.step === "idle" && (
            <Button className="w-full" onClick={generate}>
              <FileText size={18} /> Generar PDF
            </Button>
          )}

          {status.step === "working" && (
            <Button className="w-full" disabled>
              <Loader2 size={18} className="animate-spin" /> {status.message}
            </Button>
          )}

          {status.step === "ready" && (
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={share}>
                <Download size={18} /> Guardar o compartir
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {status.filename} ·{" "}
                {sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`}
              </p>
              <Button variant="ghost" size="sm" onClick={generate}>
                Volver a generarlo
              </Button>
            </div>
          )}

          {status.step === "error" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-danger">{status.message}</p>
              <Button className="w-full" onClick={generate}>
                Reintentar
              </Button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
