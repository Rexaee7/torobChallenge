import "server-only";
import { getDb } from "./db";
import { normalizeFa } from "../normalize";
import { haversineKm } from "../geo";
import { TEHRAN_AREAS } from "../gazetteer";
import { DAY_KEYS, declaredOpenAt, tehranNow, type DayKey, type PaymentOption, type WeeklyHours } from "../parsers";
import type { Facet, ProductDetail, ProductSummary, SearchParams, SearchResult, ShopInfo, ShopOffer, ShopsQuery, ShopsResult } from "../types";

/* ---------------- row mapping ---------------- */

interface ProductRow {
  id: number;
  pid: string;
  title: string;
  brand: string | null;
  category: string | null;
  model: string | null;
  images: string;
  specs: string;
  offer_count: number;
  shop_count: number;
  min_price: number | null;
  max_price: number | null;
  last_changed: string | null;
}

interface ShopRow {
  id: number;
  sid: string;
  name: string | null;
  name_verified: number;
  categories: string;
  address: string | null;
  location_label: string | null;
  lat: number | null;
  lon: number | null;
  hours: string | null;
  payments: string;
  has_installment: number;
  fast_delivery: number | null;
  website: string | null;
  instagram: string | null;
  mall: string | null;
  floor: string | null;
  unit: string | null;
  offer_count: number;
}

const SKIP_SPEC_KEYS = /^(نام محصول|شرکت سازنده|تاریخ معرفی|مدل)$/;

function keySpecs(specs: [string, string][], n = 4): [string, string][] {
  return specs.filter(([k, v]) => v && !SKIP_SPEC_KEYS.test(k) && v.length < 40).slice(0, n);
}

function toSummary(r: ProductRow): ProductSummary {
  const images = parseImages(r.images);
  const specs: [string, string][] = JSON.parse(r.specs || "[]");
  return {
    id: r.pid,
    title: r.title,
    brand: r.brand,
    category: r.category,
    image: images[0] ?? null,
    minPrice: r.min_price,
    maxPrice: r.max_price,
    offerCount: r.offer_count,
    shopCount: r.shop_count,
    lastChanged: r.last_changed,
    keySpecs: keySpecs(specs),
    reasons: [],
  };
}

function toDetail(r: ProductRow): ProductDetail {
  const s = toSummary(r);
  return { ...s, model: r.model, images: parseImages(r.images), specs: JSON.parse(r.specs || "[]") };
}

export function toShop(r: ShopRow): ShopInfo {
  return {
    id: r.sid,
    name: r.name,
    nameVerified: !!r.name_verified,
    address: r.address,
    area: r.location_label,
    lat: r.lat,
    lon: r.lon,
    mall: r.mall,
    floor: r.floor,
    unit: r.unit,
    hours: r.hours ? (JSON.parse(r.hours) as WeeklyHours) : null,
    payments: JSON.parse(r.payments || "[]") as PaymentOption[],
    fastDelivery: r.fast_delivery == null ? null : !!r.fast_delivery,
    website: r.website,
    instagram: r.instagram,
    categories: JSON.parse(r.categories || "[]"),
    offerCount: r.offer_count,
  };
}

/* ---------------- geo helpers ---------------- */

let shopGeoCache: { id: number; lat: number; lon: number }[] | null = null;
function shopGeo() {
  if (!shopGeoCache) {
    shopGeoCache = getDb().prepare(`SELECT id, lat, lon FROM shops WHERE lat IS NOT NULL`).all() as { id: number; lat: number; lon: number }[];
  }
  return shopGeoCache;
}

export function shopsWithin(lat: number, lon: number, radiusKm: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const s of shopGeo()) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d <= radiusKm) m.set(s.id, d);
  }
  return m;
}

/* ---------------- search ---------------- */

const SYNONYMS: Record<string, string[]> = {
  کتونی: ["کفش ورزشی", "کفش اسپرت"],
  کتانی: ["کفش ورزشی", "کفش اسپرت"],
  موبایل: ["گوشی"],
  گوشی: ["گوشی موبایل"],
  لپتاپ: ["لپ تاپ"],
  "لپ تاپ": ["لپ تاپ"],
  یخچال: ["یخچال"],
  هدفون: ["هدفون", "هندزفری"],
  ایرپاد: ["هندزفری بلوتوث"],
  تلویزیون: ["تلویزیون"],
  ماشین_لباسشویی: ["لباسشویی"],
  آیفون: ["گوشی اپل آیفون", "گوشی موبایل اپل"],
  ایفون: ["گوشی اپل آیفون", "گوشی موبایل اپل"],
  گلکسی: ["گوشی سامسونگ گلکسی"],
  آیپد: ["تبلت اپل آیپد"],
  تبلت: ["تبلت"],
  ساعت_هوشمند: ["ساعت هوشمند", "مچ بند هوشمند"],
  اسپیکر: ["اسپیکر", "اسپیکر بلوتوثی"],
  کیف_پول: ["کیف پول"],
  جاروبرقی: ["جارو برقی"],
};

function ftsTokens(q: string, prefix = true): string[] {
  return normalizeFa(q)
    .split(" ")
    .filter((t) => t.length > 0)
    .slice(0, 8)
    .map((t) => `"${t.replace(/"/g, "")}"${prefix && t.length >= 2 ? "*" : ""}`);
}

function expandQuery(q: string): string[] {
  const n = normalizeFa(q);
  const out = [n];
  for (const [k, vs] of Object.entries(SYNONYMS)) {
    const key = normalizeFa(k.replace(/_/g, " "));
    if (n.includes(key)) for (const v of vs) out.push(n.replace(key, normalizeFa(v)));
  }
  return [...new Set(out)];
}

const MAX_LIMIT = 48;

export function searchProducts(params: SearchParams): SearchResult {
  const db = getDb();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), MAX_LIMIT);
  const offset = Math.max(params.offset ?? 0, 0);

  const where: string[] = ["p.offer_count > 0"];
  const args: unknown[] = [];
  if (params.category) (where.push("p.category = ?"), args.push(params.category));
  if (params.brand) (where.push("p.brand = ?"), args.push(params.brand));
  if (params.minPrice != null) (where.push("p.max_price >= ?"), args.push(params.minPrice));
  if (params.maxPrice != null) (where.push("p.min_price <= ?"), args.push(params.maxPrice));

  let near: Map<number, number> | null = null;
  if (params.lat != null && params.lon != null && params.radiusKm) {
    near = shopsWithin(params.lat, params.lon, params.radiusKm);
  }
  const shopFilter: string[] = [];
  if (near) shopFilter.push(`o.shop_id IN (${[...near.keys()].join(",") || "-1"})`);
  if (params.installment) shopFilter.push(`o.shop_id IN (SELECT id FROM shops WHERE has_installment = 1)`);
  if (params.maxPrice != null) shopFilter.push(`(o.price IS NULL OR o.price <= ${Math.floor(params.maxPrice)})`);
  if (params.minPrice != null) shopFilter.push(`(o.price IS NULL OR o.price >= ${Math.floor(params.minPrice)})`);
  if (near || params.installment) {
    where.push(`EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND ${shopFilter.join(" AND ")})`);
  }

  const order =
    params.sort === "price_asc"
      ? "p.min_price ASC"
      : params.sort === "price_desc"
        ? "p.min_price DESC"
        : params.sort === "sellers"
          ? "p.shop_count DESC"
          : null;

  let matchMode: SearchResult["matchMode"] = "all";
  let rows: (ProductRow & { rank?: number })[] = [];
  let total = 0;
  const facetRowsSql = (from: string, w: string) => `SELECT p.category c, p.brand b, p.min_price mp FROM ${from} WHERE ${w} LIMIT 3000`;
  let facetRows: { c: string | null; b: string | null; mp: number | null }[] = [];

  const q = params.q?.trim();
  if (q) {
    const variants = expandQuery(q);
    const tryMatch = (match: string) => {
      const w = [...where, "products_fts MATCH ?"].join(" AND ");
      const a = [...args, match];
      const from = "products_fts f JOIN products p ON p.id = f.rowid";
      // bm25 weights: title, brand, category, model, extra(seller titles).
      // bm25 is negative (lower = better), so multiplying by >1 promotes a row.
      // Boost products whose title/category *starts* with the head noun: "گوشی سامسونگ"
      // should rank phones above "باتری گوشی سامسونگ".
      const head = (variants[1] ?? variants[0]).split(" ")[0] ?? "";
      const rankExpr = `bm25(products_fts, 10.0, 6.0, 4.0, 8.0, 1.5) * (1
        + CASE WHEN p.title LIKE ? THEN 0.8 ELSE 0 END
        + CASE WHEN p.category LIKE ? THEN 0.8 ELSE 0 END
        + MIN(p.shop_count, 20) * 0.04)`;
      const t = (db.prepare(`SELECT COUNT(*) n FROM ${from} WHERE ${w}`).get(...a) as { n: number }).n;
      if (!t) return false;
      total = t;
      rows = db
        .prepare(`SELECT p.*, ${rankExpr} AS rank FROM ${from} WHERE ${w} ORDER BY ${order ?? "rank"} LIMIT ? OFFSET ?`)
        .all(`${head}%`, `${head}%`, ...a, limit, offset) as ProductRow[];
      facetRows = db.prepare(facetRowsSql(from, w)).all(...a) as typeof facetRows;
      return true;
    };
    // 1) whole words ("کفش" must not match "کفشور"), 2) prefixes, 3) any word.
    const build = (prefix: boolean) => variants.map((v) => ftsTokens(v, prefix).join(" ")).filter(Boolean).map((s) => `(${s})`).join(" OR ");
    const exact = build(false);
    const okExact = !!exact && tryMatch(exact) && total >= 3;
    if (!okExact && !(build(true) && tryMatch(build(true)))) {
      matchMode = "partial";
      const anyMatch = [...new Set(variants.flatMap((v) => ftsTokens(v)))].filter((t) => t.replace(/[\"*]/g, "").length > 1).join(" OR ");
      if (!anyMatch || !tryMatch(anyMatch)) matchMode = "none";
    }
  } else {
    const w = where.join(" AND ");
    total = (db.prepare(`SELECT COUNT(*) n FROM products p WHERE ${w}`).get(...args) as { n: number }).n;
    rows = db.prepare(`SELECT p.* FROM products p WHERE ${w} ORDER BY ${order ?? "p.shop_count DESC"} LIMIT ? OFFSET ?`).all(...args, limit, offset) as ProductRow[];
    facetRows = db.prepare(facetRowsSql("products p", w)).all(...args) as typeof facetRows;
    if (!total) matchMode = "none";
  }

  const count = (key: "c" | "b"): Facet[] => {
    const m = new Map<string, number>();
    for (const r of facetRows) if (r[key]) m.set(r[key]!, (m.get(r[key]!) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));
  };
  const prices = facetRows.map((r) => r.mp).filter((x): x is number => x != null);

  const items = rows.map((r) => {
    const s = toSummary(r);
    if (near) {
      const offers = db.prepare(`SELECT shop_id FROM offers WHERE product_id = ?`).all(r.id) as { shop_id: number }[];
      const ds = offers.map((o) => near!.get(o.shop_id)).filter((d): d is number => d != null);
      s.nearbyShopCount = new Set(offers.filter((o) => near!.has(o.shop_id)).map((o) => o.shop_id)).size;
      s.nearestKm = ds.length ? Math.min(...ds) : null;
    }
    s.reasons = productReasons(s, params, matchMode);
    return s;
  });

  return {
    items,
    total,
    matchMode,
    facets: { categories: count("c"), brands: count("b"), price: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null } },
    appliedFilters: params,
    suggestions: matchMode === "none" ? suggestCategories(q ?? "") : [],
  };
}

function productReasons(s: ProductSummary, p: SearchParams, mode: SearchResult["matchMode"]): string[] {
  const r: string[] = [];
  if (p.maxPrice != null && s.minPrice != null && s.minPrice <= p.maxPrice) r.push("در محدوده بودجه");
  if (p.brand && s.brand === p.brand) r.push(`برند ${p.brand}`);
  if (s.nearbyShopCount) r.push(`${s.nearbyShopCount} فروشنده در محدوده شما`);
  else if (s.shopCount > 1) r.push(`${s.shopCount} فروشنده در دیتاست`);
  if (p.installment) r.push("فروشنده با امکان قسطی");
  if (mode === "partial") r.push("تطابق بخشی با جست‌وجو");
  return r;
}

export function suggestCategories(q: string): string[] {
  const db = getDb();
  const tokens = normalizeFa(q).split(" ").filter((t) => t.length > 1);
  if (!tokens.length) return [];
  const rows = db.prepare(`SELECT name FROM categories ORDER BY offer_count DESC`).all() as { name: string }[];
  return rows
    .map((r) => ({ name: r.name, n: normalizeFa(r.name) }))
    .filter((r) => tokens.some((t) => r.n.includes(t.slice(0, Math.max(2, t.length - 1)))))
    .slice(0, 6)
    .map((r) => r.name);
}

/* ---------------- product detail ---------------- */

function productRow(pid: string): ProductRow | undefined {
  return getDb().prepare(`SELECT * FROM products WHERE pid = ?`).get(pid) as ProductRow | undefined;
}

export function getProduct(pid: string): ProductDetail | null {
  const r = productRow(pid);
  return r ? toDetail(r) : null;
}

export function getProducts(pids: string[]): ProductDetail[] {
  return pids.map(getProduct).filter((p): p is ProductDetail => !!p);
}

/* ---------------- shops for a product ---------------- */

const DAY_SET = new Set<string>(DAY_KEYS);

export function getProductShops(pid: string, q: ShopsQuery): ShopsResult | null {
  const db = getDb();
  const p = productRow(pid);
  if (!p) return null;
  const rows = db
    .prepare(
      `SELECT o.oid, o.price, o.seller_title, o.description, o.warranty, o.last_changed, s.*
       FROM offers o JOIN shops s ON s.id = o.shop_id WHERE o.product_id = ?`,
    )
    .all(p.id) as (ShopRow & { oid: string; price: number | null; seller_title: string | null; description: string | null; warranty: string | null; last_changed: string | null })[];

  const now = tehranNow();
  const isNow = !(q.openDay && DAY_SET.has(q.openDay) && q.openMinute != null);
  const day = (isNow ? now.day : q.openDay) as DayKey;
  const minute = isNow ? now.minute : q.openMinute!;
  const hasLoc = q.lat != null && q.lon != null;

  const excluded = { radius: 0, installment: 0, closed: 0, noCoords: 0 };
  const priced = rows.map((r) => r.price).filter((x): x is number => x != null);
  const minP = priced.length ? Math.min(...priced) : 0;
  const maxP = priced.length ? Math.max(...priced) : 0;

  let offers: ShopOffer[] = [];
  for (const r of rows) {
    const shop = toShop(r);
    const distanceKm = hasLoc && shop.lat != null && shop.lon != null ? haversineKm(q.lat!, q.lon!, shop.lat, shop.lon) : null;
    if (hasLoc && distanceKm == null) excluded.noCoords++;
    if (hasLoc && q.radiusKm && (distanceKm == null || distanceKm > q.radiusKm)) {
      excluded.radius++;
      continue;
    }
    const matchingPay = shop.payments.filter((x) => !q.provider || x.provider === q.provider);
    if ((q.installment || q.provider) && !matchingPay.length) {
      excluded.installment++;
      continue;
    }
    const openState = declaredOpenAt(shop.hours, day, minute);
    if (q.openOnly && openState !== "open") {
      excluded.closed++;
      continue;
    }
    // Score: cheaper and closer is better; unknown hours slightly penalized.
    const priceScore = r.price != null && maxP > minP ? 1 - (r.price - minP) / (maxP - minP) : 0.5;
    const distScore = distanceKm != null ? Math.max(0, 1 - distanceKm / 15) : 0.3;
    const openScore = openState === "open" ? 1 : openState === "unknown" ? 0.5 : 0;
    const score = priceScore * 0.45 + distScore * 0.35 + openScore * 0.15 + (shop.payments.length ? 0.05 : 0);
    offers.push({
      offerId: r.oid,
      price: r.price,
      sellerTitle: r.seller_title,
      description: r.description,
      warranty: r.warranty,
      lastChanged: r.last_changed,
      shop,
      distanceKm,
      openState,
      score,
      reasons: [],
    });
  }

  const sortFn: Record<string, (a: ShopOffer, b: ShopOffer) => number> = {
    nearest: (a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9),
    cheapest: (a, b) => (a.price ?? 1e15) - (b.price ?? 1e15),
    best: (a, b) => b.score - a.score,
  };
  offers.sort(sortFn[q.sort ?? (hasLoc ? "best" : "cheapest")] ?? sortFn.best);
  offers = offers.slice(0, 60);

  const cheapest = Math.min(...offers.map((o) => o.price ?? Infinity));
  const nearest = Math.min(...offers.map((o) => o.distanceKm ?? Infinity));
  for (const o of offers) {
    if (o.price != null && o.price === cheapest && offers.length > 1) o.reasons.push("ارزان‌ترین قیمت ثبت‌شده");
    if (o.distanceKm != null && o.distanceKm === nearest && offers.length > 1) o.reasons.push("نزدیک‌ترین فروشنده");
    if (o.openState === "open") o.reasons.push(isNow ? "طبق ساعت اعلامی الان باز است" : "طبق ساعت اعلامی در زمان مراجعه باز است");
    if (o.shop.payments.length) o.reasons.push(`قسطی: ${o.shop.payments.map((x) => x.provider).join("، ")}`);
    if (o.shop.mall) o.reasons.push(`داخل ${o.shop.mall}`);
  }

  return { product: toSummary(p), offers, totalOffers: rows.length, excluded, visitTime: { day, minute, isNow } };
}

/* ---------------- alternatives ---------------- */

export function similarProducts(pid: string, opts: { lat?: number; lon?: number; radiusKm?: number; maxPrice?: number; limit?: number } = {}): ProductSummary[] {
  const db = getDb();
  const p = productRow(pid);
  if (!p) return [];
  // Candidates: same category in a price band (indexed), then rank by title-token
  // overlap + brand + price closeness in JS. Much faster than an OR-heavy FTS query.
  const words = new Set(normalizeFa(p.title).split(" ").filter((t) => t.length > 1 && !/^d+$/.test(t)));
  const base = p.min_price ?? 0;
  const lo = base * 0.6;
  const hi = opts.maxPrice ?? base * 1.6;
  let near: Map<number, number> | null = null;
  if (opts.lat != null && opts.lon != null) near = shopsWithin(opts.lat, opts.lon, opts.radiusKm ?? 5);
  const nearSql = near ? ` AND EXISTS (SELECT 1 FROM offers o WHERE o.product_id = p.id AND o.shop_id IN (${[...near.keys()].join(",") || "-1"}))` : "";
  const cands = db
    .prepare(
      `SELECT p.* FROM products p WHERE p.category IS ? AND p.id != ? AND p.offer_count > 0
       ${base ? "AND p.min_price BETWEEN ? AND ?" : ""} ${nearSql} ORDER BY p.shop_count DESC LIMIT 400`,
    )
    .all(...[p.category, p.id, ...(base ? [lo, hi] : [])]) as ProductRow[];
  const scored = cands.map((r) => {
    const t = normalizeFa(r.title).split(" ");
    const overlap = t.filter((w) => words.has(w)).length / Math.max(words.size, 1);
    const priceClose = base && r.min_price ? 1 - Math.min(1, Math.abs(r.min_price - base) / base) : 0;
    const same = r.title === p.title ? -1 : 0;
    return { r, score: overlap * 2 + (r.brand && r.brand === p.brand ? 0.5 : 0) + priceClose * 0.5 + Math.min(r.shop_count, 10) * 0.03 + same };
  });
  const rows = scored.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 6).map((x) => x.r);
  return rows.map((r) => {
    const s = toSummary(r);
    s.reasons = [
      !r.brand || !p.brand ? "برند ثبت نشده" : r.brand === p.brand ? "همان برند" : `برند دیگر (${r.brand})`,
      "همان دسته",
      r.min_price != null && base ? (r.min_price < base ? "ارزان‌تر" : r.min_price > base ? "گران‌تر" : "هم‌قیمت") : "قیمت نامشخص",
    ];
    if (near) {
      const ids = (db.prepare(`SELECT shop_id FROM offers WHERE product_id = ?`).all(r.id) as { shop_id: number }[]).map((x) => x.shop_id);
      const ds = ids.map((i) => near!.get(i)).filter((d): d is number => d != null);
      s.nearbyShopCount = ds.length;
      s.nearestKm = ds.length ? Math.min(...ds) : null;
    }
    return s;
  });
}

/* ---------------- shop page ---------------- */

export function getShop(sid: string): { shop: ShopInfo; products: (ProductSummary & { price: number | null; lastChangedOffer: string | null })[] } | null {
  const db = getDb();
  const r = db.prepare(`SELECT * FROM shops WHERE sid = ?`).get(sid) as ShopRow | undefined;
  if (!r) return null;
  const ps = db
    .prepare(`SELECT p.*, o.price AS oprice, o.last_changed AS olc FROM offers o JOIN products p ON p.id = o.product_id WHERE o.shop_id = ? ORDER BY p.shop_count DESC LIMIT 40`)
    .all(r.id) as (ProductRow & { oprice: number | null; olc: string | null })[];
  return { shop: toShop(r), products: ps.map((p) => ({ ...toSummary(p), price: p.oprice, lastChangedOffer: p.olc })) };
}

/* ---------------- reference data ---------------- */

export interface Area {
  label: string;
  lat: number;
  lon: number;
  shopCount: number;
}

let areaCache: Area[] | null = null;
/** Dataset location labels (with shop counts) + well-known Tehran areas, nearby shop counts within 2 km. */
export function neighborhoods(): Area[] {
  if (areaCache) return areaCache;
  const fromData = getDb().prepare(`SELECT label, lat, lon, shop_count shopCount FROM neighborhoods ORDER BY shop_count DESC`).all() as Area[];
  const seen = new Set(fromData.map((a) => normalizeFa(a.label)));
  const extra = TEHRAN_AREAS.filter((a) => !seen.has(normalizeFa(a.label))).map((a) => ({ ...a, shopCount: shopsWithin(a.lat, a.lon, 2).size }));
  areaCache = [...fromData, ...extra].sort((a, b) => b.shopCount - a.shopCount);
  return areaCache;
}

/** Find an area by free text: known labels first, then the centroid of shops whose address mentions it. */
export function findArea(text: string): Area | null {
  const n = normalizeFa(text).replace(/^(خیابان|میدان|محله|بازار)s+/, "");
  if (n.length < 2) return null;
  const all = neighborhoods();
  const hit =
    all.find((a) => normalizeFa(a.label) === n) ??
    all.find((a) => normalizeFa(a.label).includes(n)) ??
    all.find((a) => n.includes(normalizeFa(a.label)) && normalizeFa(a.label).length > 2);
  if (hit) return hit;
  const r = getDb().prepare(`SELECT COUNT(*) n, AVG(lat) lat, AVG(lon) lon FROM shops WHERE lat IS NOT NULL AND address LIKE ?`).get(`%${text.trim()}%`) as { n: number; lat: number; lon: number };
  return r.n >= 5 ? { label: text.trim(), lat: r.lat, lon: r.lon, shopCount: r.n } : null;
}

export function topCategories(limit = 30): Facet[] {
  return getDb().prepare(`SELECT name, product_count count FROM categories ORDER BY offer_count DESC LIMIT ?`).all(limit) as Facet[];
}

export function brandsForCategory(category: string, limit = 20): Facet[] {
  return getDb().prepare(`SELECT name, product_count count FROM brands WHERE category = ? ORDER BY product_count DESC LIMIT ?`).all(category, limit) as Facet[];
}

export function installmentProviders(): Facet[] {
  const rows = getDb().prepare(`SELECT payments FROM shops WHERE has_installment = 1`).all() as { payments: string }[];
  const m = new Map<string, number>();
  for (const r of rows) for (const p of JSON.parse(r.payments) as PaymentOption[]) m.set(p.provider, (m.get(p.provider) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

export function meta(): Record<string, string> {
  const rows = getDb().prepare(`SELECT key, value FROM meta`).all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

const IMG_PREFIX = "https://image.torob.com/base/images/";
function parseImages(raw: string | null): string[] {
  const arr: string[] = JSON.parse(raw || "[]");
  return arr.map((u) => (u.startsWith("http") ? u : IMG_PREFIX + u));
}
