"use client";
import Link from "next/link";
import type { ProductSummary } from "@/lib/types";
import { useApp } from "@/lib/client/store";
import { Badge, Img } from "./ui";
import { ago, fa, km, tomanShort } from "@/lib/format";
import { useHydrated } from "./Header";

export function PriceRange({ min, max }: { min: number | null; max: number | null }) {
  if (min == null) return <span className="text-sm text-stone-500">قیمت ثبت نشده</span>;
  return (
    <span className="text-[15px] font-extrabold text-stone-900">
      {min === max || max == null ? tomanShort(min) : `${tomanShort(min)} تا ${tomanShort(max)}`}
      <span className="mr-1 text-[11px] font-normal text-stone-500">تومان</span>
    </span>
  );
}

export function ProductCard({ p, compact }: { p: ProductSummary; compact?: boolean }) {
  const hydrated = useHydrated();
  const inList = useApp((s) => s.shortlist.some((x) => x.id === p.id));
  const toggle = useApp((s) => s.toggleShortlist);
  const listFull = useApp((s) => s.shortlist.length >= 4);

  return (
    <article className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70">
      <Link href={`/p/${p.id}`} className="shrink-0" aria-label={p.title}>
        <Img src={p.image} alt={p.title} className="h-24 w-24 rounded-xl ring-1 ring-stone-100" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/p/${p.id}`} className="line-clamp-2 text-sm font-bold leading-6 text-stone-900 hover:text-teal-800">
          {p.title}
        </Link>
        <div className="text-[11px] text-stone-500">
          {[p.brand, p.category].filter(Boolean).join(" · ") || "برند/دسته ثبت نشده"}
        </div>
        {!compact && p.keySpecs.length > 0 && (
          <div className="line-clamp-1 text-[11px] text-stone-600">{p.keySpecs.map(([k, v]) => `${k}: ${v}`).join(" | ")}</div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <PriceRange min={p.minPrice} max={p.maxPrice} />
          <Badge tone="neutral" icon={false} title="قیمت ثبت‌شده در دیتاست ترب؛ لحظه‌ای نیست">
            قیمت ثبت‌شده · {ago(p.lastChanged)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {p.nearbyShopCount != null ? (
            p.nearbyShopCount > 0 ? (
              <Badge tone="ok">
                {fa(p.nearbyShopCount)} فروشنده در محدوده · نزدیک‌ترین {km(p.nearestKm)}
              </Badge>
            ) : (
              <Badge tone="warn">در محدوده‌ات فروشنده‌ای نیست</Badge>
            )
          ) : (
            <Badge tone="info">{fa(p.shopCount)} فروشگاه حضوری</Badge>
          )}
          {p.reasons
            .filter((r) => !r.includes("فروشنده"))
            .slice(0, 2)
            .map((r) => (
              <Badge key={r} tone="brand">
                {r}
              </Badge>
            ))}
        </div>
        <div className="mt-1 flex gap-2">
          <Link href={`/p/${p.id}`} className="inline-flex min-h-9 items-center rounded-xl bg-teal-700 px-3 text-xs font-bold text-white hover:bg-teal-800">
            دیدن فروشگاه‌ها ←
          </Link>
          <button
            onClick={() => toggle(p)}
            disabled={hydrated && !inList && listFull}
            aria-pressed={hydrated && inList}
            className={`inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold ring-1 ring-inset disabled:opacity-40 ${
              hydrated && inList ? "bg-teal-50 text-teal-800 ring-teal-300" : "text-stone-700 ring-stone-300 hover:bg-stone-50"
            }`}
          >
            {hydrated && inList ? "✓ در مقایسه" : "+ مقایسه"}
          </button>
        </div>
      </div>
    </article>
  );
}
