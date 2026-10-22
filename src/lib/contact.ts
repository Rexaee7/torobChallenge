// Seller follow-up: message composer + deterministic SIMULATED replies.
// No real message is ever sent — dataset phone numbers are fake.
import type { ContactResult, ContactStatus } from "./types";
import { toPersianDigits } from "./normalize";

export interface ContactRequest {
  shopName: string | null;
  productTitle: string;
  price: number | null;
  asks: Ask[];
  hasMall: boolean;
  unitKnown: boolean;
  /** Optional forced outcome (demo control). */
  force?: ContactStatus;
  seed: string;
}

export type Ask = "price" | "stock" | "hours" | "installment" | "location" | "warranty" | "variant";

export const ASK_LABELS: Record<Ask, string> = {
  price: "قیمت امروز",
  stock: "موجودی",
  variant: "رنگ/سایز/مدل",
  warranty: "گارانتی",
  installment: "شرایط قسطی",
  hours: "ساعت کاری امروز",
  location: "طبقه و واحد دقیق",
};

export const fmtToman = (n: number) => toPersianDigits(Math.round(n).toLocaleString("en-US")).replace(/,/g, "٬");

export function composeMessage(r: Pick<ContactRequest, "shopName" | "productTitle" | "price" | "asks">): string {
  const lines = [`سلام${r.shopName ? ` ${r.shopName}` : ""}، وقت بخیر.`, `درباره «${r.productTitle}» سؤال داشتم:`];
  const q: Record<Ask, string> = {
    price: r.price ? `قیمت ثبت‌شده در ترب ${fmtToman(r.price)} تومان است؛ قیمت امروز چقدر است؟` : "قیمت امروز چقدر است؟",
    stock: "الان موجود دارید؟ اگر بیام حضوری هست؟",
    variant: "چه رنگ/سایز/مدل‌هایی موجود دارید؟",
    warranty: "گارانتی‌اش چیست و چند ماه است؟",
    installment: "امکان خرید قسطی یا اعتباری دارید؟ با چه سرویسی؟",
    hours: "امروز تا چه ساعتی باز هستید؟",
    location: "دقیقاً کدام طبقه و واحد هستید؟ نشانه‌ای برای پیدا کردن مغازه دارید؟",
  };
  r.asks.forEach((a, i) => lines.push(`${toPersianDigits(i + 1)}. ${q[a]}`));
  lines.push("ممنون.");
  return lines.join("\n");
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const OUTCOMES: ContactStatus[] = ["CONFIRMED", "CONFIRMED", "PRICE_CHANGED", "CONFIRMED", "OUT_OF_STOCK", "NO_RESPONSE", "PRICE_CHANGED", "CLOSED"];

export function simulateReply(r: ContactRequest, now = new Date()): ContactResult {
  const h = hash(r.seed);
  const status = r.force ?? OUTCOMES[h % OUTCOMES.length];
  const askedAt = now.toISOString();
  const repliedAt = status === "NO_RESPONSE" ? null : new Date(now.getTime() + (2 + (h % 9)) * 60000).toISOString();
  const pct = 3 + (h % 8); // 3..10 %
  const newPrice = status === "PRICE_CHANGED" && r.price ? Math.round((r.price * (1 + pct / 100)) / 10000) * 10000 : null;
  const floorHint =
    r.asks.includes("location") && status !== "NO_RESPONSE" && status !== "CLOSED"
      ? r.hasMall
        ? `طبقه ${toPersianDigits(1 + (h % 3))}، روبه‌روی پله‌برقی، تابلوی سبز`
        : "همکف، کنار ورودی اصلی"
      : null;

  const extras: string[] = [];
  const positive = status === "CONFIRMED" || status === "PRICE_CHANGED";
  if (r.asks.includes("hours") && status !== "CLOSED" && status !== "NO_RESPONSE") extras.push("امروز تا ساعت ۲۰ باز هستیم.");
  if (r.asks.includes("installment") && positive) extras.push(h % 2 ? "اقساطی با اسنپ‌پی هم داریم." : "فعلاً فقط نقدی و کارت.");
  if (r.asks.includes("warranty") && positive) extras.push("گارانتی ۱۸ ماهه شرکتی دارد.");
  if (floorHint) extras.push(`آدرس داخل پاساژ: ${floorHint}.`);

  const replyByStatus: Record<ContactStatus, string | null> = {
    CONFIRMED: `سلام، بله موجود داریم${r.price ? ` و قیمت همان ${fmtToman(r.price)} تومان است` : ""}.`,
    PRICE_CHANGED: `سلام، موجود است ولی قیمت به‌روز شده: ${newPrice ? fmtToman(newPrice) : "—"} تومان.`,
    OUT_OF_STOCK: "سلام، متأسفانه فعلاً موجود نداریم. احتمالاً هفته بعد شارژ می‌شود.",
    CLOSED: "سلام، امروز مغازه تعطیل است.",
    NO_RESPONSE: null,
  };
  const base = replyByStatus[status];
  return {
    status,
    simulated: true,
    askedAt,
    repliedAt,
    message: composeMessage(r),
    reply: base ? [base, ...extras].join(" ") : null,
    newPrice,
    floorHint,
  };
}

export const STATUS_FA: Record<ContactStatus, { label: string; tone: "ok" | "warn" | "bad" }> = {
  CONFIRMED: { label: "موجودی و قیمت تأیید شد", tone: "ok" },
  PRICE_CHANGED: { label: "قیمت تغییر کرده", tone: "warn" },
  OUT_OF_STOCK: { label: "ناموجود", tone: "bad" },
  CLOSED: { label: "فروشگاه تعطیل است", tone: "bad" },
  NO_RESPONSE: { label: "پاسخی نداد", tone: "bad" },
};
