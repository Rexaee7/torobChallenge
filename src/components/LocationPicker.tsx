"use client";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/client/store";
import { Button, Chip, Notice, Sheet } from "./ui";
import { normalizeFa } from "@/lib/normalize";
import { fa } from "@/lib/format";
import { useMeta } from "@/lib/client/useMeta";

export const RADII = [1, 3, 5, 10, 20];

export function LocationPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { location, radiusKm, setLocation, setRadius } = useApp();
  const meta = useMeta();
  const [q, setQ] = useState("");
  const [gpsState, setGps] = useState<"idle" | "loading" | "denied" | "outside">("idle");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const list = useMemo(() => {
    const all = meta?.neighborhoods ?? [];
    const n = normalizeFa(q);
    return (n ? all.filter((a) => normalizeFa(a.label).includes(n)) : all).slice(0, 40);
  }, [meta, q]);

  const useGps = () => {
    if (!navigator.geolocation) return setGps("denied");
    setGps("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const { latitude: lat, longitude: lon } = p.coords;
        if (lat < 35.4 || lat > 36 || lon < 50.9 || lon > 51.9) return setGps("outside");
        setLocation({ lat, lon, label: "موقعیت فعلی من", source: "gps" });
        setGps("idle");
        onClose();
      },
      () => setGps("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title="موقعیت و محدوده جست‌وجو">
      <div className="space-y-4">
        <Button full onClick={useGps} disabled={gpsState === "loading"}>
          {gpsState === "loading" ? "در حال دریافت موقعیت…" : "📍 استفاده از موقعیت فعلی (GPS)"}
        </Button>
        {gpsState === "denied" && <Notice tone="warn">دسترسی به موقعیت داده نشد. اشکالی ندارد — محله‌ات را از فهرست زیر انتخاب کن.</Notice>}
        {gpsState === "outside" && <Notice tone="warn">موقعیتت خارج از تهران است؛ دیتاست فقط فروشگاه‌های تهران را دارد. یک محله انتخاب کن.</Notice>}

        <div>
          <div className="mb-2 text-sm font-semibold text-stone-700">شعاع جست‌وجو</div>
          <div className="flex flex-wrap gap-2">
            {RADII.map((r) => (
              <Chip key={r} active={radiusKm === r} onClick={() => setRadius(r)}>
                {fa(r)} کیلومتر
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-stone-500">فاصله‌ها خط مستقیم و تقریبی‌اند، نه مسیر رانندگی.</p>
        </div>

        <div>
          <label htmlFor="area-q" className="mb-2 block text-sm font-semibold text-stone-700">
            یا محله / خیابان را انتخاب کن
          </label>
          <input
            id="area-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="مثلاً ونک، جمهوری، تجریش…"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
          <ul className="mt-2 max-h-64 divide-y divide-stone-100 overflow-y-auto rounded-xl ring-1 ring-stone-200">
            {!meta && <li className="p-3 text-sm text-stone-500">در حال بارگذاری محله‌ها…</li>}
            {meta && list.length === 0 && <li className="p-3 text-sm text-stone-500">محله‌ای با این نام در دیتاست نیست.</li>}
            {list.map((a) => (
              <li key={a.label}>
                <button
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-right text-sm hover:bg-teal-50 ${location?.label === a.label ? "bg-teal-50 font-bold text-teal-800" : ""}`}
                  onClick={() => {
                    setLocation({ lat: a.lat, lon: a.lon, label: a.label, source: "area" });
                    onClose();
                  }}
                >
                  <span>{a.label}</span>
                  <span className="text-[11px] text-stone-400">{fa(a.shopCount)} فروشگاه</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {location && (
          <button className="text-xs text-rose-700 underline" onClick={() => (setLocation(null), onClose())}>
            حذف موقعیت (نمایش همه فروشگاه‌های تهران)
          </button>
        )}
      </div>
    </Sheet>
  );
}
