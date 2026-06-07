export async function POST(request: Request): Promise<Response> {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return Response.json({ photoUrl: null });
    }

    const body = (await request.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name || name.toLowerCase() === "not a meal") {
      return Response.json({ photoUrl: null });
    }

    const query = encodeURIComponent(`${name} food`);
    const url = `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`;

    const resp = await fetch(url, {
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
