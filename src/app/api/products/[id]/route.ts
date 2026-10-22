import { getProduct, similarProducts } from "@/lib/server/repo";
import { handle, num } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const product = getProduct(id);
    if (!product) return null;
    const alternatives = similarProducts(id, { lat: num(sp, "lat", -90, 90), lon: num(sp, "lon", -180, 180), radiusKm: num(sp, "radiusKm", 0.2, 50) });
    return { product, alternatives };
  });
}
