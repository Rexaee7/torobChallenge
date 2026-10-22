/**
 * Builds data/torob.db (read-only SQLite + FTS5) from the Torob CSVs.
 * Usage: npm run data:build  (expects CSVs in data/raw/torob-dataset/)
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import { openDb } from "../src/lib/sqlite";
import { normalizeFa } from "../src/lib/normalize";
import { parseAddress, parsePaymentOptions, parseWarranty, parseWeeklyHours, safeJson } from "../src/lib/parsers";
import { validTehranCoord } from "../src/lib/geo";

const SRC = process.env.DATA_SRC ?? path.join("data", "raw", "torob-dataset");
const OUT = process.env.DB_PATH ?? path.join("data", "torob.db");
const MAX_SPECS = 20;
const IMG_PREFIX = "https://image.torob.com/base/images/";

const report: Record<string, number | string> = {};
const bump = (k: string, n = 1) => (report[k] = ((report[k] as number) ?? 0) + n);

async function* rows(file: string): AsyncGenerator<Record<string, string>> {
  const parser = fs.createReadStream(path.join(SRC, file)).pipe(
    parse({ columns: true, bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true }),
  );
  for await (const r of parser) yield r as Record<string, string>;
}

const nul = (v: string | undefined) => (v == null || v === "" || v === "null" ? null : v);

async function main() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const db = openDb(OUT, false);
  const tx = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => { db.exec("BEGIN"); try { fn(...a); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; } };
  db.exec("PRAGMA journal_mode = OFF");
  db.exec("PRAGMA synchronous = OFF");

  db.exec(`
    CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE shops(
      id INTEGER PRIMARY KEY, sid TEXT UNIQUE NOT NULL, name TEXT, name_verified INTEGER NOT NULL DEFAULT 0,
      categories TEXT, address TEXT, location_label TEXT, lat REAL, lon REAL,
      hours TEXT, payments TEXT, has_installment INTEGER NOT NULL DEFAULT 0, torobpay_in_person INTEGER NOT NULL DEFAULT 0,
      fast_delivery INTEGER, website TEXT, instagram TEXT, mall TEXT, floor TEXT, unit TEXT, offer_count INTEGER DEFAULT 0
    );
    CREATE TABLE products(
      id INTEGER PRIMARY KEY, pid TEXT UNIQUE NOT NULL, title TEXT NOT NULL, brand TEXT, category TEXT, model TEXT,
      images TEXT, specs TEXT, offer_count INTEGER DEFAULT 0, shop_count INTEGER DEFAULT 0,
      min_price INTEGER, max_price INTEGER, last_changed TEXT
    );
    CREATE TABLE offers(
      id INTEGER PRIMARY KEY, oid TEXT, product_id INTEGER NOT NULL, shop_id INTEGER NOT NULL,
      price INTEGER, seller_title TEXT, description TEXT, warranty TEXT, last_changed TEXT
    );
    CREATE TABLE neighborhoods(label TEXT PRIMARY KEY, lat REAL, lon REAL, shop_count INTEGER);
    CREATE TABLE categories(name TEXT PRIMARY KEY, product_count INTEGER, offer_count INTEGER);
    CREATE TABLE brands(name TEXT, category TEXT, product_count INTEGER);
    CREATE VIRTUAL TABLE products_fts USING fts5(title, brand, category, model, extra, content='', tokenize='unicode61 remove_diacritics 2');
  `);

  /* ---- shops ---- */
  const shopIds = new Map<string, number>();
  const insShop = db.prepare(`INSERT INTO shops(sid,name,name_verified,categories,address,location_label,lat,lon,hours,payments,
    has_installment,torobpay_in_person,fast_delivery,website,instagram,mall,floor,unit) VALUES
    (@sid,@name,@nv,@cats,@address,@label,@lat,@lon,@hours,@payments,@inst,@tp,@fast,@web,@ig,@mall,@floor,@unit)`);
  const shopTx = tx((batch: Record<string, unknown>[]) => batch.forEach((b) => shopIds.set(b.sid as string, Number(insShop.run(b).lastInsertRowid))));
  let batch: Record<string, unknown>[] = [];
  for await (const r of rows("shops.csv")) {
    bump("shops.rows");
    if (!r.shop_id || shopIds.has(r.shop_id)) {
      bump("shops.duplicate_or_missing_id");
      continue;
    }
    let lat: number | null = Number(r.lat);
    let lon: number | null = Number(r.lon);
    if (!validTehranCoord(lat, lon)) {
      bump("shops.invalid_coords");
      lat = lon = null;
    }
    const hours = parseWeeklyHours(r.weekly_hours);
    if (!hours) bump("shops.no_hours");
    const pays = parsePaymentOptions(r.payment_options);
    if (pays.length) bump("shops.with_installment");
    const web = nul(r.website_url);
    const ig = nul(r.instagram);
    const addr = parseAddress(r.address);
    if (addr.mall) bump("shops.with_mall");
    batch.push({
      sid: r.shop_id,
      name: nul(r.name),
      nv: web || ig ? 1 : 0,
      cats: JSON.stringify(safeJson<string[]>(r.category_names, [])),
      address: nul(r.address),
      label: nul(r.location_label),
      lat,
      lon,
      hours: hours ? JSON.stringify(hours) : null,
      payments: JSON.stringify(pays),
      inst: pays.length ? 1 : 0,
      tp: pays.some((p) => p.inPerson && p.provider.includes("ترب")) ? 1 : 0,
      fast: r.supports_fast_delivery === "true" ? 1 : r.supports_fast_delivery === "false" ? 0 : null,
      web: web && /^https?:\/\//.test(web) ? web : null,
      ig,
      mall: addr.mall,
      floor: addr.floor,
      unit: addr.unit,
    });
    if (batch.length >= 2000) (shopTx(batch), (batch = []));
  }
  shopTx(batch);
  batch = [];
  console.log("shops", shopIds.size);

  /* ---- products ---- */
  const prodIds = new Map<string, number>();
  const insProd = db.prepare(`INSERT INTO products(pid,title,brand,category,model,images,specs) VALUES (@pid,@title,@brand,@cat,@model,@images,@specs)`);
  const prodTx = tx((b: Record<string, unknown>[]) => b.forEach((p) => prodIds.set(p.pid as string, Number(insProd.run(p).lastInsertRowid))));
  for await (const r of rows("products.csv")) {
    bump("products.rows");
    if (!r.product_id || prodIds.has(r.product_id) || !r.persian_title) {
      bump("products.skipped");
      continue;
    }
    const imgs = safeJson<unknown[]>(r.image_urls, []);
    const images = Array.isArray(imgs) ? imgs.filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 3).map((u) => (u.startsWith(IMG_PREFIX) ? u.slice(IMG_PREFIX.length) : u)) : [];
    if (!images.length) bump("products.no_image");
    const rawSpecs = safeJson<unknown[]>(r.specs, []);
    if (r.specs && r.specs !== "null" && r.specs !== "[]" && !Array.isArray(rawSpecs)) bump("products.bad_specs_json");
    const specs = (Array.isArray(rawSpecs) ? rawSpecs : [])
      .filter((s): s is { key: string; value: string } => !!s && typeof (s as { key?: unknown }).key === "string")
      .slice(0, MAX_SPECS)
      .map((s) => [s.key, String(s.value ?? "").slice(0, 80)]);
    batch.push({
      pid: r.product_id,
      title: r.persian_title,
      brand: nul(r.brand_name),
      cat: nul(r.category_name),
      model: nul(r.model),
      images: JSON.stringify(images),
      specs: JSON.stringify(specs),
    });
    if (batch.length >= 5000) (prodTx(batch), (batch = []));
  }
  prodTx(batch);
  batch = [];
  console.log("products", prodIds.size);

  /* ---- offers ---- */
  const insOffer = db.prepare(`INSERT INTO offers(oid,product_id,shop_id,price,seller_title,description,warranty,last_changed)
    VALUES (@oid,@pid,@sid,@price,@title,@desc,@warranty,@changed)`);
  const offerTx = tx((b: Record<string, unknown>[]) => b.forEach((o) => insOffer.run(o)));
  for await (const r of rows("offers.csv")) {
    bump("offers.rows");
    const pid = prodIds.get(r.product_id);
    const sid = shopIds.get(r.shop_id);
    if (!pid || !sid) {
      bump("offers.orphan");
      continue;
    }
    const price = Number(r.price_toman);
    // Reject zero/negative and absurd values (dataset has a few corrupt prices ~1e17).
    const validPrice = Number.isFinite(price) && price >= 1000 && price < 1e11 ? Math.round(price) : null;
    if (!validPrice) bump("offers.invalid_price");
    const changed = nul(r.last_price_changed_at);
    const ts = changed && !Number.isNaN(Date.parse(changed)) ? new Date(changed).toISOString() : null;
    if (!ts) bump("offers.no_timestamp");
    batch.push({
      oid: r.offer_id,
      pid,
      sid,
      price: validPrice,
      title: nul(r.seller_title),
      desc: nul(r.description)?.slice(0, 600) ?? null,
      warranty: parseWarranty(r.warranty),
      changed: ts,
    });
    if (batch.length >= 10000) (offerTx(batch), (batch = []));
  }
  offerTx(batch);
  console.log("offers done");

  /* ---- aggregates & indexes ---- */
  db.exec(`
    CREATE INDEX offers_product ON offers(product_id, price);
    CREATE INDEX offers_shop ON offers(shop_id);
    UPDATE products SET
      offer_count = (SELECT COUNT(*) FROM offers o WHERE o.product_id = products.id),
      shop_count = (SELECT COUNT(DISTINCT shop_id) FROM offers o WHERE o.product_id = products.id),
      min_price = (SELECT MIN(price) FROM offers o WHERE o.product_id = products.id),
      max_price = (SELECT MAX(price) FROM offers o WHERE o.product_id = products.id),
      last_changed = (SELECT MAX(last_changed) FROM offers o WHERE o.product_id = products.id);
    UPDATE shops SET offer_count = (SELECT COUNT(*) FROM offers o WHERE o.shop_id = shops.id);
    CREATE INDEX products_cat ON products(category, min_price);
    CREATE INDEX products_brand ON products(brand);
    CREATE INDEX shops_geo ON shops(lat, lon);
    INSERT INTO neighborhoods SELECT location_label, AVG(lat), AVG(lon), COUNT(*) FROM shops
      WHERE location_label IS NOT NULL AND lat IS NOT NULL GROUP BY location_label HAVING COUNT(*) >= 2;
    INSERT INTO categories SELECT category, COUNT(*), SUM(offer_count) FROM products WHERE category IS NOT NULL GROUP BY category;
    INSERT INTO brands SELECT brand, category, COUNT(*) FROM products WHERE brand IS NOT NULL GROUP BY brand, category;
    CREATE INDEX brands_cat ON brands(category);
  `);

  /* ---- FTS (normalized copies; seller titles add colloquial names) ---- */
  const extraStmt = db.prepare(`SELECT GROUP_CONCAT(seller_title, ' ') t FROM (SELECT seller_title FROM offers WHERE product_id = ? LIMIT 3)`);
  const insFts = db.prepare(`INSERT INTO products_fts(rowid,title,brand,category,model,extra) VALUES (?,?,?,?,?,?)`);
  const all = db.prepare(`SELECT id,title,brand,category,model FROM products`).all() as { id: number; title: string; brand: string | null; category: string | null; model: string | null }[];
  tx(() => {
    for (const p of all) {
      const extra = (extraStmt.get(p.id) as { t: string | null }).t;
      insFts.run(p.id, normalizeFa(p.title), normalizeFa(p.brand), normalizeFa(p.category), normalizeFa(p.model), normalizeFa(extra));
    }
  })();
  db.exec(`INSERT INTO products_fts(products_fts) VALUES('optimize')`);

  const offerDates = db.prepare(`SELECT MIN(last_changed) a, MAX(last_changed) b FROM offers`).get() as { a: string; b: string };
  report["offers.oldest_change"] = offerDates.a;
  report["offers.newest_change"] = offerDates.b;
  const ins = db.prepare(`INSERT INTO meta VALUES (?,?)`);
  ins.run("built_at", new Date().toISOString());
  ins.run("report", JSON.stringify(report));
  db.exec("VACUUM");
  db.close();
  fs.writeFileSync(path.join("data", "quality-report.json"), JSON.stringify(report, null, 2));
  console.log(report);
  console.log("size MB", (fs.statSync(OUT).size / 1e6).toFixed(1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
