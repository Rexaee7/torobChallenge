import { describe, expect, it } from "vitest";
import { normalizeFa } from "../src/lib/normalize";
import { declaredOpenAt, parseAddress, parsePaymentOptions, parseWeeklyHours, tehranNow } from "../src/lib/parsers";
import { haversineKm, validTehranCoord } from "../src/lib/geo";
import { extractSlots } from "../src/lib/intent";
import { simulateReply } from "../src/lib/contact";

describe("normalizeFa", () => {
  it("unifies Arabic letters, digits and ZWNJ", () => {
    expect(normalizeFa("كفش علي ۴۲")).toBe("کفش علی 42");
    expect(normalizeFa("می‌خوام")).toBe("می خوام");
    expect(normalizeFa("Galaxy A54")).toBe("galaxy a 54");
    expect(normalizeFa("")).toBe("");
    expect(normalizeFa(null)).toBe("");
  });
});

describe("parseWeeklyHours", () => {
  const raw = JSON.stringify({
    sat: { shifts: [{ start_time: "10:00:00", end_time: "19:00:00" }, { start_time: "00:00:00", end_time: "00:00:00" }], status: "declared" },
    fri: { shifts: [{ start_time: "00:00:00", end_time: "00:00:00" }], status: "closed" },
    sun: { shifts: [{ start_time: "08:00:00", end_time: "08:00:00" }], status: "unsupported" },
    mon: { shifts: [{ start_time: "16:00:00", end_time: "00:00:00" }], status: "declared" },
  });
  const h = parseWeeklyHours(raw);
  it("parses declared, closed, unknown and midnight end", () => {
    expect(h?.sat).toEqual({ status: "open", shifts: [{ start: 600, end: 1140 }] });
    expect(h?.fri.status).toBe("closed");
    expect(h?.sun.status).toBe("unknown");
    expect(h?.mon.shifts[0].end).toBe(1440);
    expect(h?.tue.status).toBe("unknown");
  });
  it("returns null for empty/malformed", () => {
    expect(parseWeeklyHours("{}")).toBeNull();
    expect(parseWeeklyHours("not json")).toBeNull();
    expect(parseWeeklyHours(null)).toBeNull();
  });
  it("never says open without hours", () => {
    expect(declaredOpenAt(null, "sat", 700)).toBe("unknown");
    expect(declaredOpenAt(h, "sat", 700)).toBe("open");
    expect(declaredOpenAt(h, "sat", 1200)).toBe("closed");
    expect(declaredOpenAt(h, "fri", 700)).toBe("closed");
    expect(declaredOpenAt(h, "sun", 700)).toBe("unknown");
  });
  it("computes Tehran time (UTC+3:30)", () => {
    // 2026-10-24 is a Saturday; 06:30 UTC => 10:00 Tehran
    expect(tehranNow(new Date("2026-10-24T06:30:00Z"))).toEqual({ day: "sat", minute: 600 });
  });
});

describe("parsePaymentOptions", () => {
  it("keeps explicit providers only; empty means not specified", () => {
    const p = parsePaymentOptions('[{"category_names":[],"channel":"in_person","max_price_toman":null,"min_price_toman":null,"provider_name":"ترب‌پی"},{"provider_name":""}]');
    expect(p).toEqual([{ provider: "ترب‌پی", inPerson: true, minPrice: null, maxPrice: null }]);
    expect(parsePaymentOptions("[]")).toEqual([]);
    expect(parsePaymentOptions("null")).toEqual([]);
    expect(parsePaymentOptions("{bad")).toEqual([]);
  });
});

describe("parseAddress", () => {
  it("extracts mall, floor and unit", () => {
    expect(parseAddress("خیابان جمهوری، نبش شیخ هادی، پاساژ علالدین 2، طبقه 6، واحد 622")).toEqual({ mall: "پاساژ علالدین 2", floor: "طبقه 6", unit: "واحد 622" });
    expect(parseAddress("میدان فردوسی، پاساژ تجارت جهانی فردوسی، طبقه منفی یک").floor).toBe("طبقه منفی یک");
  });
  it("does not invent indoor details for street addresses", () => {
    expect(parseAddress("خیابان مطهری، خیابان مهرداد، پلاک۳۰")).toEqual({ mall: null, floor: null, unit: null });
  });
});

describe("geo", () => {
  it("haversine ~ Vanak→Tajrish", () => {
    const d = haversineKm(35.7575, 51.4098, 35.8048, 51.4335);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(6.5);
  });
  it("rejects coords outside Tehran", () => {
    expect(validTehranCoord(0, 0)).toBe(false);
    expect(validTehranCoord(35.7, 51.4)).toBe(true);
  });
});

describe("extractSlots", () => {
  it("parses budget, installment and area", () => {
    const s = extractSlots("یه گوشی سامسونگ تا ۲۰ میلیون قسطی نزدیک ونک می‌خوام", ["ونک", "تجریش"]);
    expect(s.maxPrice).toBe(20_000_000);
    expect(s.installment).toBe(true);
    expect(s.area).toBe("ونک");
    expect(s.query).toBe("گوشی سامسونگ");
  });
});

describe("simulateReply", () => {
  const base = { shopName: "x", productTitle: "p", price: 1_000_000, asks: ["price", "stock"] as const, hasMall: true, unitKnown: false, seed: "a" };
  it("is deterministic and always flagged simulated", () => {
    const a = simulateReply({ ...base, asks: [...base.asks] }, new Date(0));
    const b = simulateReply({ ...base, asks: [...base.asks] }, new Date(0));
    expect(a).toEqual(b);
    expect(a.simulated).toBe(true);
  });
  it("supports forced outcomes", () => {
    expect(simulateReply({ ...base, asks: [...base.asks], force: "NO_RESPONSE" }).reply).toBeNull();
    const pc = simulateReply({ ...base, asks: [...base.asks], force: "PRICE_CHANGED" });
    expect(pc.newPrice).toBeGreaterThan(1_000_000);
  });
});
