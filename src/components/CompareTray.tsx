"use client";
import Link from "next/link";
import { useApp } from "@/lib/client/store";
import { useHydrated } from "./Header";
import { fa } from "@/lib/format";

export function CompareTray() {
  const hydrated = useHydrated();
  const list = useApp((s) => s.shortlist);
  const toggle = useApp((s) => s.toggleShortlist);
  const clear = useApp((s) => s.clearShortlist);
  if (!hydrated || list.length === 0) return null;
  return (
    <div className="sticky bottom-24 z-20 rounded-2xl bg-stone-900 p-3 text-white shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold">⚖️ لیست مقایسه ({fa(list.length)} از ۴)</div>
        <button onClick={clear} className="text-[11px] text-stone-300 underline">
          پاک کردن
        </button>
      </div>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {list.map((p) => (
          <button key={p.id} onClick={() => toggle(p)} className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px]" aria-label={`حذف ${p.title} از مقایسه`}>
            {p.title.slice(0, 24)}… ✕
          </button>
        ))}
      </div>
      <Link
        href={`/compare?ids=${list.map((p) => p.id).join(",")}`}
        aria-disabled={list.length < 2}
        className={`mt-2 block rounded-xl py-2 text-center text-sm font-bold ${list.length < 2 ? "pointer-events-none bg-white/20 text-white/60" : "bg-white text-stone-900"}`}
      >
        {list.length < 2 ? "حداقل ۲ محصول انتخاب کن" : "مقایسه کن ←"}
      </Link>
    </div>
  );
}
