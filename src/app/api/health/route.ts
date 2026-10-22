import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { meta } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const n = (getDb().prepare("SELECT COUNT(*) n FROM offers").get() as { n: number }).n;
    return NextResponse.json({ ok: true, offers: n, datasetBuiltAt: meta().built_at, llm: process.env.BOXAPI_API_KEY && process.env.LLM_DISABLED !== "1" ? "enabled" : "rules-only" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 503 });
  }
}
