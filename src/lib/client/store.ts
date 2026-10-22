"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ContactResult, ProductSummary, ShopOffer } from "../types";

export interface UserLocation {
  lat: number;
  lon: number;
  label: string;
  source: "gps" | "area";
}

export interface PlanItem {
  key: string; // productId:offerId
  productId: string;
  productTitle: string;
  offer: ShopOffer;
  addedAt: string;
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[];
  blocks?: unknown[];
  engine?: string;
}

interface State {
  location: UserLocation | null;
  radiusKm: number;
  maxPrice: number | null;
  installment: boolean;
  visit: { day: string; minute: number } | null; // null => now
  shortlist: ProductSummary[];
  plan: PlanItem[];
  contacts: Record<string, ContactResult>; // by offerId
  chat: ChatTurn[];
  setLocation: (l: UserLocation | null) => void;
  setRadius: (r: number) => void;
  setMaxPrice: (p: number | null) => void;
  setInstallment: (v: boolean) => void;
  setVisit: (v: State["visit"]) => void;
  toggleShortlist: (p: ProductSummary) => void;
  clearShortlist: () => void;
  togglePlan: (item: Omit<PlanItem, "key" | "addedAt">) => void;
  removePlan: (key: string) => void;
  setContact: (offerId: string, r: ContactResult) => void;
  pushChat: (t: ChatTurn) => void;
  resetChat: () => void;
  resetAll: () => void;
}

const initial = {
  location: null,
  radiusKm: 5,
  maxPrice: null,
  installment: false,
  visit: null,
  shortlist: [],
  plan: [],
  contacts: {},
  chat: [],
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      ...initial,
      setLocation: (location) => set({ location }),
      setRadius: (radiusKm) => set({ radiusKm }),
      setMaxPrice: (maxPrice) => set({ maxPrice }),
      setInstallment: (installment) => set({ installment }),
      setVisit: (visit) => set({ visit }),
      toggleShortlist: (p) =>
        set((s) => {
          const has = s.shortlist.some((x) => x.id === p.id);
          if (has) return { shortlist: s.shortlist.filter((x) => x.id !== p.id) };
          return { shortlist: [...s.shortlist, p].slice(-4) };
        }),
      clearShortlist: () => set({ shortlist: [] }),
      togglePlan: (item) =>
        set((s) => {
          const key = `${item.productId}:${item.offer.offerId}`;
          if (s.plan.some((p) => p.key === key)) return { plan: s.plan.filter((p) => p.key !== key) };
          return { plan: [...s.plan, { ...item, key, addedAt: new Date().toISOString() }].slice(-8) };
        }),
      removePlan: (key) => set((s) => ({ plan: s.plan.filter((p) => p.key !== key) })),
      setContact: (offerId, r) => set((s) => ({ contacts: { ...s.contacts, [offerId]: r } })),
      pushChat: (t) => set((s) => ({ chat: [...s.chat, t].slice(-30) })),
      resetChat: () => set({ chat: [] }),
      resetAll: () => set({ ...initial }),
    }),
    { name: "hamrah-kharid-v1", version: 1 },
  ),
);

/** Query-string helpers so every request carries the user's constraints. */
export function locParams(s: Pick<State, "location" | "radiusKm">): Record<string, string> {
  if (!s.location) return {};
  return { lat: String(s.location.lat), lon: String(s.location.lon), radiusKm: String(s.radiusKm) };
}

export function qs(o: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && v !== false) sp.set(k, String(v === true ? 1 : v));
  return sp.toString();
}
