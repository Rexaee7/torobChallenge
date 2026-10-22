// Shared API contracts between server and UI.
import type { OpenState, PaymentOption, WeeklyHours } from "./parsers";

export interface ProductSummary {
  id: string; // dataset product_id
  title: string;
  brand: string | null;
  category: string | null;
  image: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  offerCount: number;
  shopCount: number;
  lastChanged: string | null;
  /** Shops near the user that list this product (only when a location was given). */
  nearbyShopCount?: number;
  nearestKm?: number | null;
  keySpecs: [string, string][];
  reasons: string[];
}

export interface ProductDetail extends ProductSummary {
  model: string | null;
  images: string[];
  specs: [string, string][];
}

export interface Facet {
  name: string;
  count: number;
}

export interface SearchResult {
  items: ProductSummary[];
  total: number;
  /** "all" = every word matched; "partial" = relaxed to any word. */
  matchMode: "all" | "partial" | "none";
  facets: { categories: Facet[]; brands: Facet[]; price: { min: number | null; max: number | null } };
  appliedFilters: SearchParams;
  suggestions: string[];
}

export interface SearchParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  installment?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "sellers";
  limit?: number;
  offset?: number;
}

export interface ShopInfo {
  id: string;
  name: string | null;
  nameVerified: boolean;
  address: string | null;
  area: string | null;
  lat: number | null;
  lon: number | null;
  mall: string | null;
  floor: string | null;
  unit: string | null;
  hours: WeeklyHours;
  payments: PaymentOption[];
  fastDelivery: boolean | null;
  website: string | null;
  instagram: string | null;
  categories: string[];
  offerCount: number;
}

export interface ShopOffer {
  offerId: string;
  price: number | null;
  sellerTitle: string | null;
  description: string | null;
  warranty: string | null;
  lastChanged: string | null;
  shop: ShopInfo;
  distanceKm: number | null;
  /** Declared status at the requested visit time (or now). */
  openState: OpenState;
  score: number;
  reasons: string[];
}

export interface ShopsQuery {
  lat?: number;
  lon?: number;
  radiusKm?: number;
  installment?: boolean;
  provider?: string;
  openDay?: string;
  openMinute?: number;
  openOnly?: boolean;
  sort?: "best" | "nearest" | "cheapest";
}

export interface ShopsResult {
  product: ProductSummary;
  offers: ShopOffer[];
  totalOffers: number;
  /** Offers removed by each constraint — used to explain zero results. */
  excluded: { radius: number; installment: number; closed: number; noCoords: number };
  visitTime: { day: string; minute: number; isNow: boolean };
}

export type ContactStatus = "CONFIRMED" | "PRICE_CHANGED" | "OUT_OF_STOCK" | "CLOSED" | "NO_RESPONSE";

export interface ContactResult {
  status: ContactStatus;
  simulated: true;
  askedAt: string;
  repliedAt: string | null;
  message: string;
  reply: string | null;
  newPrice: number | null;
  floorHint: string | null;
}
