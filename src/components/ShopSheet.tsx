"use client";
import { useState } from "react";
import type { ContactStatus, ShopOffer } from "@/lib/types";
import { mapLinks } from "@/lib/geo";
import { Badge, Sheet } from "./ui";
import { AddressBlock, HoursTable, NameBadge, OpenBadge, PaymentBadges } from "./ShopBits";
import { ContactPanel } from "./ContactPanel";
import { ago, faDate, km, toman } from "@/lib/format";
import type { DayKey } from "@/lib/parsers";

export function ShopSheet({
  offer,
  productId,
  productTitle,
  visitDay,
  isNow,
  onClose,
  onFindAlternative,
}: {
  offer: ShopOffer | null;
  productId: string;
  productTitle: string;
  visitDay: string;
  isNow: boolean;
  onClose: () => void;
  onFindAlternative: (o: ShopOffer, reason: ContactStatus | "CLOSED_HOURS") => void;
}) {
  const [tab, setTab] = useState<"contact" | "info">("contact");
  if (!offer) return null;
  const s = offer.shop;
  const links = s.lat != null && s.lon != null ? mapLinks(s.lat, s.lon) : null;
  const copyAddr = () => navigator.clipboard?.writeText([s.address, s.mall, s.floor, s.unit].filter(Boolean).join("، ")).catch(() => {});

  return (
    <Sheet open onClose={onClose} title={s.name ?? "فروشگاه"}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <NameBadge shop={s} />
          <OpenBadge state={offer.openState} isNow={isNow} />
          <Badge tone="neutral">{offer.distanceKm == null ? "فاصله نامشخص" : `≈ ${km(offer.distanceKm)} (خط مستقیم)`}</Badge>
        </div>

        <div className="rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200">
          <div className="text-xs text-stone-500">قیمت ثبت‌شده برای «{productTitle}»</div>
          <div className="text-lg font-extrabold">{toman(offer.price)}</div>
          <div className="text-[11px] text-stone-500">
            آخرین تغییر قیمت: {faDate(offer.lastChanged)} ({ago(offer.lastChanged)}) · موجودی تأیید نشده
          </div>
          {offer.sellerTitle && offer.sellerTitle !== productTitle && <div className="mt-1 text-[12px] text-stone-600">عنوان فروشنده: {offer.sellerTitle}</div>}
          {offer.warranty && <div className="mt-1 text-[12px] text-stone-600">گارانتی: {offer.warranty}</div>}
        </div>

        <div role="tablist" className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm">
          {(
            [
              ["contact", "💬 پیگیری از فروشنده"],
              ["info", "📍 آدرس و ساعت"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 font-semibold ${tab === k ? "bg-white shadow-sm" : "text-stone-500"}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === "contact" ? (
          <ContactPanel offer={offer} productId={productId} productTitle={productTitle} onFindAlternative={(r) => onFindAlternative(offer, r)} />
        ) : (
          <div className="space-y-4">
            <AddressBlock shop={s} />
            <div className="flex flex-wrap gap-2 text-sm">
              {links && (
                <>
                  <a className="rounded-xl bg-teal-700 px-3 py-2 font-bold text-white" href={links.neshan} target="_blank" rel="noopener noreferrer">
                    مسیریابی با نشان
                  </a>
                  <a className="rounded-xl px-3 py-2 font-bold text-teal-800 ring-1 ring-teal-300" href={links.balad} target="_blank" rel="noopener noreferrer">
                    بلد
                  </a>
                  <a className="rounded-xl px-3 py-2 font-bold text-teal-800 ring-1 ring-teal-300" href={links.google} target="_blank" rel="noopener noreferrer">
                    گوگل‌مپ
                  </a>
                </>
              )}
              <button className="rounded-xl px-3 py-2 font-bold text-stone-700 ring-1 ring-stone-300" onClick={copyAddr}>
                کپی آدرس
              </button>
            </div>
            {s.mall && (
              <p className="text-[12px] leading-6 text-stone-500">
                مسیریابی تا درِ {s.mall} است؛ برای پیدا کردن مغازه داخل پاساژ، از تب «پیگیری» گزینهٔ «طبقه و واحد دقیق» را بپرس.
              </p>
            )}
            <div>
              <div className="mb-1 text-sm font-semibold">ساعت کاری اعلامی</div>
              <HoursTable shop={s} highlight={visitDay as DayKey} />
              <p className="mt-1 text-[11px] text-stone-500">ساعت‌ها اعلامی فروشگاه‌اند و تضمین باز بودن لحظه‌ای نیستند.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <PaymentBadges shop={s} />
              {s.fastDelivery && <Badge tone="neutral">ارسال فوری</Badge>}
            </div>
            {s.categories.length > 0 && (
              <div className="text-[12px] text-stone-500">
                دسته‌های فعالیت: {s.categories.slice(0, 6).join("، ")}
                <div className="text-[11px]">(دسته فعالیت به‌تنهایی نشانهٔ موجود بودن یک کالا نیست.)</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
