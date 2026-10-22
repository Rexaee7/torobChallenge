// Rule-based slot extraction from Persian text. Used as the fallback when the
// LLM is unavailable and as a cheap pre-pass to keep filters in sync.
import { normalizeFa, toLatinDigits } from "./normalize";

export interface Slots {
  query: string;
  maxPrice?: number;
  minPrice?: number;
  installment?: boolean;
  area?: string;
  openNow?: boolean;
}

const NUM_WORDS: Record<string, number> = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, پانزده: 15, بیست: 20, سی: 30, چهل: 40, پنجاه: 50, صد: 100, دویست: 200, سیصد: 300, پانصد: 500,
};

function parseAmount(numStr: string, unit: string | undefined): number | null {
  const n = Number(toLatinDigits(numStr).replace(/[,٬]/g, "")) || NUM_WORDS[numStr];
  if (!n) return null;
  const u = unit ?? "";
  if (/میلیارد/.test(u)) return n * 1e9;
  if (/میلیون|ملیون|تومن/.test(u)) return n * 1e6;
  if (/هزار|تومان/.test(u)) return n * 1e3;
  return n < 1000 ? n * 1e6 : n; // "تا ۲۰" in a shopping context means 20 million toman
}

const AMOUNT = "([\\d۰-۹٠-٩,٬.]+|" + Object.keys(NUM_WORDS).join("|") + ")\\s*(میلیارد|میلیون|ملیون|هزار|تومن|تومان)?";

export function extractSlots(text: string, areas: string[] = []): Slots {
  let rest = text;
  const slots: Slots = { query: "" };

  const max = new RegExp(`(?:تا|زیر|حداکثر|کمتر\\s+از|نهایتا|نهایتاً|بودجه(?:م)?(?:\\s+حدود)?)\\s*${AMOUNT}(?:\\s*تومان|\\s*تومن)?`).exec(rest);
  if (max) {
    const v = parseAmount(max[1], max[2]);
    if (v) slots.maxPrice = v;
    rest = rest.replace(max[0], " ");
  }
  const min = new RegExp(`(?:بالای|بیشتر\\s+از|حداقل|از)\\s*${AMOUNT}`).exec(rest);
  if (min && min[2]) {
    const v = parseAmount(min[1], min[2]);
    if (v) slots.minPrice = v;
    rest = rest.replace(min[0], " ");
  }
  if (/قسط|اقساط|اعتباری|وام|پرداخت\s*(?:بعدا|بعداً)|ترب\s*پی|اسنپ\s*پی|دیجی\s*پی/.test(rest)) {
    slots.installment = true;
    rest = rest.replace(/(?:با\s*)?(?:خرید\s*)?(?:قسطی|اقساطی|قسط|اقساط|اعتباری)/g, " ");
  }
  if (/الان\s*باز|همین\s*الان|باز\s*باشه/.test(rest)) slots.openNow = true;

  const nText = normalizeFa(rest);
  const area = areas
    .map((a) => ({ a, n: normalizeFa(a).replace(/^(خیابان|میدان|محله|بازار) /, "") }))
    .filter((x) => x.n.length > 2 && nText.includes(x.n))
    .sort((x, y) => y.n.length - x.n.length)[0];
  if (area) {
    slots.area = area.a;
    rest = normalizeFa(rest).replace(new RegExp(`(?:نزدیک|حوالی|اطراف|توی|در|محدوده)?\\s*${area.n}`), " ");
  }

  slots.query = normalizeFa(rest)
    .split(" ")
    .filter((t) => t && !STOP.has(t))
    .join(" ");
  return slots;
}

const STOP = new Set(
  "من یه یک می خوام میخوام میخواستم میخواهم خواهم لازم دارم دنبال هستم برای خرید بخرم پیدا کن کنم لطفا سلام نزدیک حوالی اطراف با که و رو را خوب مناسب ارزون ارزان قیمت میلیون تومن تومان یا هم یک دونه چی چه یدونه تهران".split(" "),
);
