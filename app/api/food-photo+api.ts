import { requireSession } from "@/lib/adminAuth";
import { rateLimit, tooMany } from "@/lib/rateLimit";

type FoodPhotoDeps = {
  env?: Record<string, string | undefined>;
  fetchPhotos?: (url: string, init?: RequestInit) => Promise<Response>;
};

function buildFoodPhotoQuery(name: string, text?: string): string {
  const original = text?.trim();
  if (!original || original.toLowerCase() === name.toLowerCase()) {
    return `${name} food`;
  }
  if (name.toLowerCase().includes(original.toLowerCase())) {
    return `${name} food`;
  }
  return `${name} ${original} food`;
}

export async function foodPhotoPost(
  request: Request,
  deps: FoodPhotoDeps = {},
): Promise<Response> {
  try {
    const env = deps.env ?? process.env;
    const apiKey = env.PEXELS_API_KEY;
    if (!apiKey) {
      return Response.json({ photoUrl: null });
    }

    const body = (await request.json()) as { name?: string; text?: string };
    const name = body.name?.trim();
    if (!name || name.toLowerCase() === "not a meal") {
      return Response.json({ photoUrl: null });
    }

    const query = encodeURIComponent(buildFoodPhotoQuery(name, body.text));
    const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`;

    const fetchPhotos = deps.fetchPhotos ?? fetch;
    const resp = await fetchPhotos(url, {
      headers: { Authorization: apiKey },
    });
    if (!resp.ok) {
      return Response.json({ photoUrl: null });
    }

    const data = (await resp.json()) as {
      photos?: { src?: { large?: string; medium?: string; original?: string } }[];
    };
    const photo = data.photos?.[0]?.src;
    const photoUrl = photo?.large ?? photo?.medium ?? photo?.original ?? null;

    return Response.json({ photoUrl });
  } catch (e: any) {
    console.error("food-photo error:", e?.message ?? e);
    return Response.json({ photoUrl: null });
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession(request);
  if (!session) return Response.json({ error: "Sign in to use this feature." }, { status: 401 });
  const rl = await rateLimit(`ai:food-photo:${session.sub}`, { limit: 40, windowSec: 3600 });
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  return foodPhotoPost(request);
}
