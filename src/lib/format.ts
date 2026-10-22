import { toPersianDigits } from "./normalize";

export function toman(n: number | null | undefined): string {
  if (n == null) return "قیمت ثبت نشده";
  return `${toPersianDigits(Math.round(n).toLocaleString("en-US")).replace(/,/g, "٬")} تومان`;
}

/** Compact: ۱۲٫۵ میلیون */
export function tomanShort(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${toPersianDigits((n / 1e9).toFixed(n % 1e9 ? 1 : 0))} میلیارد`;
  if (n >= 1e6) return `${toPersianDigits((n / 1e6).toFixed(n % 1e6 >= 1e5 ? 1 : 0)).replace(".", "٫")} میلیون`;
  if (n >= 1e3) return `${toPersianDigits(Math.round(n / 1e3))} هزار`;
  return toPersianDigits(n);
}

export function km(d: number | null | undefined): string {
  if (d == null) return "فاصله نامشخص";
  if (d < 1) return `${toPersianDigits(Math.round(d * 1000 / 50) * 50)} متر`;
  return `${toPersianDigits(d.toFixed(1)).replace(".", "٫")} کیلومتر`;
}

export function ageDays(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400000));
}

export function ago(iso: string | null | undefined): string {
  const d = ageDays(iso);
  if (d == null) return "زمان به‌روزرسانی نامشخص";
  if (d === 0) return "امروز";
  if (d === 1) return "دیروز";
  if (d < 30) return `${toPersianDigits(d)} روز پیش`;
  return `${toPersianDigits(Math.floor(d / 30))} ماه پیش`;
}

export function faDate(iso: string | null | undefined): string {
  if (!iso) return "نامشخص";
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function faTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(iso));
}

export const fa = toPersianDigits;
