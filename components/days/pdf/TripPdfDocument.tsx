import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Path,
  Svg,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { documentJourney, DOCUMENT_FIELDS, formatFieldValue } from "@/lib/documents";
import { googleMapsUrl } from "@/lib/google-place";
import { formatDistance } from "@/lib/geo";
import { stepColor, textOn, transitModeInfo } from "@/lib/days/transit";
import {
  walkingMinutes,
  type DayEvent,
  type SummaryDay,
  type SummaryStop,
  type TripSummary,
} from "@/lib/pdf/tripSummary";
import { MAP_WIDTH, type PdfMap, type PdfMapSet, type PdfMaps } from "@/lib/pdf/maps";
import type { TransitStep, TripDocument } from "@/lib/supabase/types";

/**
 * La guía del viaje en PDF (A4). Este módulo solo se carga al exportar: la
 * librería pesa lo suyo y no tiene sentido meterla en la carga de la app.
 *
 * Helvetica, la fuente que trae el PDF, no tiene letras como la "ő" de
 * Budapest: por eso se incrusta Roboto, servida desde /fonts. Los emojis se
 * sustituyen por imágenes de Twemoji.
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
Font.registerEmojiSource({
  format: "png",
  url: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/",
});
// Sin esto parte las palabras con guiones a la inglesa ("Resta-urante").
Font.registerHyphenationCallback((word) => [word]);

const C = {
  accent: "#2f6f7e",
  fg: "#1f2a2e",
  muted: "#647880",
  soft: "#eef3f4",
  line: "#d5dee1",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 52,
    paddingHorizontal: 36,
    fontFamily: "Roboto",
    fontSize: 10,
    color: C.fg,
  },
  // El interlineado se pone texto a texto: puesto en la página, react-pdf deja
  // de pintar los elementos `fixed` (el pie desaparecía sin avisar), y puesto
  // en un View lo hereda mal y separa las líneas el doble.
  para: { lineHeight: 1.3 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.muted,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginTop: 20,
    marginBottom: 8,
    color: C.fg,
  },
  sectionHint: { lineHeight: 1.3, fontSize: 8.5, color: C.muted, marginTop: -5, marginBottom: 8 },
  muted: { color: C.muted },
  small: { fontSize: 8.5 },
  bold: { fontWeight: 700 },
  medium: { fontWeight: 500 },
  card: {
    borderWidth: 0.75,
    borderColor: C.line,
    borderRadius: 6,
    padding: 9,
    marginBottom: 6,
  },
});

// ─── Utilidades de formato ─────────────────────────────────────────────────

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const longDate = (date: string) =>
  capitalize(format(parseISO(date), "EEEE d 'de' MMMM", { locale: es }));
const shortDate = (date: string) => format(parseISO(date), "EEE d MMM", { locale: es });

function tripRange(start: string, end: string) {
  const a = parseISO(start);
  const b = parseISO(end);
  const sameMonth = format(a, "yyyy-MM") === format(b, "yyyy-MM");
  return sameMonth
    ? `${format(a, "d")} – ${format(b, "d 'de' MMMM 'de' yyyy", { locale: es })}`
    : `${format(a, "d 'de' MMMM", { locale: es })} – ${format(b, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function timeSpan(day: SummaryDay) {
  const times = day.stops.map((st) => st.time).filter((t): t is string => !!t);
  if (times.length === 0) return null;
  if (times.length === 1) return `desde las ${times[0]}`;
  return `de ${times[0]} a ${times[times.length - 1]}`;
}

const DOC_EMOJI: Record<TripDocument["type"], string> = {
  flight: "✈️",
  transport: "🚆",
  lodging: "🏨",
  reservation: "🍽️",
  ticket: "🎟️",
  note: "📝",
};

const EVENT_LABEL: Record<DayEvent["kind"], string> = {
  flight: "Vuelo",
  transport: "Tren / bus",
  "lodging-in": "Check-in",
  "lodging-out": "Check-out",
  reservation: "Reserva",
  ticket: "Entrada",
};

const detail = (doc: TripDocument, key: string) => {
  const raw = (doc.details as Record<string, unknown>)[key];
  return raw === null || raw === undefined || raw === "" ? null : String(raw);
};

/** Una línea que resume el documento: "MAD 10:05 › LHR 11:25", la dirección… */
function documentLine(doc: TripDocument): string | null {
  const journey = documentJourney(doc.type, doc.details);
  if (journey && doc.type !== "lodging") {
    const end = (e: typeof journey.from) => [e.place, e.time].filter(Boolean).join(" ");
    return [end(journey.from), end(journey.to)].filter(Boolean).join(" › ");
  }
  if (doc.type === "lodging") return detail(doc, "address");
  if (doc.type === "reservation") return detail(doc, "place_name");
  if (doc.type === "ticket") return detail(doc, "venue");
  return null;
}

// ─── Piezas ────────────────────────────────────────────────────────────────

function Footer({ tripName }: { tripName: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{tripName} · Guía del viaje · GoCy</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ marginRight: 22 }}>
      <Text style={{ fontSize: 16, fontWeight: 700 }}>{value}</Text>
      <Text style={{ fontSize: 8, opacity: 0.85, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

/** Mapa con el fondo de Google y, encima, el recorrido y los pines. */
function MapFigure({ map, pinSize }: { map: PdfMap; pinSize: number }) {
  const r = pinSize / 2;
  return (
    <View
      style={{
        width: map.width,
        height: map.height,
        borderRadius: 6,
        overflow: "hidden",
        backgroundColor: C.soft,
        position: "relative",
      }}
    >
      {map.src && (
        // eslint-disable-next-line jsx-a11y/alt-text -- en un PDF no hay texto alternativo
        <Image
          src={map.src}
          style={{ position: "absolute", top: 0, left: 0, width: map.width, height: map.height }}
        />
      )}
      <Svg
        width={map.width}
        height={map.height}
        viewBox={`0 0 ${map.width} ${map.height}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {map.paths.map((path, i) => (
          <Path
            key={i}
            d={path.points
              .map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(" ")}
            stroke={path.color}
            strokeWidth={2.2}
            strokeOpacity={0.85}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
      {map.pins.map((pin, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: pin.x - r,
            top: pin.y - r,
            width: pinSize,
            height: pinSize,
            borderRadius: r,
            backgroundColor: pin.color,
            borderWidth: 1.5,
            borderColor: C.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {pin.label && (
            <Text
              style={{
                color: textOn(pin.color),
                fontSize: pinSize * 0.5,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {pin.label}
            </Text>
          )}
        </View>
      ))}
      {!map.src && (
        <Text style={{ position: "absolute", bottom: 6, left: 8, fontSize: 7, color: C.muted }}>
          Mapa de fondo no disponible
        </Text>
      )}
    </View>
  );
}

/**
 * El mapa principal y, si hay paradas lejos, el de todo al lado. Cada uno con
 * su rótulo para que se entienda por qué hay dos.
 */
function MapSetFigure({
  set,
  pinSize,
  labels,
}: {
  set: PdfMapSet;
  pinSize: { main: number; wide: number };
  labels: { main: string; wide: string };
}) {
  if (!set.wide) return <MapFigure map={set.main} pinSize={pinSize.main} />;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", width: MAP_WIDTH }}>
      <View>
        <MapFigure map={set.main} pinSize={pinSize.main} />
        <Text style={[s.small, s.muted, { marginTop: 3 }]}>{labels.main}</Text>
      </View>
      <View>
        <MapFigure map={set.wide} pinSize={pinSize.wide} />
        <Text style={[s.small, s.muted, { marginTop: 3 }]}>{labels.wide}</Text>
      </View>
    </View>
  );
}

function BookingCard({ doc }: { doc: TripDocument }) {
  const journey = documentJourney(doc.type, doc.details);
  const shown = new Set(journey?.fields ?? []);
  const line = documentLine(doc);
  if (doc.type === "lodging") shown.add("address");
  if (doc.type === "reservation") shown.add("place_name");
  if (doc.type === "ticket") shown.add("venue");

  const fields = DOCUMENT_FIELDS[doc.type]
    .filter((f) => !shown.has(f.key) || doc.type === "lodging")
    .filter((f) => f.key !== "address")
    .map((f) => ({
      label: f.label,
      value: formatFieldValue(f, (doc.details as Record<string, unknown>)[f.key]),
    }))
    .filter((f): f is { label: string; value: string } => !!f.value);

  const date = journey?.from.date;

  return (
    <View style={[s.card, { flexDirection: "row" }]} wrap={false}>
      <Text style={{ fontSize: 14, width: 24 }}>{DOC_EMOJI[doc.type]}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[s.bold, { fontSize: 10.5, flex: 1 }]}>{doc.title}</Text>
          {date && doc.type !== "lodging" && (
            <Text style={[s.small, s.muted]}>{capitalize(date)}</Text>
          )}
        </View>
        {line && <Text style={[s.medium, { marginTop: 1 }]}>{line}</Text>}
        {fields.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3 }}>
            {fields.map((f) => (
              <Text key={f.label} style={[s.small, { marginRight: 12 }]}>
                <Text style={s.muted}>{f.label}: </Text>
                {f.value}
              </Text>
            ))}
          </View>
        )}
        {doc.notes && <Text style={[s.para, s.small, s.muted, { marginTop: 3 }]}>{doc.notes}</Text>}
      </View>
    </View>
  );
}

// ─── Portada y resumen ─────────────────────────────────────────────────────

function DayOverviewRow({ day }: { day: SummaryDay }) {
  const span = timeSpan(day);
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        borderBottomWidth: 0.5,
        borderBottomColor: C.line,
        paddingVertical: 7,
      }}
    >
      <View style={{ width: 4, borderRadius: 2, backgroundColor: day.color, marginRight: 8 }} />
      <View style={{ width: 62 }}>
        <Text style={{ fontWeight: 700, color: day.color }}>Día {day.day.day_index}</Text>
        <Text style={[s.small, s.muted]}>{capitalize(shortDate(day.day.date))}</Text>
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        {day.day.label && <Text style={[s.bold, { marginBottom: 1 }]}>{day.day.label}</Text>}
        {day.stops.length > 0 ? (
          <Text style={[s.para, { fontSize: 9 }]}>
            {day.stops.map((st, i) => (
              <Text key={st.link.id}>
                {i > 0 && <Text style={s.muted}> › </Text>}
                {st.time && <Text style={s.bold}>{st.time} </Text>}
                {st.place.name}
              </Text>
            ))}
          </Text>
        ) : (
          <Text style={[s.small, s.muted]}>Sin planificar todavía</Text>
        )}
        {day.events.length > 0 && (
          <Text style={[s.small, { marginTop: 2 }]}>
            {day.events.map((ev, i) => (
              <Text key={`${ev.document.id}-${ev.kind}`}>
                {i > 0 && " · "}
                {DOC_EMOJI[ev.document.type]} {EVENT_LABEL[ev.kind]}
                {ev.time ? ` ${ev.time}` : ""}: {ev.document.title}
              </Text>
            ))}
          </Text>
        )}
        {day.sleep && (
          <Text style={[s.small, s.muted, { marginTop: 1 }]}>🛏️ Dormís en {day.sleep.title}</Text>
        )}
      </View>
      <View style={{ width: 72, alignItems: "flex-end" }}>
        <Text style={[s.small, s.medium]}>{plural(day.stops.length, "parada", "paradas")}</Text>
        {span && <Text style={[s.small, s.muted]}>{span}</Text>}
        {day.meters > 0 && <Text style={[s.small, s.muted]}>≈ {formatDistance(day.meters)}</Text>}
      </View>
    </View>
  );
}

function CoverPage({ summary, maps }: { summary: TripSummary; maps: PdfMaps }) {
  const { trip, days, bookings, unassigned } = summary;
  const totalMeters = days.reduce((sum, d) => sum + d.meters, 0);
  const plannedDays = days.filter((d) => d.stops.length > 0);

  return (
    <Page size="A4" style={s.page}>
      <View style={{ backgroundColor: C.accent, borderRadius: 10, padding: 20, color: C.white }}>
        <Text style={{ fontSize: 8, letterSpacing: 1.6, opacity: 0.8 }}>GUÍA DEL VIAJE</Text>
        <Text style={{ fontSize: 26, fontWeight: 700, marginTop: 4, lineHeight: 1.15 }}>
          {trip.name}
        </Text>
        <Text style={{ fontSize: 11, marginTop: 4, opacity: 0.92 }}>
          {[trip.destination, tripRange(trip.start_date, trip.end_date)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={{ flexDirection: "row", marginTop: 14 }}>
          <Stat value={String(days.length)} label={days.length === 1 ? "día" : "días"} />
          <Stat value={String(summary.stopCount)} label="paradas planeadas" />
          <Stat value={String(bookings.length)} label="reservas y billetes" />
          {totalMeters > 0 && (
            <Stat value={formatDistance(totalMeters)} label="entre paradas (en línea recta)" />
          )}
        </View>
      </View>

      {maps.overview && (
        <View style={{ marginTop: 16 }}>
          <MapSetFigure
            set={maps.overview}
            pinSize={{ main: 7, wide: 6 }}
            labels={{ main: "Donde se concentra el viaje", wide: "El viaje entero" }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
            {plannedDays.map((d) => (
              <View
                key={d.day.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginRight: 12,
                  marginBottom: 2,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: d.color,
                    marginRight: 4,
                  }}
                />
                <Text style={[s.small]}>
                  Día {d.day.day_index}
                  {d.day.label ? ` · ${d.day.label}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={s.sectionTitle}>El viaje día a día</Text>
      <Text style={s.sectionHint}>
        Paradas en el orden previsto. Cada día tiene después su página con mapa, horario y
        trayectos.
      </Text>
      {days.map((d) => (
        <DayOverviewRow key={d.day.id} day={d} />
      ))}

      {bookings.length > 0 && (
        <>
          <Text style={s.sectionTitle} minPresenceAhead={60}>
            Reservas y billetes
          </Text>
          {bookings.map((doc) => (
            <BookingCard key={doc.id} doc={doc} />
          ))}
        </>
      )}

      {unassigned.length > 0 && (
        <>
          <Text style={s.sectionTitle} minPresenceAhead={60}>
            Guardados sin día
          </Text>
          <Text style={s.sectionHint}>
            Lugares que tenéis guardados pero que aún no habéis metido en ningún día.
          </Text>
          {unassigned.map(({ category, places }) => (
            <View key={category?.id ?? "sin"} wrap={false} style={{ marginBottom: 6 }}>
              <Text style={s.bold}>
                {category?.emoji ?? "📍"} {category?.name ?? "Sin categoría"}{" "}
                <Text style={[s.muted, { fontWeight: 400 }]}>({places.length})</Text>
              </Text>
              <Text style={[s.para, { fontSize: 9 }]}>{places.map((p) => p.name).join(" · ")}</Text>
            </View>
          ))}
        </>
      )}

      <Footer tripName={trip.name} />
    </Page>
  );
}

// ─── Página de cada día ────────────────────────────────────────────────────

function EventRow({ event }: { event: DayEvent }) {
  const doc = event.document;
  const line = documentLine(doc);
  const code = detail(doc, "confirmation_code");
  return (
    <View style={{ flexDirection: "row", marginBottom: 4 }} wrap={false}>
      <Text style={{ width: 20, fontSize: 11 }}>{DOC_EMOJI[doc.type]}</Text>
      <Text style={[s.bold, { width: 36 }]}>{event.time ?? ""}</Text>
      <View style={{ flex: 1 }}>
        <Text>
          <Text style={s.muted}>{EVENT_LABEL[event.kind]} · </Text>
          <Text style={s.medium}>{doc.title}</Text>
        </Text>
        {(line || code) && (
          <Text style={[s.small, s.muted]}>
            {[line, code && `Localizador ${code}`].filter(Boolean).join(" · ")}
          </Text>
        )}
      </View>
    </View>
  );
}

function TransitStepCard({ step }: { step: TransitStep }) {
  const mode = transitModeInfo(step.mode);
  const color = stepColor(step);
  const walk = step.mode === "walk";
  const details = [
    step.stops ? plural(step.stops, "parada", "paradas") : null,
    step.minutes ? `${step.minutes} min` : null,
  ].filter(Boolean);

  return (
    <View
      wrap={false}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: color,
        backgroundColor: C.soft,
        borderRadius: 4,
        paddingVertical: 5,
        paddingHorizontal: 8,
        marginBottom: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
        <Text
          style={{
            backgroundColor: color,
            color: textOn(color),
            fontWeight: 700,
            fontSize: 9,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: 3,
            marginRight: 6,
          }}
        >
          {mode.emoji} {step.line || mode.label}
        </Text>
        {step.direction && (
          <Text style={[s.bold, { fontSize: 10 }]}>dirección {step.direction}</Text>
        )}
      </View>
      {(step.from || step.platform) && (
        <Text style={{ fontSize: 9, marginTop: 2 }}>
          {step.from && (
            <>
              <Text style={s.muted}>{walk ? "Desde " : "Sube en "}</Text>
              <Text style={s.medium}>{step.from}</Text>
            </>
          )}
          {step.from && step.platform && <Text style={s.muted}> · </Text>}
          {step.platform && (
            <>
              <Text style={s.muted}>Andén </Text>
              <Text style={s.medium}>{step.platform}</Text>
            </>
          )}
        </Text>
      )}
      {(step.to || details.length > 0) && (
        <Text style={{ fontSize: 9 }}>
          {step.to && (
            <>
              <Text style={s.muted}>{walk ? "Hasta " : "Baja en "}</Text>
              <Text style={s.bold}>{step.to}</Text>
            </>
          )}
          {details.length > 0 && (
            <Text style={s.muted}>
              {step.to ? " · " : ""}
              {details.join(" · ")}
            </Text>
          )}
        </Text>
      )}
      {step.note && <Text style={[s.para, s.small, s.muted, { marginTop: 1 }]}>{step.note}</Text>}
    </View>
  );
}

/** Columna de la izquierda: hora + círculo. Mide lo mismo en paradas y tramos. */
const TIME_W = 38;
const DOT = 22;

function StopBlock({ stop }: { stop: SummaryStop }) {
  const meta = [stop.categoryName, stop.place.address].filter(Boolean).join(" · ");
  return (
    <View style={{ flexDirection: "row" }} wrap={false}>
      <Text style={{ width: TIME_W, fontWeight: 700, fontSize: 10.5, paddingTop: 4 }}>
        {stop.time ?? ""}
      </Text>
      <View
        style={{
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: stop.color,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        <Text style={{ color: textOn(stop.color), fontWeight: 700, fontSize: 10, lineHeight: 1 }}>
          {stop.order}
        </Text>
      </View>
      <View style={{ flex: 1, paddingTop: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: 700 }}>
          {stop.emoji} {stop.place.name}
        </Text>
        {meta && <Text style={[s.small, s.muted]}>{meta}</Text>}
        {stop.notes && (
          <View style={{ backgroundColor: "#fbf6e7", borderRadius: 4, padding: 6, marginTop: 4 }}>
            <Text style={[s.para, { fontSize: 9.5 }]}>{stop.notes}</Text>
          </View>
        )}
        <Link
          src={googleMapsUrl(stop.place)}
          style={{ fontSize: 8, color: C.accent, marginTop: 3, textDecoration: "none" }}
        >
          Abrir en Google Maps ›
        </Link>
      </View>
    </View>
  );
}

function Leg({ stop, next }: { stop: SummaryStop; next: SummaryStop }) {
  const minutes = stop.transit.reduce((sum, st) => sum + (st.minutes ?? 0), 0);
  const meters = stop.metersToNext ?? 0;
  return (
    <View
      wrap={false}
      style={{
        marginLeft: TIME_W + DOT / 2 - 1,
        borderLeftWidth: 2,
        borderLeftColor: C.line,
        borderLeftStyle: stop.transit.length > 0 ? "solid" : "dashed",
        paddingLeft: DOT / 2 + 9,
        paddingVertical: 6,
      }}
    >
      {stop.transit.length > 0 ? (
        <>
          <Text style={[s.small, s.muted, { marginBottom: 3 }]} minPresenceAhead={40}>
            Cómo llegar a <Text style={[s.medium, { color: C.fg }]}>{next.place.name}</Text>
            {minutes > 0 ? ` · unos ${minutes} min en total` : ""}
          </Text>
          {stop.transit.map((step, i) => (
            <TransitStepCard key={i} step={step} />
          ))}
        </>
      ) : meters < 30 ? (
        <Text style={[s.small, s.muted]}>Al lado</Text>
      ) : (
        <Text style={[s.small, s.muted]}>
          ≈ {formatDistance(meters)} en línea recta
          {meters < 3000 ? ` · unos ${walkingMinutes(meters)} min a pie` : " · mejor en transporte"}
        </Text>
      )}
    </View>
  );
}

function DayPage({
  day,
  map,
  tripName,
}: {
  day: SummaryDay;
  map: PdfMapSet | undefined;
  tripName: string;
}) {
  const span = timeSpan(day);
  const stats = [
    plural(day.stops.length, "parada", "paradas"),
    span,
    day.meters > 0 ? `≈ ${formatDistance(day.meters)} entre paradas` : null,
  ].filter(Boolean);

  return (
    <Page size="A4" style={s.page}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: day.color,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text style={{ color: C.white, fontSize: 7, letterSpacing: 1, lineHeight: 1 }}>DÍA</Text>
          <Text style={{ color: C.white, fontSize: 18, fontWeight: 700, lineHeight: 1.05 }}>
            {day.day.day_index}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15 }}>
            {longDate(day.day.date)}
          </Text>
          {day.day.label && (
            <Text style={{ fontSize: 11, color: day.color, fontWeight: 500 }}>{day.day.label}</Text>
          )}
          <Text style={[s.small, s.muted, { marginTop: 1 }]}>{stats.join(" · ")}</Text>
        </View>
        {day.day.completed && (
          <Text
            style={{
              fontSize: 8,
              color: C.accent,
              borderWidth: 0.75,
              borderColor: C.accent,
              borderRadius: 8,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            Completado
          </Text>
        )}
      </View>

      {(day.events.length > 0 || day.sleep) && (
        <View
          style={[s.card, { marginTop: 12, backgroundColor: C.soft, borderColor: C.soft }]}
          wrap={false}
        >
          {day.events.map((ev) => (
            <EventRow key={`${ev.document.id}-${ev.kind}`} event={ev} />
          ))}
          {day.sleep && (
            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: 20, fontSize: 11 }}>🛏️</Text>
              <Text style={{ flex: 1 }}>
                <Text style={s.muted}>Esta noche dormís en </Text>
                <Text style={s.medium}>{day.sleep.title}</Text>
                {detail(day.sleep, "address") ? (
                  <Text style={s.muted}> · {detail(day.sleep, "address")}</Text>
                ) : null}
              </Text>
            </View>
          )}
        </View>
      )}

      {map && (
        <View style={{ marginTop: 12 }}>
          <MapSetFigure
            set={map}
            pinSize={{ main: 15, wide: 12 }}
            labels={{ main: "Donde se concentra el día", wide: "El día entero" }}
          />
        </View>
      )}

      <Text style={s.sectionTitle}>Itinerario</Text>
      {day.stops.length === 0 && (
        <Text style={s.muted}>Todavía no hay nada asignado a este día.</Text>
      )}
      {day.stops.map((stop, i) => {
        const next = day.stops[i + 1];
        return (
          <View key={stop.link.id}>
            <StopBlock stop={stop} />
            {next && <Leg stop={stop} next={next} />}
          </View>
        );
      })}

      <Footer tripName={tripName} />
    </Page>
  );
}

export function TripPdfDocument({ summary, maps }: { summary: TripSummary; maps: PdfMaps }) {
  return (
    <Document title={`${summary.trip.name} · Guía del viaje`} author="GoCy" language="es">
      <CoverPage summary={summary} maps={maps} />
      {summary.days.map((day) => (
        <DayPage
          key={day.day.id}
          day={day}
          map={maps.byDay.get(day.day.id)}
          tripName={summary.trip.name}
        />
      ))}
    </Document>
  );
}
