"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProductDetail } from "@/lib/types";
import { getJson } from "@/lib/client/useMeta";
import { useApp } from "@/lib/client/store";
import { Badge, Img, Notice, Skeleton } from "./ui";
import { ago, fa, tomanShort } from "@/lib/format";

export function CompareView() {
  const ids = (useSearchParams().get("ids") ?? "").split(",").filter(Boolean).slice(0, 4);
  const [products, setProducts] = useState<ProductDetail[] | null>(null);
  const [error, setError] = useState(false);
  const [onlyDiff, setOnlyDiff] = useState(true);
  const maxPrice = useApp((s) => s.maxPrice);
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    getJson<{ products: ProductDetail[] }>(`/api/compare?ids=${key}`)
      .then((d) => setProducts(d.products))
      .catch(() => setError(true));
  }, [key]);

  const specRows = useMemo(() => {
    if (!products) return [];
    const keys: string[] = [];
    for (const p of products) for (const [k] of p.specs) if (!keys.includes(k)) keys.push(k);
    return keys
      .map((k) => ({ k, vals: products.map((p) => p.specs.find(([kk]) => kk === k)?.[1] ?? null) }))
      .filter((r) => r.vals.filter(Boolean).length >= 2 || products.length === 1)
      .map((r) => ({ ...r, differs: new Set(r.vals.map((v) => v ?? "—")).size > 1 }));
  }, [products]);

  if (ids.length < 2)
    return (
      <div className="space-y-3 pt-4">
        <Notice tone="info">برای مقایسه، از نتایج دستیار روی «+ مقایسه» حداقل دو محصول بزن.</Notice>
        <Link href="/" className="text-sm text-teal-800 underline">
          بازگشت به دستیار
        </Link>
      </div>
    );
  if (error) return <Notice tone="bad">مقایسه بارگذاری نشد. دوباره تلاش کن.</Notice>;
  if (!products) return <Skeleton className="mt-4 h-80" />;

  const cheapest = Math.min(...products.map((p) => p.minPrice ?? Infinity));
  const mostSellers = Math.max(...products.map((p) => p.shopCount));
  const rows = onlyDiff ? specRows.filter((r) => r.differs) : specRows;

  // Trade-off summary — distinct, explained winners instead of one "best".
  const summary = [
    { label: "کمترین قیمت ثبت‌شده", p: products.find((p) => p.minPrice === cheapest) },
    { label: "بیشترین فروشنده حضوری", p: products.find((p) => p.shopCount === mostSellers) },
  ];

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-block text-sm text-teal-800">
        → بازگشت به دستیار
      </Link>
      <h1 className="text-xl font-extrabold">مقایسه محصولات</h1>

      <div className="grid gap-2 sm:grid-cols-2">
        {summary.map(
          (s) =>
            s.p && (
              <div key={s.label} className="rounded-2xl bg-teal-50 p-3 text-sm ring-1 ring-teal-100">
                <div className="text-[11px] text-teal-800">{s.label}</div>
                <div className="line-clamp-1 font-bold">{s.p.title}</div>
              </div>
            ),
        )}
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="sticky right-0 z-10 w-28 bg-[#f6f5f2]" />
              {products.map((p) => (
                <th key={p.id} className="p-2 text-right align-top font-normal">
                  <Img src={p.image} alt={p.title} className="mb-1 h-20 w-20 rounded-xl ring-1 ring-stone-200" />
                  <Link href={`/p/${p.id}`} className="line-clamp-3 font-bold leading-6 text-stone-900 hover:text-teal-800">
                    {p.title}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <th scope="row" className="sticky right-0 bg-white p-2 text-right font-medium text-stone-500">
                قیمت ثبت‌شده
              </th>
              {products.map((p) => (
                <td key={p.id} className="p-2">
                  <b className={p.minPrice === cheapest ? "text-emerald-700" : ""}>
                    {p.minPrice === p.maxPrice ? tomanShort(p.minPrice) : `${tomanShort(p.minPrice)} – ${tomanShort(p.maxPrice)}`}
                  </b>
                  <span className="block text-[10px] text-stone-500">{ago(p.lastChanged)}</span>
                  {maxPrice && p.minPrice != null && (p.minPrice <= maxPrice ? <Badge tone="ok">در بودجه</Badge> : <Badge tone="warn">بالاتر از بودجه</Badge>)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="sticky right-0 bg-[#f6f5f2] p-2 text-right font-medium text-stone-500">
                فروشگاه حضوری
              </th>
              {products.map((p) => (
                <td key={p.id} className={`p-2 ${p.shopCount === mostSellers ? "font-bold text-emerald-700" : ""}`}>
                  {fa(p.shopCount)}
                </td>
              ))}
            </tr>
            <tr className="bg-white">
              <th scope="row" className="sticky right-0 bg-white p-2 text-right font-medium text-stone-500">
                برند
              </th>
              {products.map((p) => (
                <td key={p.id} className="p-2">
                  {p.brand ?? "—"}
                </td>
              ))}
            </tr>
            {rows.map((r, i) => (
              <tr key={r.k} className={i % 2 ? "" : "bg-white"}>
                <th scope="row" className={`sticky right-0 p-2 text-right font-medium text-stone-500 ${i % 2 ? "bg-[#f6f5f2]" : "bg-white"}`}>
                  {r.k}
                </th>
                {r.vals.map((v, j) => (
                  <td key={j} className={`p-2 ${r.differs ? "text-stone-900" : "text-stone-500"}`}>
                    {v ?? <span className="text-stone-400">ثبت نشده</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="h-4 w-4 accent-teal-700" />
        فقط تفاوت‌ها را نشان بده ({fa(specRows.filter((r) => r.differs).length)} از {fa(specRows.length)} مشخصه)
      </label>
    </div>
  );
}
