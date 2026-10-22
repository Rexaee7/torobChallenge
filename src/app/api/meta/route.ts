import { installmentProviders, neighborhoods, topCategories } from "@/lib/server/repo";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

let cache: unknown = null;

export function GET() {
  return handle(() => {
    cache ??= { neighborhoods: neighborhoods(), categories: topCategories(40), providers: installmentProviders() };
    return cache;
  });
}
