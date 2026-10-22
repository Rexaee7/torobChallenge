"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp, type PlanItem } from "@/lib/client/store";
import { haversineKm, mapLinks } from "@/lib/geo";
import { STATUS_FA } from "@/lib/contact";
import { declaredOpenAt, tehranNow } from "@/lib/parsers";
import { useHydrated } from "./Header";
import { Badge, Button, Notice } from "./ui";
import { OpenBadge } from "./ShopBits";
import { fa, km, toman } from "@/lib/format";

/** Greedy nearest-neighbour ordering from the user's location — good enough for 2-8 stops. */
function orderStops(items: PlanItem[], start: { lat: number; lon: number } | null) {
  const withCoords = items.filter((i) => i.offer.shop.lat != null);
  const rest = items.filter((i) => i.offer.shop.lat == null);
  if (!start || withCoords.length < 2) return { ordered: [...withCoords, ...rest], legs: [] as number[] };
  const left = [...withCoords];
  const ordered: PlanItem[] = [];
  const legs: number[] = [];
  let cur = start;
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((it, i) => {
      const d = haversineKm(cur.lat, cur.lon, it.offer.shop.lat!, it.offer.shop.lon!);
      if (d < bd) (bd = d), (bi = i);
    });
    const [n] = left.splice(bi, 1);
    ordered.push(n);
    legs.push(bd);
    cur = { lat: n.offer.shop.lat!, lon: n.offer.shop.lon! };
  }
  return { ordered: [...ordered, ...rest], legs };
}

export function PlanView() {
  const hydrated = useHydrated();
  const { plan, contacts, location, removePlan } = useApp();
  const [copied, setCopied] = useState(false);
  const items = hydrated ? plan : [];
  const { ordered, legs } = useMemo(() => orderStops(items, location), [items, location]);
  const now = tehranNow();

  const checklist = useMemo(
    () =>
      ordered
        .map((it, i) => {
          const s = it.offer.shop;
          const c = contacts[it.offer.offerId];
          return [
            `${fa(i + 1)}. ${s.name ?? "فروشگاه"} — ${it.productTitle}`,
            `   آدرس: ${[s.address, s.mall, s.floor, s.unit].filter(Boolean).join("، ")}`,
            `   قیمت: ${toman(c?.newPrice ?? it.offer.price)}${c ? ` (${STATUS_FA[c.status].label}، شبیه‌سازی)` : " (ثبت‌شده، تأیید نشده)"}`,
          ].join("\n");
        })
        .join("\n\n"),
    [ordered, contacts],
  );

  if (!hydrated) return null;
  if (!items.length)
    return (
      <div className="space-y-4 pt-4">
        <h1 className="text-xl font-extrabold">برنامه خرید حضوری</h1>
        <Notice tone="info">هنوز فروشگاهی اضافه نکرده‌ای. در صفحه هر محصول روی «+ برنامه خرید» بزن تا مسیر مراجعه و چک‌لیست اینجا ساخته شود.</Notice>
        <Link href="/" className="text-sm text-teal-800 underline">
          شروع از دستیار
        </Link>
      </div>
    );

  const total = legs.reduce((a, b) => a + b, 0);
  const pending = ordered.filter((i) => !contacts[i.offer.offerId]);
  const bad = ordered.filter((i) => ["OUT_OF_STOCK", "NO_RESPONSE", "CLOSED"].includes(contacts[i.offer.offerId]?.status ?? ""));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">برنامه خرید حضوری</h1>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <div className="text-lg font-extrabold">{fa(ordered.length)}</div>
          <div className="text-[11px] text-stone-500">توقف</div>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <div className="text-lg font-extrabold">{location && legs.length ? km(total) : "—"}</div>
          <div className="text-[11px] text-stone-500">مسیر تقریبی (خط مستقیم)</div>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <div className="text-lg font-extrabold">{fa(ordered.length - pending.length)}</div>
          <div className="text-[11px] text-stone-500">پیگیری‌شده</div>
        </div>
      </div>

      {pending.length > 0 && <Notice tone="warn">{fa(pending.length)} فروشگاه هنوز پیگیری نشده‌اند. قبل از رفتن، موجودی و قیمت را بپرس.</Notice>}
      {bad.length > 0 && <Notice tone="bad">{fa(bad.length)} فروشگاه پاسخ منفی داده‌اند یا جواب نداده‌اند — از صفحه محصول جایگزین بگیر.</Notice>}
      {!location && <Notice tone="info">موقعیتت را از بالای صفحه انتخاب کن تا ترتیب بهینهٔ مراجعه محاسبه شود.</Notice>}

      <ol className="space-y-3">
        {ordered.map((it, i) => {
          const s = it.offer.shop;
          const c = contacts[it.offer.offerId];
          const links = s.lat != null && s.lon != null ? mapLinks(s.lat, s.lon) : null;
          return (
            <li key={it.key} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">{fa(i + 1)}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-bold">{s.name}</div>
                  <Link href={`/p/${it.productId}`} className="line-clamp-1 text-[12px] text-teal-800">
                    {it.productTitle}
                  </Link>
                  <div className="text-[12px] text-stone-600">{[s.address, s.mall, s.floor, s.unit].filter(Boolean).join("، ")}</div>
                  <div className="flex flex-wrap gap-1">
                    {legs[i] != null && <Badge tone="neutral">{i === 0 ? "از موقعیت تو" : "از توقف قبلی"} ≈ {km(legs[i])}</Badge>}
                    <OpenBadge state={declaredOpenAt(s.hours, now.day, now.minute)} />
                    <Badge tone="neutral" icon={false}>
                      {toman(c?.newPrice ?? it.offer.price)}
                    </Badge>
                    {c ? <Badge tone={STATUS_FA[c.status].tone}>{STATUS_FA[c.status].label} (شبیه‌سازی)</Badge> : <Badge tone="warn">پیگیری نشده</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1 text-[12px]">
                    {links && (
                      <a href={links.neshan} target="_blank" rel="noopener noreferrer" className="font-bold text-teal-800">
                        مسیریابی ←
                      </a>
                    )}
                    <Link href={`/p/${it.productId}`} className="text-stone-600 underline">
                      پیگیری / جایگزین
                    </Link>
                    <button onClick={() => removePlan(it.key)} className="text-rose-700">
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <Button
        variant="secondary"
        full
        onClick={() =>
          navigator.clipboard
            ?.writeText(checklist)
            .then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))
            .catch(() => {})
        }
      >
        {copied ? "چک‌لیست کپی شد ✓" : "📋 کپی چک‌لیست خرید"}
      </Button>
    </div>
  );
}
