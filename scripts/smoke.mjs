// Smoke test against a running deployment: node scripts/smoke.mjs https://your-app.liara.run
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let failed = 0;

async function check(name, path, assert, init) {
  const t = Date.now();
  try {
    const r = await fetch(base + path, init);
    const body = await r.json().catch(() => null);
    const ok = r.ok && assert(body);
    console.log(`${ok ? "PASS" : "FAIL"} ${name} (${r.status}, ${Date.now() - t}ms)`);
    if (!ok) failed++;
    return body;
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message}`);
    failed++;
  }
}

await check("health", "/api/health", (b) => b?.ok === true);
await check("meta", "/api/meta", (b) => b?.neighborhoods?.length > 10);
const s = await check("search", `/api/search?q=${encodeURIComponent("گوشی سامسونگ")}`, (b) => b?.items?.length > 0);
const pid = s?.items?.[0]?.id;
if (pid) {
  await check("product", `/api/products/${pid}`, (b) => b?.product?.id === pid);
  await check("shops near", `/api/products/${pid}/shops?lat=35.69&lon=51.41&radiusKm=10`, (b) => Array.isArray(b?.offers));
}
await check(
  "agent",
  "/api/agent",
  (b) => typeof b?.reply === "string",
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "هدفون بلوتوثی تا ۲ میلیون" }], context: {} }) },
);
const page = await fetch(base + "/").then((r) => r.status).catch(() => 0);
console.log(`${page === 200 ? "PASS" : "FAIL"} home page (${page})`);
if (page !== 200) failed++;
process.exit(failed ? 1 : 0);
