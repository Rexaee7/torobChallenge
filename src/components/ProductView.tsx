"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContactStatus, ProductDetail, ProductSummary, ShopOffer, ShopsResult } from "@/lib/types";
import { locParams, qs, useApp } from "@/lib/client/store";
import { getJson, useMeta } from "@/lib/client/useMeta";
import { Badge, Button, Chip, Img, Notice, Sheet, Skeleton } from "./ui";
import { OfferCard } from "./OfferCard";
import { ShopSheet } from "./ShopSheet";
import { ProductCard, PriceRange } from "./ProductCard";
import { LocationPicker, RADII } from "./LocationPicker";
import { NameBadge, OpenBadge, PaymentBadges, visitLabel } from "./ShopBits";
import { useHydrated } from "./Header";
import { ago, fa, faDate, km, toman } from "@/lib/format";
import { DAY_FA, DAY_KEYS, tehranNow } from "@/lib/parsers";
import { STATUS_FA } from "@/lib/contact";

type Sort = "best" | "nearest" | "cheapest";

const VISIT_PRESETS = [
  { k: "now", label: "همین الان" },
  { k: "evening", label: "امروز عصر (۱۸)" },
  { k: "tomorrow", label: "فردا صبح (۱۰)" },
  { k: "custom", label: "زمان دیگر…" },
] as const;

export function ProductView({ id }: { id: string }) {
  const hydrated = useHydrated();
  const st = useApp();
  const meta = useMeta();
  const [detail, setDetail] = useState<{ product: ProductDetail; alternatives: ProductSummary[] } | null>(null);
  const [shops, setShops] = useState<ShopsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<Sort>("best");
  const [provider, setProvider] = useState<string>("");
  const [openOnly, setOpenOnly] = useState(false);
  const [visitPreset, setVisitPreset] = useState<(typeof VISIT_PRESETS)[number]["k"]>("now");
  const [customDay, setCustomDay] = useState<string>("sat");
  const [customHour, setCustomHour] = useState(17);
  const [selected, setSelected] = useState<ShopOffer | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [altFor, setAltFor] = useState<{ offer: ShopOffer; reason: ContactStatus | "CLOSED_HOURS" } | null>(null);
  const [showSpecs, setShowSpecs] = useState(false);

  const visit = useMemo(() => {
    const now = tehranNow();
    if (visitPreset === "now") return null;
    if (visitPreset === "evening") return { day: now.day, minute: 18 * 60 };
    if (visitPreset === "tomorrow") return { day: DAY_KEYS[(DAY_KEYS.indexOf(now.day) + 1) % 7], minute: 10 * 60 };
    return { day: customDay, minute: customHour * 60 };
  }, [visitPreset, customDay, customHour]);

  const location = hydrated ? st.location : null;
  const query = useMemo(
    () =>
      qs({
        ...(location ? locParams({ location, radiusKm: st.radiusKm }) : {}),
        installment: hydrated && st.installment && !provider ? true : undefined,
        provider: provider || undefined,
        openOnly: openOnly || undefined,
        day: visit?.day,
        minute: visit?.minute,
        sort,
      }),
    [location, st.radiusKm, st.installment, provider, openOnly, visit, sort, hydrated],
  );

  useEffect(() => {
    getJson<{ product: ProductDetail; alternatives: ProductSummary[] }>(`/api/products/${id}?${location ? qs(locParams({ location, radiusKm: Math.max(st.radiusKm, 5) })) : ""}`)
      .then(setDetail)
      .catch(() => setError(true));
  }, [id, location, st.radiusKm]);

  const loadShops = useCallback(() => {
    if (!hydrated) return;
    setLoading(true);
    setError(false);
    getJson<ShopsResult>(`/api/products/${id}/shops?${query}`)
      .then(setShops)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, query, hydrated]);
  useEffect(loadShops, [loadShops]);

  const p = detail?.product;
  const offers = shops?.offers ?? [];
  const contacts = hydrated ? st.contacts : {};
  const badStatus = (o: ShopOffer) => ["OUT_OF_STOCK", "NO_RESPONSE", "CLOSED"].includes(contacts[o.offerId]?.status ?? "");
  const altOffers = altFor ? offers.filter((o) => o.offerId !== altFor.offer.offerId && !badStatus(o) && o.openState !== "closed").slice(0, 3) : [];

  const onFindAlternative = (o: ShopOffer, reason: ContactStatus | "CLOSED_HOURS") => {
    setSelected(null);
    setAltFor({ offer: o, reason });
    setTimeout(() => document.getElementById("alt-banner")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const toggleCompare = (oid: string) => setCompareIds((s) => (s.includes(oid) ? s.filter((x) => x !== oid) : [...s, oid].slice(-4)));

  if (error && !p) {
    return (
      <div className="space-y-3 pt-6">
        <Notice tone="bad">این محصول بارگذاری نشد. ممکن است شناسه اشتباه باشد یا سرور در دسترس نباشد.</Notice>
        <Button onClick={() => location && loadShops()}>تلاش دوباره</Button>
        <Link href="/" className="block text-sm text-teal-800 underline">
          بازگشت به دستیار
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-block text-sm text-teal-800">
        → بازگشت به دستیار
      </Link>

      {/* Product header */}
      {!p ? (
        <Skeleton className="h-40" />
      ) : (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
          <div className="flex gap-3">
            <Img src={p.images[0]} alt={p.title} className="h-28 w-28 shrink-0 rounded-2xl ring-1 ring-stone-100" />
            <div className="min-w-0 space-y-1">
              <h1 className="text-base font-extrabold leading-7">{p.title}</h1>
              <div className="text-xs text-stone-500">{[p.brand, p.category, p.model].filter(Boolean).join(" · ")}</div>
              <PriceRange min={p.minPrice} max={p.maxPrice} />
              <div className="flex flex-wrap gap-1">
                <Badge tone="neutral" icon={false}>
                  قیمت ثبت‌شده · آخرین تغییر {ago(p.lastChanged)}
                </Badge>
                <Badge tone="info">{fa(p.shopCount)} فروشگاه حضوری در دیتاست</Badge>
              </div>
            </div>
          </div>
          {p.images.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              {p.images.slice(1).map((src) => (
                <Img key={src} src={src} alt="" className="h-16 w-16 shrink-0 rounded-xl ring-1 ring-stone-100" />
              ))}
            </div>
          )}
          {p.specs.length > 0 ? (
            <div className="mt-3">
              <button className="text-sm font-semibold text-teal-800" onClick={() => setShowSpecs((v) => !v)} aria-expanded={showSpecs}>
                {showSpecs ? "▲ بستن مشخصات" : `▼ مشخصات فنی (${fa(p.specs.length)} مورد)`}
              </button>
              {showSpecs && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                  {p.specs.map(([k, v], i) => (
                    <div key={i} className="contents">
                      <dt className="text-stone-500">{k}</dt>
                      <dd className="text-stone-800">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-stone-500">مشخصات فنی برای این محصول در دیتاست ثبت نشده است.</p>
          )}
          <p className="mt-2 text-[11px] text-stone-400">نقد و بررسی تأییدشده‌ای در دیتاست موجود نیست.</p>
        </section>
      )}

      {/* Shop finder controls */}
      <section aria-label="فیلتر فروشگاه‌ها" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">کجا بخرم؟</h2>
          <button onClick={() => setLocOpen(true)} className="text-sm text-teal-800 underline">
            {location ? `📍 ${location.label}` : "📍 تعیین موقعیت"}
          </button>
        </div>
        {!location && hydrated && (
          <Notice tone="info">
            موقعیتت را مشخص کن تا فاصله‌ها و نزدیک‌ترین فروشگاه‌ها را ببینی. فعلاً همه فروشگاه‌های تهران به ترتیب قیمت نمایش داده می‌شوند.
            <button className="mr-1 font-bold underline" onClick={() => setLocOpen(true)}>
              انتخاب موقعیت
            </button>
          </Notice>
        )}
        {location && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {RADII.map((r) => (
              <Chip key={r} active={st.radiusKm === r} onClick={() => st.setRadius(r)}>
                {fa(r)} کیلومتر
              </Chip>
            ))}
          </div>
        )}
        <div className="flex gap-1 rounded-xl bg-stone-200/60 p-1 text-sm" role="radiogroup" aria-label="مرتب‌سازی">
          {(
            [
              ["best", "بهترین ترکیب"],
              ["nearest", "نزدیک‌ترین"],
              ["cheapest", "ارزان‌ترین"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              role="radio"
              aria-checked={sort === k}
              disabled={k === "nearest" && !location}
              onClick={() => setSort(k)}
              className={`flex-1 rounded-lg py-2 font-semibold disabled:opacity-40 ${sort === k ? "bg-white shadow-sm" : "text-stone-600"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={hydrated && st.installment && !provider} onClick={() => (setProvider(""), st.setInstallment(!st.installment))}>
            💳 فقط قسطی
          </Chip>
          {(meta?.providers ?? []).slice(0, 5).map((pr) => (
            <Chip key={pr.name} active={provider === pr.name} onClick={() => setProvider(provider === pr.name ? "" : pr.name)}>
              {pr.name}
            </Chip>
          ))}
          <Chip active={openOnly} onClick={() => setOpenOnly(!openOnly)}>
            🕒 فقط باز در زمان مراجعه
          </Chip>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <div className="mb-2 text-sm font-semibold">کِی می‌خوای بری؟</div>
          <div className="flex flex-wrap gap-2">
            {VISIT_PRESETS.map((v) => (
              <Chip key={v.k} active={visitPreset === v.k} onClick={() => setVisitPreset(v.k)}>
                {v.label}
              </Chip>
            ))}
          </div>
          {visitPreset === "custom" && (
            <div className="mt-2 flex gap-2">
              <select aria-label="روز" value={customDay} onChange={(e) => setCustomDay(e.target.value)} className="rounded-xl border border-stone-300 bg-white px-2 py-2 text-sm">
                {DAY_KEYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_FA[d]}
                  </option>
                ))}
              </select>
              <select aria-label="ساعت" value={customHour} onChange={(e) => setCustomHour(Number(e.target.value))} className="rounded-xl border border-stone-300 bg-white px-2 py-2 text-sm">
                {Array.from({ length: 15 }, (_, i) => i + 8).map((h) => (
                  <option key={h} value={h}>
                    ساعت {fa(h)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {shops && <p className="mt-2 text-[11px] text-stone-500">وضعیت باز/بسته بر اساس ساعت اعلامی فروشگاه برای {shops.visitTime.isNow ? "همین الان" : visitLabel(shops.visitTime.day, shops.visitTime.minute)} است.</p>}
        </div>
      </section>

      {/* Alternatives after a failed follow-up */}
      {altFor && (
        <section id="alt-banner" className="space-y-2 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-bold text-amber-900">
              🔁 «{altFor.offer.shop.name}» — {altFor.reason === "CLOSED_HOURS" ? "در زمان مراجعه بسته است" : STATUS_FA[altFor.reason as ContactStatus].label}. این جایگزین‌ها را پیشنهاد می‌کنم:
            </div>
            <button onClick={() => setAltFor(null)} aria-label="بستن" className="text-amber-900">
              ✕
            </button>
          </div>
          {altOffers.length ? (
            altOffers.map((o) => (
              <button key={o.offerId} onClick={() => setSelected(o)} className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white p-3 text-right text-sm ring-1 ring-amber-100">
                <span className="min-w-0">
                  <b>{o.shop.name}</b>
                  <span className="block text-[11px] text-stone-500">
                    {o.reasons.slice(0, 2).join(" · ") || o.shop.area}
                  </span>
                </span>
                <span className="shrink-0 text-left text-[12px]">
                  <b>{toman(o.price)}</b>
                  <span className="block text-stone-500">{o.distanceKm != null ? km(o.distanceKm) : ""}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-amber-900">فروشنده دیگری با این شرایط نماند. شعاع را بیشتر کن یا محصول مشابه را ببین.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {location && st.radiusKm < 20 && (
              <Button variant="secondary" onClick={() => st.setRadius(RADII.find((r) => r > st.radiusKm) ?? 20)}>
                شعاع بیشتر
              </Button>
            )}
            <Button variant="secondary" onClick={() => document.getElementById("similar")?.scrollIntoView({ behavior: "smooth" })}>
              محصولات مشابه ↓
            </Button>
          </div>
        </section>
      )}

      {/* Offers */}
      <section aria-label="فروشگاه‌ها" className="space-y-3" aria-busy={loading}>
        {shops && (
          <div className="text-xs text-stone-500">
            {fa(offers.length)} فروشنده نمایش داده می‌شود از {fa(shops.totalOffers)} فروشنده این محصول در دیتاست
          </div>
        )}
        {loading && !shops && [0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
        {shops && offers.length === 0 && (
          <div className="space-y-3 rounded-3xl bg-white p-4 ring-1 ring-stone-200">
            <div className="text-sm font-bold">با این شرایط فروشنده‌ای پیدا نشد.</div>
            <ul className="space-y-1 text-[13px] text-stone-600">
              {shops.excluded.radius > 0 && <li>• {fa(shops.excluded.radius)} فروشنده خارج از شعاع {fa(st.radiusKm)} کیلومتر</li>}
              {shops.excluded.installment > 0 && <li>• {fa(shops.excluded.installment)} فروشنده بدون اطلاعات خرید قسطی</li>}
              {shops.excluded.closed > 0 && <li>• {fa(shops.excluded.closed)} فروشنده در زمان مراجعه بسته یا بدون ساعت ثبت‌شده</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              {shops.excluded.radius > 0 && <Button onClick={() => st.setRadius(RADII.find((r) => r > st.radiusKm) ?? 20)}>افزایش شعاع</Button>}
              {shops.excluded.radius > 0 && (
                <Button variant="secondary" onClick={() => st.setLocation(null)}>
                  همه تهران
                </Button>
              )}
              {shops.excluded.installment > 0 && (
                <Button variant="secondary" onClick={() => (setProvider(""), st.setInstallment(false))}>
                  حذف شرط قسطی
                </Button>
              )}
              {shops.excluded.closed > 0 && (
                <Button variant="secondary" onClick={() => setOpenOnly(false)}>
                  نمایش بسته‌ها هم
                </Button>
              )}
            </div>
            <p className="text-[11px] text-stone-400">پوشش دیتاست ترب محدود است؛ نبودن نتیجه به معنی نبودن کالا در تهران نیست.</p>
          </div>
        )}
        {offers.map((o) => (
          <OfferCard
            key={o.offerId}
            o={o}
            productId={id}
            productTitle={p?.title ?? shops?.product.title ?? ""}
            isNow={shops?.visitTime.isNow ?? true}
            onOpen={() => setSelected(o)}
            compareSelected={compareIds.includes(o.offerId)}
            onCompareToggle={() => toggleCompare(o.offerId)}
          />
        ))}
      </section>

      {/* Similar products */}
      {detail && detail.alternatives.length > 0 && (
        <section id="similar" className="space-y-2">
          <h2 className="text-lg font-extrabold">محصولات مشابه</h2>
          <p className="text-xs text-stone-500">همان دسته، با قیمت نزدیک — اگر این مدل در دسترس نبود.</p>
          {detail.alternatives.map((a) => (
            <ProductCard key={a.id} p={a} compact />
          ))}
        </section>
      )}

      {compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <span className="text-sm">{fa(compareIds.length)} فروشگاه انتخاب شده</span>
            <Button className="mr-auto" disabled={compareIds.length < 2} onClick={() => setCompareOpen(true)}>
              ⚖️ مقایسه فروشگاه‌ها
            </Button>
            <Button variant="ghost" onClick={() => setCompareIds([])}>
              لغو
            </Button>
          </div>
        </div>
      )}

      <Sheet open={compareOpen} onClose={() => setCompareOpen(false)} title="مقایسه فروشگاه‌ها">
        <ShopCompare offers={offers.filter((o) => compareIds.includes(o.offerId))} isNow={shops?.visitTime.isNow ?? true} contacts={contacts} />
      </Sheet>

      <ShopSheet
        offer={selected}
        productId={id}
        productTitle={p?.title ?? shops?.product.title ?? ""}
        visitDay={shops?.visitTime.day ?? "sat"}
        isNow={shops?.visitTime.isNow ?? true}
        onClose={() => setSelected(null)}
        onFindAlternative={onFindAlternative}
      />
      <LocationPicker open={locOpen} onClose={() => setLocOpen(false)} />
    </div>
  );
}

function ShopCompare({ offers, isNow, contacts }: { offers: ShopOffer[]; isNow: boolean; contacts: Record<string, { status: ContactStatus; newPrice: number | null }> }) {
  if (offers.length < 2) return <p className="text-sm">حداقل دو فروشگاه انتخاب کن.</p>;
  const cheapest = Math.min(...offers.map((o) => contacts[o.offerId]?.newPrice ?? o.price ?? Infinity));
  const nearest = Math.min(...offers.map((o) => o.distanceKm ?? Infinity));
  const rows: { label: string; render: (o: ShopOffer) => React.ReactNode }[] = [
    {
      label: "قیمت",
      render: (o) => {
        const c = contacts[o.offerId];
        const v = c?.newPrice ?? o.price;
        return (
          <span className={v === cheapest ? "font-extrabold text-emerald-700" : ""}>
            {toman(v)}
            <span className="block text-[10px] font-normal text-stone-500">{c?.newPrice ? "اعلام فروشنده (شبیه‌سازی)" : `ثبت‌شده · ${ago(o.lastChanged)}`}</span>
          </span>
        );
      },
    },
    { label: "فاصله", render: (o) => <span className={o.distanceKm === nearest ? "font-extrabold text-emerald-700" : ""}>{km(o.distanceKm)}</span> },
    { label: "ساعت (اعلامی)", render: (o) => <OpenBadge state={o.openState} isNow={isNow} /> },
    { label: "قسطی", render: (o) => <PaymentBadges shop={o.shop} /> },
    { label: "آدرس داخل پاساژ", render: (o) => [o.shop.mall, o.shop.floor, o.shop.unit].filter(Boolean).join("، ") || "ثبت نشده" },
    { label: "گارانتی", render: (o) => o.warranty ?? "ثبت نشده" },
    { label: "پیگیری", render: (o) => (contacts[o.offerId] ? STATUS_FA[contacts[o.offerId].status].label : "پرسیده نشده") },
    { label: "به‌روزرسانی قیمت", render: (o) => faDate(o.lastChanged) },
    { label: "نام", render: (o) => <NameBadge shop={o.shop} /> },
  ];
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[420px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky right-0 bg-white" />
            {offers.map((o) => (
              <th key={o.offerId} className="p-2 text-right align-bottom font-bold">
                {o.shop.name}
                <span className="block text-[11px] font-normal text-stone-500">{o.shop.area}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="even:bg-stone-50">
              <th scope="row" className="sticky right-0 bg-inherit p-2 text-right font-medium text-stone-500">
                {r.label}
              </th>
              {offers.map((o) => (
                <td key={o.offerId} className="p-2 align-top">
                  {r.render(o)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-stone-500">سبز = بهترین در آن ردیف. قیمت‌ها ثبت‌شده‌اند و موجودی تأیید نشده، مگر با پیگیری.</p>
    </div>
  );
}
