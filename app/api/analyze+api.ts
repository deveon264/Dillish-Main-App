import OpenAI from "openai";

export async function POST(request: Request): Promise<Response> {
  try {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (!apiKey || !baseURL) {
      return Response.json({ error: "AI service not configured" }, { status: 503 });
    }

    const body = (await request.json()) as { image?: string; text?: string };
    if (!body.image && !body.text?.trim()) {
      return Response.json({ error: "No image or text provided" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey, baseURL });

    const systemPrompt =
      "You are a precise nutrition estimator. Identify the food and estimate its nutritional content for the portion described or shown. Respond ONLY with JSON in this exact shape: {\"name\": string, \"kcal\": number, \"protein\": number, \"carbs\": number, \"fats\": number}. Macros are in grams, rounded to whole numbers. If the input is not food, return name 'Not a meal' with zeros.";

    const userContent = body.image
      ? [
          { type: "text" as const, text: "Analyze this meal and estimate its nutrition." },
          { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${body.image}` } },
        ]
      : `Analyze this meal description and estimate its nutrition: ${body.text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const result = {
      name: typeof parsed.name === "string" ? parsed.name : "Meal",
      kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
      protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
      fats: Math.max(0, Math.round(Number(parsed.fats) || 0)),
    };

    return Response.json(result);
  } catch (e: any) {
    console.error("analyze error:", e?.message ?? e);
    return Response.json({ error: "Failed to analyze meal" }, { status: 500 });
  }
}
