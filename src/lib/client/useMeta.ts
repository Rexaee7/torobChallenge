"use client";
import { useEffect, useState } from "react";
import type { Facet } from "../types";

export interface Meta {
  neighborhoods: { label: string; lat: number; lon: number; shopCount: number }[];
  categories: Facet[];
  providers: Facet[];
}

let cached: Meta | null = null;
let inflight: Promise<Meta> | null = null;

export function useMeta(): Meta | null {
  const [m, setM] = useState<Meta | null>(cached);
  useEffect(() => {
    if (cached) return;
    inflight ??= fetch("/api/meta").then((r) => r.json());
    inflight.then((d) => {
      cached = d;
      setM(d);
    }).catch(() => (inflight = null));
  }, []);
  return m;
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
