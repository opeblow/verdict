/**
 * Product lookup through Open Beauty Facts (https://world.openbeautyfacts.org),
 * an open database of cosmetic products. Data is ODbL licensed; the UI credits it.
 */

const BASE = "https://world.openbeautyfacts.org";
const USER_AGENT = "Verdict/1.0 (skincare trial app; https://github.com/)";

export interface ProductHit {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  ingredientsText?: string;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  image_front_small_url?: string;
  image_small_url?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
}

export function toHit(p: OffProduct): ProductHit | null {
  const name = (p.product_name_en || p.product_name || "").trim();
  if (!p.code || !name) return null;
  const ingredients = (p.ingredients_text_en || p.ingredients_text || "").trim();
  return {
    barcode: p.code,
    name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    imageUrl: p.image_front_small_url || p.image_small_url || undefined,
    ingredientsText: ingredients || undefined,
  };
}

const FIELDS = "code,product_name,product_name_en,brands,image_front_small_url,image_small_url,ingredients_text,ingredients_text_en";

async function get(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8000),
  } as RequestInit);
  if (!res.ok) throw new Error(`Open Beauty Facts returned HTTP ${res.status}`);
  return res.json();
}

export async function searchProducts(query: string, fetchImpl: typeof fetch = fetch): Promise<ProductHit[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`;
  const body = (await get(url, fetchImpl)) as { products?: OffProduct[] };
  return (body.products ?? []).map(toHit).filter((h): h is ProductHit => h !== null);
}

export async function productByBarcode(code: string, fetchImpl: typeof fetch = fetch): Promise<ProductHit | null> {
  const body = (await get(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, fetchImpl)) as {
    status?: number;
    product?: OffProduct;
  };
  if (body.status !== 1 || !body.product) return null;
  return toHit({ ...body.product, code: body.product.code ?? code });
}
