import { getProductShops } from "@/lib/server/repo";
import { bool, handle, num, str } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const sp = new URL(req.url).searchParams;
    const sort = str(sp, "sort");
    return getProductShops(id, {
      lat: num(sp, "lat", -90, 90),
      lon: num(sp, "lon", -180, 180),
      radiusKm: num(sp, "radiusKm", 0.2, 50),
      installment: bool(sp, "installment"),
      provider: str(sp, "provider"),
      openDay: str(sp, "day", 3),
      openMinute: num(sp, "minute", 0, 1440),
      openOnly: bool(sp, "openOnly"),
      sort: sort === "nearest" || sort === "cheapest" ? sort : sort === "best" ? "best" : undefined,
    });
  });
}
