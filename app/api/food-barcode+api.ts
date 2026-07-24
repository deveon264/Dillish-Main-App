import { requireSession } from "@/lib/adminAuth";
import { rateLimit, tooMany } from "@/lib/rateLimit";

type Nutrition = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
};

type OpenFoodFactsProduct = {
  product_name?: string;
  generic_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  nutriments?: Record<string, unknown>;
};

export type FoodBarcodeDeps = {
  fetchProduct?: (url: string, init?: RequestInit) => Promise<Response>;
};

const USER_AGENT = "FlorishFitness/1.0 (support@florish.local)";

function numberFrom(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nutrient(nutriments: Record<string, unknown>, key: string): number | null {
  return numberFrom(nutriments[key]);
}

function nutritionFromProduct(product: OpenFoodFactsProduct): (Nutrition & { photoUrl?: string }) | null {
  const nutriments = product.nutriments ?? {};
  const hasServing =
    nutrient(nutriments, "energy-kcal_serving") !== null ||
    nutrient(nutriments, "proteins_serving") !== null ||
    nutrient(nutriments, "carbohydrates_serving") !== null ||
    nutrient(nutriments, "fat_serving") !== null;
  const suffix = hasServing ? "serving" : "100g";
  const kcal = nutrient(nutriments, `energy-kcal_${suffix}`);
  const protein = nutrient(nutriments, `proteins_${suffix}`);
  const carbs = nutrient(nutriments, `carbohydrates_${suffix}`);
  const fats = nutrient(nutriments, `fat_${suffix}`);

  if ([kcal, protein, carbs, fats].every((n) => n === null)) return null;

  const name =
    product.product_name?.trim() ||
    product.generic_name?.trim() ||
    product.brands?.trim() ||
    "Scanned food";
  const photoUrl = product.image_front_url ?? product.image_url;

  return {
    name,
    kcal: Math.max(0, Math.round(kcal ?? 0)),
    protein: Math.max(0, Math.round(protein ?? 0)),
    carbs: Math.max(0, Math.round(carbs ?? 0)),
    fats: Math.max(0, Math.round(fats ?? 0)),
    ...(photoUrl ? { photoUrl } : {}),
  };
}

export async function foodBarcodePost(
  request: Request,
  deps: FoodBarcodeDeps = {},
): Promise<Response> {
  let body: { barcode?: string };
  try {
    body = (await request.json()) as { barcode?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const barcode = body.barcode?.trim();
  if (!barcode) {
    return Response.json({ error: "Scan a barcode first." }, { status: 400 });
  }
  if (!/^[0-9]{6,32}$/.test(barcode)) {
    return Response.json({ error: "That barcode doesn't look valid." }, { status: 400 });
  }

  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json` +
    "?fields=product_name,generic_name,brands,image_front_url,image_url,nutriments";
  const fetchProduct = deps.fetchProduct ?? fetch;

  let resp: Response;
  try {
    resp = await fetchProduct(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
  } catch (e: any) {
    console.error("food-barcode error:", e?.message ?? e);
    return Response.json({ error: "Could not look up that barcode. Please try again." }, { status: 502 });
  }

  if (!resp.ok) {
    return Response.json({ error: "Could not look up that barcode. Please try again." }, { status: 502 });
  }

  const data = (await resp.json()) as { status?: number; product?: OpenFoodFactsProduct };
  if (data.status === 0 || !data.product) {
    return Response.json({ error: "Product not found for that barcode." }, { status: 404 });
  }

  const result = nutritionFromProduct(data.product);
  if (!result) {
    return Response.json({ error: "Nutrition is unavailable for that product." }, { status: 422 });
  }

  return Response.json(result);
}

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession(request);
  if (!session) return Response.json({ error: "Sign in to use this feature." }, { status: 401 });
  const rl = await rateLimit(`ai:food-barcode:${session.sub}`, { limit: 60, windowSec: 3600 });
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  return foodBarcodePost(request);
}
