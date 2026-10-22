// Mobile screenshots of the main journey using the locally installed Edge.
// Usage: node scripts/shots.mjs [baseUrl] [outDir]
import { chromium } from "playwright-core";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "shots";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fa-IR", isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text()));

const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log("shot", name);
};

await page.goto(base + "/");
await shot("01-home");

// Location via picker
await page.getByRole("button", { name: "تغییر موقعیت" }).click();
await page.getByPlaceholder("مثلاً ونک").fill("جمهوری");
await shot("02-location");
await page.getByRole("button", { name: /خیابان جمهوری/ }).first().click();

// Ask the assistant
await page.getByLabel("پیام به دستیار").fill(process.env.Q ?? "هدفون بلوتوثی تا ۳ میلیون");
await page.getByRole("button", { name: "بفرست" }).click();
await page.waitForSelector("article", { timeout: 60000 });
await shot("03-results");
await page.mouse.wheel(0, 600);
await shot("04-results-scroll");

// Product page
await page.locator("article a", { hasText: "دیدن فروشگاه‌ها" }).first().click();
await page.waitForURL(/\/p\//);
await page.waitForTimeout(1500);
await shot("05-product");
await page.mouse.wheel(0, 900);
await shot("06-shops");

// Contact simulation
const ask = page.getByRole("button", { name: /پرسیدن از فروشنده/ }).first();
if (await ask.count()) {
  await ask.click();
  await shot("07-contact");
  await page.getByText("کنترل دمو").click();
  await page.getByRole("button", { name: "بی‌پاسخ" }).click();
  await page.getByRole("button", { name: /ارسال پیام/ }).click();
  await page.waitForTimeout(2500);
  await shot("08-reply");
  const alt = page.getByRole("button", { name: /فروشنده جایگزین/ });
  if (await alt.count()) {
    await alt.click();
    await page.waitForTimeout(800);
    await shot("09-alternatives");
  }
}
await browser.close();
