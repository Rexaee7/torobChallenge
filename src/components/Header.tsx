"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/client/store";
import { LocationPicker } from "./LocationPicker";
import { fa } from "@/lib/format";

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

const STEPS = [
  { n: 1, label: "انتخاب محصول" },
  { n: 2, label: "فروشگاه‌های نزدیک" },
  { n: 3, label: "مقایسه" },
  { n: 4, label: "پیگیری و مراجعه" },
];

function stepFor(path: string): number {
  if (path.startsWith("/plan")) return 4;
  if (path.startsWith("/p/")) return 2;
  if (path.startsWith("/compare")) return 1;
  return 1;
}

export function Header() {
  const path = usePathname();
  const hydrated = useHydrated();
  const location = useApp((s) => s.location);
  const radius = useApp((s) => s.radiusKm);
  const planCount = useApp((s) => s.plan.length);
  const [open, setOpen] = useState(false);
  const step = stepFor(path);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#f6f5f2]/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-teal-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-700 text-sm text-white" aria-hidden>
            هـ
          </span>
          <span className="hidden text-base sm:inline">همراه خرید</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="mr-auto flex min-w-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-stone-200 hover:ring-teal-500"
          aria-label="تغییر موقعیت"
        >
          <span aria-hidden>📍</span>
          <span className="truncate">
            {hydrated && location ? (
              <>
                {location.label} <span className="text-stone-400">·</span> {fa(radius)} کیلومتر
              </>
            ) : (
              <span className="text-stone-500">موقعیتت کجاست؟</span>
            )}
          </span>
        </button>
        <Link href="/plan" className="relative flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-stone-200 hover:ring-teal-500">
          <span aria-hidden>🗒️</span>
          <span className="hidden sm:inline">برنامه خرید</span>
          {hydrated && planCount > 0 && (
            <span className="rounded-full bg-teal-700 px-1.5 text-[11px] font-bold text-white" aria-label={`${planCount} فروشگاه در برنامه`}>
              {fa(planCount)}
            </span>
          )}
        </Link>
      </div>
      <nav aria-label="مراحل خرید" className="mx-auto max-w-3xl px-4 pb-2">
        <ol className="no-scrollbar flex gap-1.5 overflow-x-auto text-[11px]">
          {STEPS.map((s) => (
            <li
              key={s.n}
              aria-current={s.n === step ? "step" : undefined}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 ${
                s.n === step ? "bg-teal-700 text-white" : s.n < step ? "bg-teal-100 text-teal-800" : "bg-stone-200/60 text-stone-500"
              }`}
            >
              <span className="font-bold">{fa(s.n)}</span> {s.label}
            </li>
          ))}
        </ol>
      </nav>
      <LocationPicker open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
