import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "همراه خرید — دستیار خرید حضوری تهران",
  description: "محصول مناسب را پیدا کن، فروشگاه‌های حضوری نزدیک را مقایسه کن و قبل از رفتن از فروشنده بپرس.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-dvh antialiased">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-3">{children}</main>
      </body>
    </html>
  );
}
