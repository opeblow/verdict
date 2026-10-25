import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/guard";
import { productByBarcode, searchProducts } from "@/lib/server/openBeautyFacts";

export const runtime = "nodejs";

/** GET /api/products?q=cerave  or  GET /api/products?barcode=3337875597197 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const barcode = params.get("barcode")?.trim();
  const q = params.get("q")?.trim();
  try {
    if (barcode) {
      if (!/^\d{6,14}$/.test(barcode)) return jsonError(400, "bad_request", "Barcodes are 6 to 14 digits.");
      const hit = await productByBarcode(barcode);
      return NextResponse.json({ products: hit ? [hit] : [] });
    }
    if (q) {
      if (q.length < 2 || q.length > 80) return jsonError(400, "bad_request", "Search for 2 to 80 characters.");
      return NextResponse.json({ products: await searchProducts(q) });
    }
    return jsonError(400, "bad_request", "Pass q or barcode.");
  } catch {
    return jsonError(502, "upstream_error", "Product search is unavailable right now. Enter the product by hand.");
  }
}
