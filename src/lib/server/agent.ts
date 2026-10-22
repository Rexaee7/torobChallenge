import "server-only";
import OpenAI from "openai";
import { extractSlots } from "../intent";
import { findArea, getProduct, getProductShops, getProducts, neighborhoods, searchProducts, similarProducts } from "./repo";
import type { ProductSummary, SearchResult, ShopOffer } from "../types";
import { toPersianDigits } from "../normalize";

/* ---------------- contracts ---------------- */

export interface AgentContext {
  lat?: number;
  lon?: number;
  areaLabel?: string;
  radiusKm?: number;
  maxPrice?: number;
  installment?: boolean;
  selectedProductId?: string;
  shortlist?: string[];
  /** Products currently on screen (from the last assistant turn), in display order. */
  lastShown?: { id: string; title: string; minPrice: number | null }[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentBlock =
  | { type: "products"; title: string; items: ProductSummary[]; matchMode: SearchResult["matchMode"]; total: number }
  | { type: "shops"; title: string; productId: string; productTitle: string; items: ShopOffer[]; totalOffers: number }
  | { type: "compare"; productIds: string[] }
  | { type: "alternatives"; title: string; items: ProductSummary[] };

export interface AgentResponse {
  reply: string;
  quickReplies: string[];
  blocks: AgentBlock[];
  contextPatch: Partial<AgentContext>;
  engine: "llm" | "rules";
}

/* ---------------- tools ---------------- */

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the Torob Tehran dataset for products. Query MUST be short Persian product words as sold in Iran (e.g. 'گوشی سامسونگ', 'کفش ورزشی'), never English, never include location or price words.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string", description: "Exact category name if known from a previous result facet" },
          brand: { type: "string" },
          max_price_toman: { type: "number" },
          min_price_toman: { type: "number" },
          installment_only: { type: "boolean" },
          near_user_only: { type: "boolean", description: "Only products with a seller within the user's radius" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_shops",
      description: "List physical shops in the dataset that have a recorded offer for a product, with distance, declared hours, installment info.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          sort: { type: "string", enum: ["best", "nearest", "cheapest"] },
          installment_only: { type: "boolean" },
          open_now_only: { type: "boolean" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_products",
      description: "Show a side-by-side comparison of 2-4 products the user is considering.",
      parameters: { type: "object", properties: { product_ids: { type: "array", items: { type: "string" } } }, required: ["product_ids"] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_alternatives",
      description: "Find similar products (same category, similar price) when the chosen one is unavailable, too far or over budget.",
      parameters: { type: "object", properties: { product_id: { type: "string" } }, required: ["product_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "update_preferences",
      description: "Store user constraints extracted from the conversation.",
      parameters: {
        type: "object",
        properties: {
          max_price_toman: { type: "number" },
          installment: { type: "boolean" },
          area_label: { type: "string", description: "Tehran neighborhood name in Persian" },
          radius_km: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "respond",
      description: "Final answer to the user. Always call this last.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "Short Persian reply (max ~3 sentences). Ask at most one clarifying question." },
          quick_replies: { type: "array", items: { type: "string" }, description: "2-5 short Persian tap-able answers/next steps" },
        },
        required: ["message", "quick_replies"],
      },
    },
  },
];

const SYSTEM = `You are «همراه خرید»، a Persian in-person shopping assistant for Tehran built on the Torob dataset.
Journey: (1) help the user pick the right product/model (2) find physical shops near them (3) compare shops by price, distance, declared hours, installments (4) help contact sellers (simulated) and offer alternatives.
Rules:
- Always reply in Persian, friendly, concise. Use tools; never invent products, prices or shops.
- Prices are "recorded prices" from the dataset (about a week old), not live. Stock is NOT verified. Hours are declared, not guaranteed. Shop names may be synthetic; phone numbers are fake, so never give phone numbers — suggest the in-app "پیگیری از فروشنده" (simulated) instead.
- Installment filter: only shops with explicit payment options count; missing means "ثبت نشده", not "ندارد".
- If the need is vague (e.g. "کفش" or "گوشی خوب"), search broadly first, then ask ONE question that best splits the results (use-case, budget, brand, size) with quick replies.
- Do NOT call find_shops on a vague first request; first show options and ask one question. Call find_shops only when the user picks a product, names an exact model, or asks where to buy one of the shown products.
- When the user mentions a place (street, square, neighborhood), call update_preferences with area_label in the SAME step as your other tool calls (parallel tool calls are allowed) to save time.
- "اولی / دومی / همین" refers to products_on_screen_in_order — use their ids directly instead of searching again.
- When the user picks or clearly means a product, call find_shops. If there are no nearby shops, say so and propose relaxing (bigger radius, other brand, alternatives).
- Tool search queries: short Persian product nouns only.
- The UI already shows cards for tool results; do not list every item in text — summarize the trade-off (cheapest vs most sellers vs closest) in 1-3 sentences.
- Always finish with the respond tool.`;

function client(): OpenAI | null {
  const key = process.env.BOXAPI_API_KEY;
  if (!key || process.env.LLM_DISABLED === "1") return null;
  return new OpenAI({ apiKey: key, baseURL: process.env.BOXAPI_BASE_URL ?? "https://ai.boxapi.ir/ai/v1", timeout: 25000, maxRetries: 1 });
}

const MODEL = () => process.env.BOXAPI_MODEL ?? "gpt-5.4-mini";

function resolveArea(ctx: AgentContext, label?: string): Partial<AgentContext> {
  if (!label) return {};
  const n = findArea(label);
  return n ? { areaLabel: n.label, lat: n.lat, lon: n.lon, radiusKm: ctx.radiusKm ?? 3 } : {};
}

function compactProducts(items: ProductSummary[]) {
  return items.slice(0, 8).map((p) => ({
    id: p.id,
    title: p.title,
    brand: p.brand,
    category: p.category,
    min_price: p.minPrice,
    max_price: p.maxPrice,
    sellers: p.shopCount,
    nearby_sellers: p.nearbyShopCount,
    specs: p.keySpecs.map(([k, v]) => `${k}: ${v}`).join("؛ "),
  }));
}

function compactShops(items: ShopOffer[]) {
  return items.slice(0, 6).map((o) => ({
    shop: o.shop.name,
    area: o.shop.area,
    price: o.price,
    distance_km: o.distanceKm != null ? Math.round(o.distanceKm * 10) / 10 : null,
    open: o.openState,
    installment: o.shop.payments.map((p) => p.provider),
    mall: o.shop.mall,
    reasons: o.reasons,
  }));
}

/* ---------------- tool execution ---------------- */

interface RunState {
  ctx: AgentContext;
  patch: Partial<AgentContext>;
  blocks: AgentBlock[];
}

function cur(s: RunState): AgentContext {
  return { ...s.ctx, ...s.patch };
}

function runTool(name: string, args: Record<string, unknown>, s: RunState): unknown {
  const c = cur(s);
  switch (name) {
    case "update_preferences": {
      if (typeof args.max_price_toman === "number") s.patch.maxPrice = args.max_price_toman;
      if (typeof args.installment === "boolean") s.patch.installment = args.installment;
      if (typeof args.radius_km === "number") s.patch.radiusKm = Math.min(Math.max(args.radius_km, 1), 30);
      if (typeof args.area_label === "string") {
        const a = resolveArea(c, args.area_label);
        Object.assign(s.patch, a);
        if (!a.areaLabel) return { ok: false, note: "area not found in dataset neighborhoods" };
      }
      return { ok: true, context: cur(s) };
    }
    case "search_products": {
      const near = args.near_user_only === true && c.lat != null;
      const r = searchProducts({
        q: String(args.query ?? ""),
        category: typeof args.category === "string" ? args.category : undefined,
        brand: typeof args.brand === "string" ? args.brand : undefined,
        maxPrice: typeof args.max_price_toman === "number" ? args.max_price_toman : c.maxPrice,
        minPrice: typeof args.min_price_toman === "number" ? args.min_price_toman : undefined,
        installment: args.installment_only === true || c.installment,
        lat: near ? c.lat : undefined,
        lon: near ? c.lon : undefined,
        radiusKm: near ? c.radiusKm ?? 5 : undefined,
        limit: 12,
      });
      s.blocks = s.blocks.filter((b) => b.type !== "products");
      s.blocks.push({ type: "products", title: `نتایج «${args.query}»`, items: r.items, matchMode: r.matchMode, total: r.total });
      return {
        total: r.total,
        match_mode: r.matchMode,
        items: compactProducts(r.items),
        top_categories: r.facets.categories.slice(0, 6),
        top_brands: r.facets.brands.slice(0, 6),
        price_range: r.facets.price,
        suggestions: r.suggestions,
      };
    }
    case "find_shops": {
      const pid = String(args.product_id ?? "");
      const r = getProductShops(pid, {
        lat: c.lat,
        lon: c.lon,
        radiusKm: c.lat != null ? c.radiusKm ?? 5 : undefined,
        installment: args.installment_only === true || c.installment,
        openOnly: args.open_now_only === true,
        sort: (args.sort as "best") ?? undefined,
      });
      if (!r) return { error: "product not found" };
      s.patch.selectedProductId = pid;
      s.blocks.push({ type: "shops", title: `فروشگاه‌های «${r.product.title}»`, productId: pid, productTitle: r.product.title, items: r.offers.slice(0, 10), totalOffers: r.totalOffers });
      return { total_offers_in_dataset: r.totalOffers, shown: r.offers.length, excluded_by: r.excluded, user_location_known: c.lat != null, shops: compactShops(r.offers) };
    }
    case "compare_products": {
      const ids = (Array.isArray(args.product_ids) ? args.product_ids : []).map(String).slice(0, 4);
      const ps = getProducts(ids);
      s.blocks.push({ type: "compare", productIds: ps.map((p) => p.id) });
      return ps.map((p) => ({ id: p.id, title: p.title, min_price: p.minPrice, sellers: p.shopCount, specs: p.specs.slice(0, 12) }));
    }
    case "find_alternatives": {
      const pid = String(args.product_id ?? "");
      const items = similarProducts(pid, { lat: c.lat, lon: c.lon, radiusKm: c.radiusKm, maxPrice: c.maxPrice });
      s.blocks.push({ type: "alternatives", title: "گزینه‌های مشابه", items });
      return compactProducts(items);
    }
  }
  return { error: "unknown tool" };
}

/* ---------------- LLM loop ---------------- */

async function llmTurn(ai: OpenAI, history: ChatMessage[], ctx: AgentContext): Promise<AgentResponse> {
  const s: RunState = { ctx, patch: {}, blocks: [] };
  const sel = ctx.selectedProductId ? getProduct(ctx.selectedProductId) : null;
  const ctxNote = `User context: ${JSON.stringify({
    area: ctx.areaLabel ?? null,
    has_location: ctx.lat != null,
    radius_km: ctx.radiusKm ?? null,
    budget_max_toman: ctx.maxPrice ?? null,
    installment_required: !!ctx.installment,
    selected_product: sel ? { id: sel.id, title: sel.title } : null,
    shortlist: ctx.shortlist ?? [],
    products_on_screen_in_order: (ctx.lastShown ?? []).slice(0, 8),
    known_areas: neighborhoods().map((n) => n.label),
  })}`;
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    { role: "system", content: ctxNote },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
  ];
  for (let step = 0; step < 5; step++) {
    const res = await ai.chat.completions.create({ model: MODEL(), messages, tools: TOOLS, tool_choice: "required" });
    const msg = res.choices[0]?.message;
    if (!msg) break;
    const calls = msg.tool_calls ?? [];
    if (!calls.length) {
      return { reply: msg.content ?? "", quickReplies: [], blocks: s.blocks, contextPatch: s.patch, engine: "llm" };
    }
    messages.push(msg);
    for (const call of calls) {
      if (call.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* ignore */
      }
      if (call.function.name === "respond") {
        return {
          reply: String(args.message ?? ""),
          quickReplies: (Array.isArray(args.quick_replies) ? args.quick_replies : []).map(String).slice(0, 5),
          blocks: s.blocks,
          contextPatch: s.patch,
          engine: "llm",
        };
      }
      const out = runTool(call.function.name, args, s);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out).slice(0, 6000) });
    }
  }
  return { reply: "نتایج رو پایین می‌بینی. کدوم رو بیشتر بررسی کنیم؟", quickReplies: [], blocks: s.blocks, contextPatch: s.patch, engine: "llm" };
}

/* ---------------- rule-based fallback ---------------- */

const fa = (n: number) => toPersianDigits(Math.round(n).toLocaleString("en-US")).replace(/,/g, "٬");

export function rulesTurn(history: ChatMessage[], ctx: AgentContext): AgentResponse {
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const areas = neighborhoods().map((n) => n.label);
  const slots = extractSlots(last, areas);
  const s: RunState = { ctx, patch: {}, blocks: [] };
  if (slots.maxPrice) s.patch.maxPrice = slots.maxPrice;
  if (slots.installment) s.patch.installment = true;
  if (slots.area) Object.assign(s.patch, resolveArea(ctx, slots.area));
  const c = cur(s);

  if (!slots.query) {
    const bits: string[] = [];
    if (slots.maxPrice) bits.push(`بودجه تا ${fa(slots.maxPrice)} تومان`);
    if (slots.installment) bits.push("فقط فروشگاه‌های دارای خرید قسطی");
    if (slots.area) bits.push(`محدوده ${slots.area}`);
    return {
      reply: bits.length ? `باشه، ${bits.join("، ")} رو اعمال کردم. چه محصولی مد نظرته؟` : "سلام! بگو دنبال چه محصولی هستی تا بین فروشگاه‌های حضوری تهران برات پیدا کنم.",
      quickReplies: ["گوشی موبایل", "کفش ورزشی", "لپ تاپ", "هدفون بلوتوثی"],
      blocks: [],
      contextPatch: s.patch,
      engine: "rules",
    };
  }

  const r = searchProducts({ q: slots.query, maxPrice: c.maxPrice, installment: c.installment, limit: 12 });
  s.blocks.push({ type: "products", title: `نتایج «${slots.query}»`, items: r.items, matchMode: r.matchMode, total: r.total });

  let reply: string;
  let quick: string[] = [];
  if (r.matchMode === "none") {
    reply = `برای «${slots.query}» در دیتاست ترب چیزی پیدا نکردم. این به معنی نبودنش در تهران نیست؛ پوشش دیتاست محدوده.`;
    quick = r.suggestions.length ? r.suggestions : ["گوشی موبایل", "کفش ورزشی"];
    if (c.maxPrice) quick.unshift("بودجه رو بردار");
    if (c.installment) quick.unshift("بدون شرط قسطی");
  } else {
    const cats = r.facets.categories;
    const brands = r.facets.brands;
    reply = `${toPersianDigits(r.total)} محصول پیدا شد${r.matchMode === "partial" ? " (تطابق بخشی)" : ""}.`;
    if (cats.length > 2 && cats[0].count < r.total * 0.8) {
      reply += " دقیقاً کدوم دسته منظورته؟";
      quick = cats.slice(0, 4).map((x) => x.name);
    } else if (!c.maxPrice) {
      reply += " بودجه‌ت حدوداً چقدره؟";
      quick = ["تا ۵ میلیون", "تا ۲۰ میلیون", "تا ۵۰ میلیون", "مهم نیست"];
    } else if (brands.length > 1) {
      reply += " برند خاصی مد نظرته؟";
      quick = brands.slice(0, 4).map((x) => x.name);
    } else {
      reply += " روی یکی بزن تا فروشگاه‌های نزدیکت رو ببینی.";
    }
  }
  return { reply, quickReplies: quick, blocks: s.blocks, contextPatch: s.patch, engine: "rules" };
}

export async function agentTurn(history: ChatMessage[], ctx: AgentContext): Promise<AgentResponse> {
  const ai = client();
  if (ai) {
    try {
      return await llmTurn(ai, history, ctx);
    } catch (e) {
      console.error("[agent] LLM failed, falling back to rules:", (e as Error).message);
    }
  }
  return rulesTurn(history, ctx);
}
