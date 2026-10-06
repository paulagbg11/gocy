import type { DocumentType } from "@/lib/supabase/types";

/**
 * Adivina los campos de una reserva a partir del texto de su PDF.
 *
 * No hay IA detrás: son reglas (palabras clave, formatos de fecha, etiquetas
 * como "Localizador:"), así que acierta lo evidente y falla con lo demás. Por
 * eso solo propone: el formulario se abre relleno y siempre se puede corregir.
 */
export interface ReservationGuess {
  type: DocumentType | null;
  title: string | null;
  details: Record<string, string>;
  /** Datos que se han visto pero no caben en ningún campo (una fecha sin hora). */
  hints: string[];
}

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};
// Nombres enteros o su abreviatura, no "cualquier palabra que empiece por
// mar": si no, "2 markets" contaba como el 2 de marzo.
const MONTH =
  "(ene(?:ro)?|jan(?:uary)?|feb(?:rero|ruary)?|mar(?:zo|ch)?|abr(?:il)?|apr(?:il)?|may(?:o)?|jun(?:io|e)?|" +
  "jul(?:io|y)?|ago(?:sto)?|aug(?:ust)?|sep(?:t|tiembre|tember)?|set(?:iembre)?|oct(?:ubre|ober)?|" +
  "nov(?:iembre|ember)?|dic(?:iembre)?|dec(?:ember)?)\\b\\.?";

const pad = (n: number) => String(n).padStart(2, "0");
const validDate = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 2000;

interface Found<T> {
  index: number;
  value: T;
}

/** Todas las fechas del texto, como "YYYY-MM-DD", con su posición. */
function findDates(text: string, fallbackYear: number): Found<string>[] {
  const found: Found<string>[] = [];
  const add = (index: number, y: number, m: number, d: number) => {
    if (validDate(y, m, d)) found.push({ index, value: `${y}-${pad(m)}-${pad(d)}` });
  };
  const year = (raw: string | undefined) =>
    raw ? (raw.length === 2 ? 2000 + Number(raw) : Number(raw)) : fallbackYear;

  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(m.index, +m[1], +m[2], +m[3]);
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g))
    add(m.index, year(m[3]), +m[2], +m[1]);
  // "27 oct 2026", "27 de octubre de 2026", "27 October"
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:\\s+de)?\\s+${MONTH}(?:\\s+de)?,?(?:\\s+(\\d{4}))?`, "gi")))
    add(m.index, year(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  // "Oct 27, 2026"
  for (const m of text.matchAll(new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?,?(?:\\s+(\\d{4}))?`, "gi")))
    add(m.index, year(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);

  return found.sort((a, b) => a.index - b.index);
}

/** Todas las horas del texto, como "HH:mm", con su posición. */
function findTimes(text: string): Found<string>[] {
  const found: Found<string>[] = [];
  for (const m of text.matchAll(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\s*(am|pm|a\.m\.|p\.m\.)?/gi)) {
    let hour = +m[1];
    const suffix = m[3]?.toLowerCase().replace(/\./g, "");
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    found.push({ index: m.index, value: `${pad(hour)}:${m[2]}` });
  }
  return found;
}

/**
 * Empareja cada hora con la fecha que tiene más cerca en el texto. Devuelve
 * los momentos en el orden en que aparecen, sin repetir.
 */
function findDateTimes(text: string, dates: Found<string>[], times: Found<string>[]): Found<string>[] {
  if (dates.length === 0) return [];
  const result: Found<string>[] = [];
  for (const time of times) {
    // Primero las de su misma línea: "Entrada 27 oct (desde las 15:00)" va
    // con el 27 aunque la fecha del renglón siguiente esté a menos letras.
    const lineStart = text.lastIndexOf("\n", time.index) + 1;
    const lineEnd = (text.indexOf("\n", time.index) + 1 || text.length + 1) - 1;
    const sameLine = dates.filter((d) => d.index >= lineStart && d.index < lineEnd);
    const nearest = (sameLine.length > 0 ? sameLine : dates).reduce((best, date) =>
      Math.abs(date.index - time.index) < Math.abs(best.index - time.index) ? date : best,
    );
    const value = `${nearest.value}T${time.value}`;
    if (!result.some((r) => r.value === value)) result.push({ index: time.index, value });
  }
  return result;
}

const TYPE_WORDS: [DocumentType, RegExp][] = [
  ["flight", /\b(vuelo|flight|boarding|embarque|ryanair|vueling|iberia|easyjet|airways|airlines|wizz|volotea|air europa)\b/gi],
  ["transport", /\b(tren|train|renfe|trainline|autob[uú]s|coach|flixbus|alsa|eurostar|ouigo|iryo|railway|rail|national express|and[eé]n|platform)\b/gi],
  ["lodging", /\b(hotel|hostal|hostel|apartamento|apartment|alojamiento|check-?in|check-?out|noches?|nights?|booking\.com|airbnb|habitaci[oó]n|room)\b/gi],
  ["ticket", /\b(entradas?|admission|e-?ticket|tickets?|tour|museo|museum|visita|concierto|concert)\b/gi],
  ["reservation", /\b(mesa|table|restaurante?|comensales|diners|brunch|cena|dinner)\b/gi],
];

function guessType(text: string): DocumentType | null {
  let best: { type: DocumentType; score: number } | null = null;
  for (const [type, words] of TYPE_WORDS) {
    const score = text.match(words)?.length ?? 0;
    if (score > 0 && (!best || score > best.score)) best = { type, score };
  }
  return best?.type ?? null;
}

/** Lo que viene detrás de una etiqueta ("Localizador: ABC123"), hasta el fin de línea. */
function afterLabel(text: string, labels: string, value = "([^\\n]{2,60})"): string | null {
  const match = text.match(new RegExp(`(?:${labels})\\s*[:#]?\\s*${value}`, "i"));
  return match?.[1].trim().replace(/\s{2,}.*$/, "") || null;
}

const CODE_LABELS =
  "localizador|reserva(?=\\s*:)|c[oó]digo de (?:la )?reserva|n[uú]mero de (?:la )?reserva|n[ºo°]\\.? de (?:la )?reserva|n[uú]mero de confirmaci[oó]n|" +
  "booking (?:reference|number|ref\\.?|id)|reservation (?:number|code|no\\.?)|confirmation (?:number|code|no\\.?)|" +
  "record locator|order (?:number|no\\.?)|n[uú]mero de pedido|reference|referencia|PNR";

const AIRLINES = ["Ryanair", "Vueling", "Iberia Express", "Iberia", "easyJet", "British Airways", "Air Europa", "Wizz Air", "Volotea", "TAP", "Lufthansa", "KLM", "Air France", "Jet2", "Norwegian", "Transavia", "Binter", "Austrian", "Swiss", "Eurowings"];
const CARRIERS = ["Renfe", "Trainline", "National Express", "FlixBus", "ALSA", "Eurostar", "Ouigo", "Iryo", "Stansted Express", "Gatwick Express", "Heathrow Express", "LNER", "Avanti", "GWR", "Megabus", "ÖBB", "Deutsche Bahn", "Trenitalia", "Italo", "SNCF", "Comboios de Portugal", "Rede Expressos"];

const findName = (text: string, names: string[]) =>
  names.find((name) => new RegExp(`\\b${name}\\b`, "i").test(text)) ?? null;

export function guessReservation(text: string, fileName: string): ReservationGuess {
  const clean = text.replace(/[ \t]+/g, " ");
  const details: Record<string, string> = {};
  const hints: string[] = [];
  const set = (key: string, value: string | null | undefined) => {
    if (value) details[key] = value;
  };

  const type = guessType(clean);
  const dates = findDates(clean, new Date().getFullYear());
  const moments = findDateTimes(clean, dates, findTimes(clean)).map((m) => m.value);
  const first = moments[0];
  const second = moments.find((m) => m > (first ?? ""));

  set("confirmation_code", afterLabel(clean, CODE_LABELS, "([A-Z0-9][A-Z0-9.-]{3,19})\\b"));

  let title: string | null = null;

  if (type === "flight") {
    const airline = findName(clean, AIRLINES);
    set("airline", airline);
    const number =
      clean.match(/(?:vuelo|flight)\s*(?:n[ºo°.]*|number|no\.?)?\s*[:#]?\s*([A-Z0-9]{2}\s?\d{2,4})\b/i)?.[1] ??
      clean.match(/\b([A-Z]{2}\s?\d{3,4})\b/)?.[1];
    set("flight_number", number?.toUpperCase());
    // "Madrid (MAD)" o, si no, los códigos sueltos de "MAD - STN".
    const airports = [...clean.matchAll(/([A-ZÀ-Ý][\p{L}.' -]{2,30}?)\s*\(([A-Z]{3})\)/gu)].map(
      (m) => `${m[1].trim()} (${m[2]})`,
    );
    const pair = clean.match(/\b([A-Z]{3})\s*(?:-|–|→|>|to|a)\s*([A-Z]{3})\b/);
    set("departure_airport", airports[0] ?? pair?.[1]);
    set("arrival_airport", airports.find((a) => a !== airports[0]) ?? pair?.[2]);
    set("departure_time", first);
    set("arrival_time", second);
    const route = [details.departure_airport, details.arrival_airport]
      .filter(Boolean)
      .map((a) => a.match(/\(([A-Z]{3})\)/)?.[1] ?? a)
      .join(" → ");
    title = ["Vuelo", route || airline].filter(Boolean).join(" ");
  } else if (type === "transport") {
    const company = findName(clean, CARRIERS);
    set("company", company);
    set("departure_station", afterLabel(clean, "from|desde|origen|salida de|departs from"));
    set("arrival_station", afterLabel(clean, "\\bto\\b|hasta|destino|llegada a|arrives at"));
    set("seat", afterLabel(clean, "asiento|seat|plaza", "([A-Z0-9]{1,4})\\b"));
    set("service_number", afterLabel(clean, "tren|train|servicio|service|bus", "(?:n[ºo°.]*\\s*)?([A-Z]{0,3}\\s?\\d{2,6})\\b"));
    set("departure_time", first);
    set("arrival_time", second);
    const route = [details.departure_station, details.arrival_station].filter(Boolean).join(" → ");
    title = route || company;
  } else if (type === "lodging") {
    // Con etiquetas de entrada y salida se acierta más que cogiendo las dos
    // primeras fechas, que a veces son la de la reserva y la de la factura.
    const dateAfter = (labels: RegExp) => {
      const at = clean.search(labels);
      return at === -1 ? undefined : dates.find((d) => d.index > at && d.index - at < 120)?.value;
    };
    const checkIn = dateAfter(/check-?in|entrada|llegada|arrival/i) ?? dates[0]?.value;
    const checkOut =
      dateAfter(/check-?out|salida|departure/i) ?? dates.find((d) => d.value > (checkIn ?? ""))?.value;
    // Sin hora junto a la fecha, el campo se queda en blanco (pide fecha y
    // hora a la vez, e inventarse la hora es peor que no ponerla). La fecha
    // se devuelve como pista para escribirla a mano.
    const fill = (key: string, label: string, date: string | undefined) => {
      if (!date) return;
      const moment = moments.find((m) => m.startsWith(date));
      if (moment) set(key, moment);
      else hints.push(`${label} el ${date.split("-").reverse().join("/")}, sin hora en el PDF`);
    };
    fill("check_in", "check-in", checkIn);
    fill("check_out", "check-out", checkOut);
    set("address", afterLabel(clean, "direcci[oó]n|address"));
    title =
      clean
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length < 60 && /\b(hotel|hostal|hostel|apartments?|apartamentos?|inn|suites?)\b/i.test(line)) ?? null;
  } else {
    set("date_time", first);
    // Estos PDF suelen empezar por el nombre del sitio o del evento.
    title =
      clean
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 2 && line.length < 50) ?? null;
    if (type === "ticket") {
      set("quantity", clean.match(/\b(\d{1,2})\s*x?\s*(?:entradas?|tickets?|adult[oa]?s?)\b/i)?.[1]);
      set("seat", afterLabel(clean, "asiento|seat|zona|zone", "([A-Z0-9 ]{1,12})\\b"));
    } else {
      set("party_size", clean.match(/\b(\d{1,2})\s*(?:personas?|comensales|guests?|people|pax|adult[oa]?s?)\b/i)?.[1]);
    }
  }

  return {
    type,
    title: title || fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || null,
    details,
    hints,
  };
}
