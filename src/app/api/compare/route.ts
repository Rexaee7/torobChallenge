import { getProducts } from "@/lib/server/repo";
import { BadRequest, handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(() => {
    const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
    if (ids.length < 1 || ids.length > 4) throw new BadRequest("1-4 ids required");
    return { products: getProducts(ids) };
  });
}
