"use client";
import type { ShopOffer } from "@/lib/types";
import { useApp } from "@/lib/client/store";
import { STATUS_FA } from "@/lib/contact";
import { Badge } from "./ui";
import { NameBadge, OpenBadge, PaymentBadges } from "./ShopBits";
import { ago, km, toman } from "@/lib/format";
import { useHydrated } from "./Header";

export function OfferCard({
  o,
  productId,
  productTitle,
  isNow,
  onOpen,
  compareSelected,
  onCompareToggle,
}: {
  o: ShopOffer;
  productId: string;
  productTitle: string;
  isNow: boolean;
  onOpen: () => void;
  compareSelected?: boolean;
  onCompareToggle?: () => void;
}) {
  const hydrated = useHydrated();
  const inPlan = useApp((s) => s.plan.some((p) => p.key === `${productId}:${o.offerId}`));
  const togglePlan = useApp((s) => s.togglePlan);
  const contact = useApp((s) => s.contacts[o.offerId]);
  const c = hydrated ? contact : undefined;

  return (
    <article className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 text-right">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-bold text-stone-900">{o.shop.name ?? "فروشگاه بدون نام"}</h3>
            <NameBadge shop={o.shop} />
          </div>
          <div className="mt-0.5 line-clamp-1 text-[12px] text-stone-500">
            {o.shop.area ? `${o.shop.area} · ` : ""}
            {o.shop.mall ?? o.shop.address ?? "آدرس ثبت نشده"}
            {o.shop.floor ? ` · ${o.shop.floor}` : ""}
          </div>
        </button>
        <div className="shrink-0 text-left">
          <div className="text-[15px] font-extrabold text-stone-900">{toman(c?.newPrice ?? o.price)}</div>
          {c?.newPrice ? (
            <div className="text-[11px] text-stone-400 line-through">{toman(o.price)}</div>
          ) : (
            <div className="text-[11px] text-stone-500">ثبت‌شده · {ago(o.lastChanged)}</div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge tone={o.distanceKm == null ? "neutral" : o.distanceKm < 3 ? "ok" : "neutral"} title="فاصله خط مستقیم">
          {o.distanceKm == null ? "فاصله نامشخص" : `≈ ${km(o.distanceKm)}`}
        </Badge>
        <OpenBadge state={o.openState} isNow={isNow} />
        <PaymentBadges shop={o.shop} />
        {c ? (
          <Badge tone={STATUS_FA[c.status].tone}>پاسخ (شبیه‌سازی): {STATUS_FA[c.status].label}</Badge>
        ) : (
          <Badge tone="warn" title="وجود آفر در دیتاست به معنی موجود بودن کالا نیست">موجودی تأیید نشده</Badge>
        )}
        {o.warranty && <Badge tone="neutral" icon={false}>🛡️ {o.warranty}</Badge>}
      </div>

      {o.reasons.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-teal-800">
          {o.reasons.slice(0, 3).map((r) => (
            <li key={r}>✓ {r}</li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button onClick={onOpen} className="inline-flex min-h-9 items-center rounded-xl bg-teal-700 px-3 text-xs font-bold text-white hover:bg-teal-800">
          {c ? "جزئیات و پاسخ" : "💬 پرسیدن از فروشنده"}
        </button>
        <button
          onClick={() => togglePlan({ productId, productTitle, offer: o })}
          aria-pressed={hydrated && inPlan}
          className={`inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold ring-1 ring-inset ${
            hydrated && inPlan ? "bg-teal-50 text-teal-800 ring-teal-300" : "text-stone-700 ring-stone-300 hover:bg-stone-50"
          }`}
        >
          {hydrated && inPlan ? "✓ در برنامه خرید" : "+ برنامه خرید"}
        </button>
        {onCompareToggle && (
          <button
            onClick={onCompareToggle}
            aria-pressed={compareSelected}
            className={`inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold ring-1 ring-inset ${
              compareSelected ? "bg-amber-50 text-amber-800 ring-amber-300" : "text-stone-700 ring-stone-300 hover:bg-stone-50"
            }`}
          >
            {compareSelected ? "✓ انتخاب برای مقایسه" : "⚖️ مقایسه"}
          </button>
        )}
      </div>
    </article>
  );
}
