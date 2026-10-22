"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp, type ChatTurn } from "@/lib/client/store";
import type { AgentBlock, AgentResponse } from "@/lib/server/agent";
import { ProductCard } from "./ProductCard";
import { Badge, Chip, Notice, Skeleton } from "./ui";
import { useHydrated } from "./Header";
import { fa, km, toman, tomanShort } from "@/lib/format";
import { CompareTray } from "./CompareTray";

const STARTERS = [
  "یه گوشی سامسونگ تا ۶۰ میلیون می‌خوام",
  "کفش ورزشی مردانه برای پیاده‌روی",
  "هدفون بلوتوثی خوب و ارزون",
  "لپ تاپ برای برنامه‌نویسی با خرید قسطی",
];

const BUDGETS = [5e6, 10e6, 20e6, 50e6, 100e6];

function Blocks({ blocks }: { blocks: AgentBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === "products" || b.type === "alternatives") {
          if (!b.items.length && b.type === "alternatives") return null;
          if (!b.items.length)
            return (
              <Notice key={i} tone="warn">
                محصولی در دیتاست پیدا نشد. این به معنی نبودنش در بازار تهران نیست — پوشش دیتاست ترب محدود است. عبارت را ساده‌تر کن یا یکی از پیشنهادها را بزن.
              </Notice>
            );
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-700">{b.title}</span>
                {b.type === "products" && <span>{fa(b.total)} مورد{b.matchMode === "partial" ? " · تطابق بخشی" : ""}</span>}
              </div>
              {b.items.slice(0, 6).map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          );
        }
        if (b.type === "shops") {
          return (
            <div key={i} className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
              <div className="text-sm font-bold">{b.title}</div>
              {b.items.length === 0 && <p className="text-sm text-stone-500">در این محدوده فروشنده‌ای پیدا نشد.</p>}
              <ul className="divide-y divide-stone-100">
                {b.items.slice(0, 4).map((o) => (
                  <li key={o.offerId} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {o.shop.name ?? "فروشگاه"} <span className="text-[11px] text-stone-400">{o.shop.area}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-stone-600">
                      {o.distanceKm != null ? `${km(o.distanceKm)} · ` : ""}
                      <b>{tomanShort(o.price)}</b>
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`/p/${b.productId}`} className="block rounded-xl bg-teal-700 py-2 text-center text-sm font-bold text-white">
                مقایسه همه {fa(b.totalOffers)} فروشنده ←
              </Link>
            </div>
          );
        }
        if (b.type === "compare") {
          return (
            <Link key={i} href={`/compare?ids=${b.productIds.join(",")}`} className="block rounded-2xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-900 ring-1 ring-amber-200">
              ⚖️ دیدن جدول مقایسه {fa(b.productIds.length)} محصول ←
            </Link>
          );
        }
        return null;
      })}
    </div>
  );
}

function lastShownProducts(chat: ChatTurn[]) {
  for (let i = chat.length - 1; i >= 0; i--) {
    const blocks = (chat[i].blocks ?? []) as AgentBlock[];
    const b = blocks.find((x) => x.type === "products" || x.type === "alternatives");
    if (b && (b.type === "products" || b.type === "alternatives")) return b.items.slice(0, 6).map((p) => ({ id: p.id, title: p.title, minPrice: p.minPrice }));
  }
  return [];
}

export function Assistant() {
  const hydrated = useHydrated();
  const st = useApp();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chat = hydrated ? st.chat : [];

  useEffect(() => {
    if (chat.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [chat.length, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    const user: ChatTurn = { id: crypto.randomUUID(), role: "user", content: t };
    st.pushChat(user);
    setInput("");
    setBusy(true);
    try {
      const history = [...useApp.getState().chat].map((m) => ({ role: m.role, content: m.content }));
      const s = useApp.getState();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          context: {
            lat: s.location?.lat,
            lon: s.location?.lon,
            areaLabel: s.location?.label,
            radiusKm: s.radiusKm,
            maxPrice: s.maxPrice ?? undefined,
            installment: s.installment || undefined,
            shortlist: s.shortlist.map((p) => p.id),
            lastShown: lastShownProducts(s.chat),
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data: AgentResponse = await res.json();
      const p = data.contextPatch;
      if (p.maxPrice !== undefined) s.setMaxPrice(p.maxPrice ?? null);
      if (p.installment !== undefined) s.setInstallment(!!p.installment);
      if (p.radiusKm) s.setRadius(p.radiusKm);
      if (p.lat != null && p.lon != null && p.areaLabel) s.setLocation({ lat: p.lat, lon: p.lon, label: p.areaLabel, source: "area" });
      st.pushChat({ id: crypto.randomUUID(), role: "assistant", content: data.reply, quickReplies: data.quickReplies, blocks: data.blocks, engine: data.engine });
    } catch {
      setError("ارتباط با دستیار برقرار نشد. دوباره امتحان کن — پیامت حفظ شده است.");
      setInput(t);
    } finally {
      setBusy(false);
    }
  }

  const last = chat[chat.length - 1];

  return (
    <div className="space-y-4">
      {chat.length === 0 && (
        <section className="space-y-4 pt-2">
          <div>
            <h1 className="text-2xl font-extrabold leading-10 text-stone-900">چی می‌خوای بخری؟</h1>
            <p className="text-sm leading-7 text-stone-600">
              بگو دنبال چی هستی؛ کمکت می‌کنم مدل مناسب را انتخاب کنی، فروشگاه‌های حضوری نزدیکت را مقایسه کنی و قبل از رفتن از فروشنده بپرسی.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-2xl bg-white p-3 text-right text-sm text-stone-700 shadow-sm ring-1 ring-stone-200 hover:ring-teal-500">
                «{s}»
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Structured constraints — editable without typing */}
      <section aria-label="شرایط خرید" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={hydrated && st.installment} onClick={() => st.setInstallment(!st.installment)}>
          💳 فقط قسطی
        </Chip>
        {BUDGETS.map((b) => (
          <Chip key={b} active={hydrated && st.maxPrice === b} onClick={() => st.setMaxPrice(st.maxPrice === b ? null : b)}>
            تا {tomanShort(b)}
          </Chip>
        ))}
        {hydrated && st.maxPrice && !BUDGETS.includes(st.maxPrice) && (
          <Chip active onClick={() => st.setMaxPrice(null)}>
            تا {tomanShort(st.maxPrice)} ✕
          </Chip>
        )}
      </section>

      <div className="space-y-4">
        {chat.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="animate-msg flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-teal-700 px-3.5 py-2 text-sm leading-7 text-white">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="animate-msg space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800" aria-hidden>
                  هـ
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm leading-7 text-stone-800 shadow-sm ring-1 ring-stone-200">
                  {m.content}
                  {m.engine === "rules" && (
                    <div className="mt-1">
                      <Badge tone="neutral" icon={false}>حالت پایه (بدون مدل زبانی)</Badge>
                    </div>
                  )}
                </div>
              </div>
              {m.blocks && m.blocks.length > 0 && <Blocks blocks={m.blocks as AgentBlock[]} />}
              {m === last && m.quickReplies && m.quickReplies.length > 0 && !busy && (
                <div className="flex flex-wrap gap-2 pr-9">
                  {m.quickReplies.map((q) => (
                    <Chip key={q} onClick={() => send(q)}>
                      {q}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="space-y-2" aria-live="polite" aria-label="در حال جست‌وجو">
            <div className="text-xs text-stone-500">در حال جست‌وجو در فروشگاه‌های تهران…</div>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        )}
        {error && <Notice tone="bad">{error}</Notice>}
        <div ref={endRef} />
      </div>

      {hydrated && chat.length > 0 && (
        <div className="flex justify-center">
          <button className="text-xs text-stone-500 underline" onClick={() => st.resetChat()}>
            شروع گفتگوی تازه
          </button>
        </div>
      )}

      <CompareTray />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <label htmlFor="ask" className="sr-only">
            پیام به دستیار
          </label>
          <input
            id="ask"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={chat.length ? "مثلاً: ارزون‌تر داری؟ یا: سامسونگ باشه" : "مثلاً: کفش کتونی سایز ۴۲ تا ۳ میلیون"}
            className="min-h-11 flex-1 rounded-2xl border border-stone-300 bg-white px-4 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            autoComplete="off"
            maxLength={500}
          />
          <button type="submit" disabled={busy || !input.trim()} className="min-h-11 rounded-2xl bg-teal-700 px-5 text-sm font-bold text-white disabled:opacity-40">
            بفرست
          </button>
        </div>
        {hydrated && (st.maxPrice || st.installment || st.location) && (
          <div className="mx-auto mt-1.5 max-w-3xl truncate text-[11px] text-stone-500">
            شرایط فعلی: {[st.location && `${st.location.label} (${fa(st.radiusKm)} کیلومتر)`, st.maxPrice && `بودجه ${toman(st.maxPrice)}`, st.installment && "فقط قسطی"].filter(Boolean).join(" · ")}
          </div>
        )}
      </form>
    </div>
  );
}
