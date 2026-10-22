// Defensive parsers for JSON-ish CSV columns. They never throw.

export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === "" || raw === "null") return fallback;
  try {
    const v = JSON.parse(raw);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/* ---------------- Opening hours ---------------- */

export const DAY_KEYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DAY_FA: Record<DayKey, string> = {
  sat: "شنبه",
  sun: "یکشنبه",
  mon: "دوشنبه",
  tue: "سه‌شنبه",
  wed: "چهارشنبه",
  thu: "پنجشنبه",
  fri: "جمعه",
};

/** Minutes since midnight; end may be 1440 (midnight). */
export interface Shift {
  start: number;
  end: number;
}
export type DayStatus = "open" | "closed" | "unknown";
export interface DayHours {
  status: DayStatus;
  shifts: Shift[];
}
/** null => the shop did not register any schedule. */
export type WeeklyHours = Record<DayKey, DayHours> | null;

function toMin(t: unknown): number | null {
  if (typeof t !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

export function parseWeeklyHours(raw: string | null | undefined): WeeklyHours {
  const obj = safeJson<Record<string, { status?: string; shifts?: { start_time?: string; end_time?: string }[] }>>(raw, {});
  if (!obj || typeof obj !== "object" || Object.keys(obj).length === 0) return null;
  const out = {} as Record<DayKey, DayHours>;
  let anyKnown = false;
  for (const d of DAY_KEYS) {
    const day = obj[d];
    if (!day) {
      out[d] = { status: "unknown", shifts: [] };
      continue;
    }
    if (day.status === "closed") {
      out[d] = { status: "closed", shifts: [] };
      anyKnown = true;
      continue;
    }
    if (day.status !== "declared") {
      out[d] = { status: "unknown", shifts: [] };
      continue;
    }
    const shifts: Shift[] = [];
    for (const s of day.shifts ?? []) {
      const start = toMin(s.start_time);
      let end = toMin(s.end_time);
      if (start == null || end == null) continue;
      if (end === 0 && start > 0) end = 1440; // closes at midnight
      if (end <= start) continue; // placeholder 00:00-00:00 or overnight (rare, ignored)
      shifts.push({ start, end });
    }
    out[d] = shifts.length ? { status: "open", shifts } : { status: "unknown", shifts: [] };
    if (shifts.length) anyKnown = true;
  }
  return anyKnown ? out : null;
}

const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Current day/minute in Tehran (UTC+3:30, no DST since 2022). */
export function tehranNow(date = new Date()): { day: DayKey; minute: number } {
  const t = new Date(date.getTime() + 210 * 60 * 1000);
  return { day: JS_DAY_TO_KEY[t.getUTCDay()], minute: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

export type OpenState = "open" | "closed" | "unknown";

/** Declared status at a given day/minute. Never a live guarantee. */
export function declaredOpenAt(h: WeeklyHours, day: DayKey, minute: number): OpenState {
  if (!h) return "unknown";
  const d = h[day];
  if (d.status === "closed") return "closed";
  if (d.status === "unknown") return "unknown";
  return d.shifts.some((s) => minute >= s.start && minute < s.end) ? "open" : "closed";
}

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mi = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function describeDay(d: DayHours): string {
  if (d.status === "closed") return "تعطیل";
  if (d.status === "unknown") return "ثبت نشده";
  return d.shifts.map((s) => `${fmtMin(s.start)} تا ${fmtMin(s.end)}`).join(" و ");
}

/* ---------------- Payment / installments ---------------- */

export interface PaymentOption {
  provider: string;
  inPerson: boolean; // channel === "in_person" explicitly
  minPrice: number | null;
  maxPrice: number | null;
}

export function parsePaymentOptions(raw: string | null | undefined): PaymentOption[] {
  const arr = safeJson<unknown[]>(raw, []);
  if (!Array.isArray(arr)) return [];
  const out: PaymentOption[] = [];
  for (const p of arr as Record<string, unknown>[]) {
    if (!p || typeof p.provider_name !== "string" || !p.provider_name.trim()) continue;
    out.push({
      provider: p.provider_name.trim(),
      inPerson: p.channel === "in_person",
      minPrice: typeof p.min_price_toman === "number" ? p.min_price_toman : null,
      maxPrice: typeof p.max_price_toman === "number" ? p.max_price_toman : null,
    });
  }
  return out;
}

export function isTorobPay(provider: string): boolean {
  return provider.replace(/[\s‌]/g, "").includes("ترب");
}

/* ---------------- Warranty ---------------- */

export function parseWarranty(raw: string | null | undefined): string | null {
  if (!raw || raw === "null") return null;
  const w = safeJson<Record<string, unknown> | null>(raw, null);
  if (w && typeof w === "object") {
    const parts = [w.provider, w.duration, w.title].filter((x) => typeof x === "string" && x.trim());
    return parts.length ? parts.join(" — ") : null;
  }
  return raw.trim() || null;
}

/* ---------------- Address (mall / floor / unit) ---------------- */

export interface AddressParts {
  mall: string | null;
  floor: string | null;
  unit: string | null;
}

const MALL_RE = /((?:پاساژ|مجتمع(?:\s+تجاری)?(?:\s+اداری)?(?:\s+تجاری)?|مرکز\s+(?:خرید|تجارت|تجاری)|برج|بازار|ساختمان|تیمچه|سرای)\s*[^،,]{1,40})/;
const FLOOR_RE = /((?:طبقه\s*[^،,]{1,15})|(?:زیر\s*همکف|همکف|زیرزمین|منفی\s*\S+|بالکن|نیم\s*طبقه))/;
const UNIT_RE = /((?:واحد|پلاک|غرفه|مغازه|شماره)\s*[^،,]{1,12})/;

export function parseAddress(address: string | null | undefined): AddressParts {
  if (!address) return { mall: null, floor: null, unit: null };
  const clean = address.replace(/\s+/g, " ");
  const mall = MALL_RE.exec(clean)?.[1]?.trim() ?? null;
  const floor = FLOOR_RE.exec(clean)?.[1]?.trim() ?? null;
  // Prefer explicit unit (واحد/غرفه) over street plate (پلاک) when both exist.
  const unitMatch = /((?:واحد|غرفه|مغازه)\s*[^،,]{1,12})/.exec(clean) ?? UNIT_RE.exec(clean);
  const unit = mall || floor ? unitMatch?.[1]?.trim().replace(/\.0$/, "") ?? null : null;
  return { mall, floor, unit };
}
