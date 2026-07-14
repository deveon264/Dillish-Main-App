import { getApiUrl } from "@/lib/api";

// Looks up a stock food photo by name via the Pexels-backed /api/food-photo.
// Returns the photo URL or null; never throws (callers keep their icon
// fallback on any failure).
export async function lookupFoodPhoto(name: string, text?: string): Promise<string | null> {
  try {
    const resp = await fetch(`${getApiUrl()}/api/food-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, text }),
    });
    if (!resp.ok) return null;
    const { photoUrl } = (await resp.json()) as { photoUrl: string | null };
    return photoUrl ?? null;
  } catch {
    return null;
  }
}

// Re-hosts a stock photo into Object Storage so a saved log keeps its image
// even if the original Pexels URL stops working. Returns the durable
// app-served URL, or falls back to the original URL if re-hosting fails so
// the meal still logs with a picture.
export async function rehostStockPhoto(url: string): Promise<string> {
  try {
    const resp = await fetch(`${getApiUrl()}/api/meal-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (resp.ok) {
      const { key } = (await resp.json()) as { key: string | null };
      if (key) return `${getApiUrl()}/api/meal-photo?key=${encodeURIComponent(key)}`;
    }
  } catch {
    // Network/transient: fall back to the original URL below.
  }
  return url;
}
