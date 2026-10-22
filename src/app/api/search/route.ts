import { searchProducts } from "@/lib/server/repo";
import { bool, handle, num, str } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const sort = str(sp, "sort");
    return searchProducts({
      q: str(sp, "q", 200),
      category: str(sp, "category"),
      brand: str(sp, "brand"),
      minPrice: num(sp, "minPrice", 0, 1e12),
      maxPrice: num(sp, "maxPrice", 0, 1e12),
      lat: num(sp, "lat", -90, 90),
      lon: num(sp, "lon", -180, 180),
      radiusKm: num(sp, "radiusKm", 0.2, 50),
      installment: bool(sp, "installment"),
      sort: sort === "price_asc" || sort === "price_desc" || sort === "sellers" ? sort : "relevance",
      limit: num(sp, "limit", 1, 48),
      offset: num(sp, "offset", 0, 10000),
    });
  });
}
