import { Document, Font, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { dayColor } from "@/lib/estravel/buildRoute";
import { formatDateRange } from "@/lib/dates";
import { groupByPlace, photoClock, type AlbumGroup } from "@/lib/photos/album";
import type { Place, Trip, TripPhoto } from "@/lib/supabase/types";

/**
 * El álbum del viaje en PDF (A4): portada con la foto del viaje y el índice,
 * y luego una página (o las que hagan falta) por día, con las fotos grandes
 * agrupadas por lugar y su nombre. Solo se carga al generarlo.
 *
 * La misma fuente que la guía del viaje: Helvetica no tiene letras como la
 * "ő". Ojo con lineHeight: en la Page hace desaparecer el pie fijo.
 */
const origin = typeof window !== "undefined" ? window.location.origin : "";
Font.register({
  family: "Roboto",
  fonts: [
    { src: `${origin}/fonts/Roboto-Regular.ttf`, fontWeight: 400 },
    { src: `${origin}/fonts/Roboto-Medium.ttf`, fontWeight: 500 },
    { src: `${origin}/fonts/Roboto-Bold.ttf`, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const PAGE_W = 595.28;
const PAD = 40;
const CONTENT_W = PAGE_W - PAD * 2;
const GAP = 12;
const HALF_W = (CONTENT_W - GAP) / 2;

const C = {
  paper: "#fbf8f2",
  fg: "#1f2a2e",
  muted: "#7a7466",
  line: "#e6dfd0",
  accent: "#2f6f7e",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, fontFamily: "Roboto", fontSize: 10, color: C.fg },
  dayPage: { paddingTop: PAD, paddingBottom: 56, paddingHorizontal: PAD },
  footer: {
    position: "absolute",
    bottom: 22,
    left: PAD,
    right: PAD,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.muted,
  },
  coverImage: { width: PAGE_W, height: 470, objectFit: "cover" },
  coverBlank: { width: PAGE_W, height: 200, paddingTop: 50, backgroundColor: C.accent },
  coverBody: { paddingHorizontal: PAD + 8, paddingTop: 34 },
  title: { fontSize: 34, fontWeight: 700 },
  subtitle: { fontSize: 14, color: C.muted, marginTop: 8 },
  stats: { fontSize: 10, color: C.muted, marginTop: 4 },
  index: { marginTop: 30, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 },
  indexRow: { flexDirection: "row", marginBottom: 9 },
  indexDay: { width: 92, fontSize: 11, fontWeight: 700 },
  indexPlaces: { flex: 1, fontSize: 10, color: C.muted },
  dayHeader: { flexDirection: "row", alignItems: "flex-end", marginBottom: 18 },
  dayNumber: { fontSize: 28, fontWeight: 700, marginRight: 10 },
  dayDate: { fontSize: 12, color: C.muted, marginBottom: 5 },
  placeRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: 700, color: "#ffffff" },
  placeName: { fontSize: 15, fontWeight: 700 },
  photos: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 18 },
  card: {
    backgroundColor: "#ffffff",
    padding: 6,
    paddingBottom: 8,
    marginBottom: GAP,
    borderRadius: 3,
  },
  photo: { objectFit: "cover", borderRadius: 2 },
  caption: { fontSize: 9, color: C.muted, marginTop: 6 },
});

export interface AlbumPdfProps {
  trip: Trip;
  coverUrl: string | null;
  groups: AlbumGroup[];
  places: Place[];
  numbers: Map<string, number>;
  photoUrl: (photo: TripPhoto) => string | undefined;
  photoCount: number;
}

export function AlbumPdfDocument({ trip, coverUrl, groups, places, numbers, photoUrl, photoCount }: AlbumPdfProps) {
  const placesById = new Map(places.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (id && placesById.get(id)?.name) || "Otras fotos";

  const footer = (
    <View style={s.footer} fixed>
      <Text>{trip.name}</Text>
      <Text render={({ pageNumber }) => String(pageNumber)} />
    </View>
  );

  return (
    <Document title={`${trip.name} · álbum`}>
      <Page size="A4" style={s.page}>
        {coverUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- en un PDF no hay texto alternativo
          <Image src={coverUrl} style={s.coverImage} />
        ) : (
          // Sin portada, las rayas de colores de la cámara, como en el póster.
          <View style={s.coverBlank}>
            {["#e85d2a", "#f2b84b", "#f2d9a6", "#4fae80"].map((color) => (
              <View key={color} style={{ height: 14, backgroundColor: color }} />
            ))}
          </View>
        )}
        <View style={s.coverBody}>
          <Text style={s.title}>{trip.name}</Text>
          <Text style={s.subtitle}>
            {[trip.destination, formatDateRange(trip.start_date, trip.end_date)].filter(Boolean).join(" · ")}
          </Text>
          <Text style={s.stats}>
            {photoCount} {photoCount === 1 ? "foto" : "fotos"} · {numbers.size}{" "}
            {numbers.size === 1 ? "lugar" : "lugares"}
          </Text>

          <View style={s.index}>
            {groups.map((group) => (
              <View key={group.day?.id ?? "sin-dia"} style={s.indexRow}>
                <Text style={[s.indexDay, { color: dayColor(group.day?.day_index ?? null) }]}>
                  {group.day ? `Día ${group.day.day_index}` : "Sin día"}
                </Text>
                <Text style={s.indexPlaces}>
                  {groupByPlace(group.photos)
                    .map((run) => nameOf(run.placeId))
                    .filter((name, i, all) => all.indexOf(name) === i)
                    .join(" · ")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Page>

      {groups.map((group) => {
        const color = dayColor(group.day?.day_index ?? null);
        return (
          <Page key={group.day?.id ?? "sin-dia"} size="A4" style={[s.page, s.dayPage]}>
            {footer}
            <View style={s.dayHeader}>
              <Text style={[s.dayNumber, { color }]}>
                {group.day ? `Día ${group.day.day_index}` : "Sin día"}
              </Text>
              {group.day && (
                <Text style={s.dayDate}>
                  {format(parseISO(group.day.date), "EEEE d 'de' MMMM", { locale: es })}
                </Text>
              )}
            </View>

            {groupByPlace(group.photos).map((run, i) => {
              const number = run.placeId ? numbers.get(run.placeId) : undefined;
              const single = run.photos.length === 1;
              return (
                <View key={`${run.placeId}-${i}`}>
                  {/* El nombre no se queda solo al final de una página. */}
                  <View style={s.placeRow} minPresenceAhead={180}>
                    {number !== undefined && (
                      <View style={[s.badge, { backgroundColor: color }]}>
                        <Text style={s.badgeText}>{number}</Text>
                      </View>
                    )}
                    <Text style={s.placeName}>{nameOf(run.placeId)}</Text>
                  </View>
                  <View style={s.photos}>
                    {run.photos.map((photo) => (
                      <PhotoCard key={photo.id} photo={photo} url={photoUrl(photo)} single={single} />
                    ))}
                  </View>
                </View>
              );
            })}
          </Page>
        );
      })}
    </Document>
  );
}

function PhotoCard({ photo, url, single }: { photo: TripPhoto; url?: string; single: boolean }) {
  const width = (single ? CONTENT_W : HALF_W) - 12;
  // Una sola foto va entera con su proporción (hasta media página de alto);
  // de dos en dos, todas iguales para que la rejilla cuadre.
  const ratio = photo.width && photo.height ? photo.height / photo.width : 0.75;
  const height = single ? Math.min(width * ratio, 420) : width * 0.75;
  const detail = [photoClock(photo), photo.caption].filter(Boolean).join(" · ");
  return (
    <View style={[s.card, { width: width + 12 }]} wrap={false}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- en un PDF no hay texto alternativo */}
      {url && <Image src={url} style={[s.photo, { width, height }]} />}
      {detail ? <Text style={s.caption}>{detail}</Text> : null}
    </View>
  );
}
