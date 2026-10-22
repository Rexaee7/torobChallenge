"use client";
import type { OpenState } from "@/lib/parsers";
import { DAY_FA, DAY_KEYS, describeDay, fmtMin, type DayKey } from "@/lib/parsers";
import type { ShopInfo } from "@/lib/types";
import { Badge } from "./ui";
import { fa } from "@/lib/format";

export function OpenBadge({ state, isNow = true }: { state: OpenState; isNow?: boolean }) {
  if (state === "open") return <Badge tone="ok" title="بر اساس ساعت اعلامی فروشگاه؛ تضمین لحظه‌ای نیست">{isNow ? "طبق ساعت اعلامی باز" : "در زمان مراجعه باز (اعلامی)"}</Badge>;
  if (state === "closed") return <Badge tone="bad" title="بر اساس ساعت اعلامی فروشگاه">{isNow ? "طبق ساعت اعلامی بسته" : "در زمان مراجعه بسته"}</Badge>;
  return <Badge tone="neutral" title="فروشگاه ساعت کاری ثبت نکرده">ساعت کاری ثبت نشده</Badge>;
}

export function PaymentBadges({ shop }: { shop: ShopInfo }) {
  if (!shop.payments.length) return <Badge tone="neutral" title="در دیتاست اطلاعاتی ثبت نشده — به معنی نداشتن نیست">قسطی: ثبت نشده</Badge>;
  return (
    <>
      {shop.payments.map((p) => (
        <Badge key={p.provider} tone="info" title={p.inPerson ? "پذیرش حضوری به‌صراحت ثبت شده" : "کانال پرداخت مشخص نشده"}>
          قسطی: {p.provider}
          {p.inPerson ? " (حضوری)" : ""}
        </Badge>
      ))}
    </>
  );
}

export function NameBadge({ shop }: { shop: ShopInfo }) {
  return shop.nameVerified ? (
    <Badge tone="ok" title="این فروشگاه وب‌سایت یا اینستاگرام ثبت‌شده دارد">نام تأییدشده</Badge>
  ) : (
    <Badge tone="neutral" icon={false} title="طبق توضیحات چالش، نام بیشتر فروشگاه‌ها در دیتاست نمایشی است">
      نام نمایشی
    </Badge>
  );
}

export function AddressBlock({ shop }: { shop: ShopInfo }) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="leading-7 text-stone-800">{shop.address ?? "آدرس ثبت نشده"}</div>
      <div className="flex flex-wrap gap-1.5">
        {shop.mall && <Badge tone="brand" icon={false}>🏬 {shop.mall}</Badge>}
        {shop.floor && <Badge tone="brand" icon={false}>⬆️ {shop.floor}</Badge>}
        {shop.unit && <Badge tone="brand" icon={false}>🚪 {shop.unit}</Badge>}
        {shop.mall && !shop.unit && <Badge tone="warn">واحد/پلاک داخل پاساژ ثبت نشده</Badge>}
      </div>
    </div>
  );
}

export function HoursTable({ shop, highlight }: { shop: ShopInfo; highlight?: DayKey }) {
  if (!shop.hours) return <p className="text-sm text-stone-500">این فروشگاه ساعت کاری ثبت نکرده است. قبل از رفتن بپرس.</p>;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">ساعت کاری اعلامی</caption>
      <tbody>
        {DAY_KEYS.map((d) => (
          <tr key={d} className={d === highlight ? "bg-teal-50 font-bold" : ""}>
            <th scope="row" className="py-1 pr-2 text-right font-medium text-stone-600">
              {DAY_FA[d]}
            </th>
            <td className="py-1 text-stone-800">{fa(describeDay(shop.hours![d]))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function visitLabel(day: string, minute: number) {
  return `${DAY_FA[day as DayKey] ?? day} ساعت ${fa(fmtMin(minute))}`;
}
