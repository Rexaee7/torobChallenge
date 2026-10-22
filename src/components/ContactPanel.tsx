"use client";
import { useEffect, useState } from "react";
import type { ContactStatus, ShopOffer } from "@/lib/types";
import { ASK_LABELS, STATUS_FA, composeMessage, simulateReply, type Ask } from "@/lib/contact";
import { useApp } from "@/lib/client/store";
import { Badge, Button, Chip, Notice } from "./ui";
import { faTime, toman } from "@/lib/format";

const DEFAULT_ASKS: Ask[] = ["price", "stock", "hours"];
const FORCE_OPTIONS: { v: ContactStatus | "auto"; label: string }[] = [
  { v: "auto", label: "خودکار" },
  { v: "CONFIRMED", label: "تأیید" },
  { v: "PRICE_CHANGED", label: "تغییر قیمت" },
  { v: "OUT_OF_STOCK", label: "ناموجود" },
  { v: "NO_RESPONSE", label: "بی‌پاسخ" },
  { v: "CLOSED", label: "تعطیل" },
];

export function ContactPanel({
  offer,
  productId,
  productTitle,
  onFindAlternative,
}: {
  offer: ShopOffer;
  productId: string;
  productTitle: string;
  onFindAlternative?: (reason: ContactStatus) => void;
}) {
  const existing = useApp((s) => s.contacts[offer.offerId]);
  const setContact = useApp((s) => s.setContact);
  const installment = useApp((s) => s.installment);
  const [asks, setAsks] = useState<Ask[]>(() => {
    const a = [...DEFAULT_ASKS];
    if (offer.shop.mall) a.push("location");
    if (installment) a.push("installment");
    return a;
  });
  const [force, setForce] = useState<ContactStatus | "auto">("auto");
  const [phase, setPhase] = useState<"compose" | "sending" | "waiting" | "done">(existing ? "done" : "compose");
  const [copied, setCopied] = useState(false);

  useEffect(() => setPhase(existing ? "done" : "compose"), [offer.offerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const msg = composeMessage({ shopName: offer.shop.name, productTitle, price: offer.price, asks });
  const toggle = (a: Ask) => setAsks((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]));

  const send = () => {
    setPhase("sending");
    setTimeout(() => setPhase("waiting"), 700);
    setTimeout(() => {
      const r = simulateReply({
        shopName: offer.shop.name,
        productTitle,
        price: offer.price,
        asks,
        hasMall: !!offer.shop.mall,
        unitKnown: !!offer.shop.unit,
        force: force === "auto" ? undefined : force,
        seed: `${productId}:${offer.offerId}`,
      });
      setContact(offer.offerId, r);
      setPhase("done");
    }, 1900);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section aria-label="پیگیری از فروشنده" className="space-y-3">
      <Notice tone="warn">
        <b>شبیه‌سازی؛ پیام واقعی ارسال نمی‌شود.</b> شماره‌های دیتاست ساختگی‌اند، پس پاسخ‌ها نمونهٔ نمایشی هستند. در نسخهٔ واقعی این پیام از طریق واتس‌اپ/بله/تماس خودکار ارسال می‌شود.
      </Notice>

      {phase === "compose" && (
        <>
          <div>
            <div className="mb-1.5 text-sm font-semibold">چه چیزهایی را بپرسم؟</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ASK_LABELS) as Ask[]).map((a) => (
                <Chip key={a} active={asks.includes(a)} onClick={() => toggle(a)}>
                  {ASK_LABELS[a]}
                </Chip>
              ))}
            </div>
          </div>
          <pre className="whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 font-sans text-[13px] leading-7 text-stone-800 ring-1 ring-stone-200">{msg}</pre>
          <details className="text-xs text-stone-500">
            <summary className="cursor-pointer">کنترل دمو: نتیجهٔ پاسخ شبیه‌سازی‌شده</summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FORCE_OPTIONS.map((f) => (
                <Chip key={f.v} active={force === f.v} onClick={() => setForce(f.v)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </details>
          <div className="flex gap-2">
            <Button onClick={send} disabled={!asks.length} className="flex-1">
              ارسال پیام (شبیه‌سازی)
            </Button>
            <Button variant="secondary" onClick={copy}>
              {copied ? "کپی شد ✓" : "کپی متن"}
            </Button>
          </div>
        </>
      )}

      {(phase === "sending" || phase === "waiting") && (
        <ol className="space-y-2 text-sm" aria-live="polite">
          <li className="flex items-center gap-2">
            <span className="text-emerald-600">✓</span> پیام آماده شد
          </li>
          <li className="flex items-center gap-2">
            <span className={phase === "waiting" ? "text-emerald-600" : "animate-pulse"}>{phase === "waiting" ? "✓" : "…"}</span> ارسال به فروشنده (شبیه‌سازی)
          </li>
          {phase === "waiting" && (
            <li className="flex items-center gap-2">
              <span className="animate-pulse">…</span> در انتظار پاسخ فروشنده
            </li>
          )}
        </ol>
      )}

      {phase === "done" && existing && (
        <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_FA[existing.status].tone}>{STATUS_FA[existing.status].label}</Badge>
            <Badge tone="neutral" icon={false}>
              پرسیده‌شده {faTime(existing.askedAt)}
              {existing.repliedAt ? ` · پاسخ ${faTime(existing.repliedAt)}` : ""}
            </Badge>
            <Badge tone="warn">پاسخ شبیه‌سازی‌شده</Badge>
          </div>
          {existing.reply ? (
            <div className="rounded-2xl rounded-tr-sm bg-emerald-50 p-3 text-sm leading-7 text-stone-800 ring-1 ring-emerald-100">{existing.reply}</div>
          ) : (
            <div className="rounded-2xl bg-stone-50 p-3 text-sm text-stone-600 ring-1 ring-stone-200">فروشنده تا این لحظه پاسخی نداده است.</div>
          )}
          {existing.status === "PRICE_CHANGED" && existing.newPrice && (
            <div className="text-sm">
              قیمت ثبت‌شده: <span className="line-through">{toman(offer.price)}</span> ← قیمت اعلامی فروشنده: <b>{toman(existing.newPrice)}</b>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {existing.status !== "CONFIRMED" && onFindAlternative && (
              <Button onClick={() => onFindAlternative(existing.status)}>🔁 پیشنهاد فروشنده جایگزین</Button>
            )}
            <Button variant="secondary" onClick={() => setPhase("compose")}>
              پرسیدن دوباره
            </Button>
          </div>
        </div>
      )}

      {(offer.shop.instagram || offer.shop.website) && (
        <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-3 text-sm">
          <span className="text-stone-500">لینک عمومی ثبت‌شده:</span>
          {offer.shop.instagram && (
            <a className="text-teal-800 underline" href={offer.shop.instagram.startsWith("http") ? offer.shop.instagram : `https://instagram.com/${offer.shop.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer nofollow">
              اینستاگرام
            </a>
          )}
          {offer.shop.website && (
            <a className="text-teal-800 underline" href={offer.shop.website} target="_blank" rel="noopener noreferrer nofollow">
              وب‌سایت
            </a>
          )}
        </div>
      )}
    </section>
  );
}
