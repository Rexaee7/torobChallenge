import "server-only";
import { NextResponse } from "next/server";

export class BadRequest extends Error {}

export function num(sp: URLSearchParams, key: string, min: number, max: number): number | undefined {
  const v = sp.get(key);
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequest(`invalid ${key}`);
  return n;
}

export function str(sp: URLSearchParams, key: string, maxLen = 120): string | undefined {
  const v = sp.get(key)?.trim();
  if (!v) return undefined;
  if (v.length > maxLen) throw new BadRequest(`${key} too long`);
  return v;
}

export function bool(sp: URLSearchParams, key: string): boolean | undefined {
  const v = sp.get(key);
  return v == null ? undefined : v === "1" || v === "true";
}

export function handle<T>(fn: () => T | Promise<T>) {
  return Promise.resolve()
    .then(fn)
    .then((data) => (data == null ? NextResponse.json({ error: "not_found" }, { status: 404 }) : NextResponse.json(data)))
    .catch((e: Error) => {
      if (e instanceof BadRequest) return NextResponse.json({ error: e.message }, { status: 400 });
      console.error("[api]", e);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    });
}
