import OpenAI from "openai";

type Nutrition = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
};

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) {
    return Response.json(
      { error: "AI service is not configured yet." },
      { status: 503 },
    );
  }

  let body: { image?: string; text?: string };
  try {
    body = (await request.json()) as { image?: string; text?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.image && !body.text?.trim()) {
    return Response.json(
      { error: "Add a photo or describe your meal to analyze." },
      { status: 400 },
    );
  }

  const openai = new OpenAI({ apiKey, baseURL });

  const systemPrompt =
    'You are a precise nutrition estimator. Identify the food and estimate its nutritional content for the portion described or shown. Respond ONLY with JSON in this exact shape: {"name": string, "kcal": number, "protein": number, "carbs": number, "fats": number}. Macros are in grams, rounded to whole numbers. If the input is not food, return name \'Not a meal\' with zeros.';

  const userContent = body.image
    ? [
        { type: "text" as const, text: "Analyze this meal and estimate its nutrition." },
        { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${body.image}` } },
      ]
    : `Analyze this meal description and estimate its nutrition: ${body.text}`;

  let completion;
  try {
    completion = await openai.chat.completions.create({
      // Use the model the Replit OpenAI integration actually serves. It is
      // vision-capable, so the same call handles photo, scan, and text input.
      model: "gpt-5.4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });
  } catch (e: any) {
    console.error("analyze error: model request failed:", e?.status ?? "", e?.message ?? e);
    return Response.json(
      { error: "Could not analyze the meal. Please try again." },
      { status: 502 },
    );
  }

  const choice = completion.choices?.[0];
  // A reasoning model can spend its whole token budget on reasoning and return
  // an empty string. `?? "{}"` does not catch "", so guard it explicitly before
  // parsing instead of letting JSON.parse throw.
  const raw = choice?.message?.content?.trim();
  if (!raw) {
    console.error(
      "analyze error: empty model output, finish_reason=",
      choice?.finish_reason ?? "unknown",
      "usage=",
      JSON.stringify(completion.usage ?? {}),
    );
    return Response.json(
      { error: "Could not read a result for that meal. Please try again." },
      { status: 502 },
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("analyze error: model output was not valid JSON:", raw.slice(0, 200));
    return Response.json(
      { error: "Could not read a result for that meal. Please try again." },
      { status: 502 },
    );
  }

  const result: Nutrition = {
    name:
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim()
        : "Meal",
    kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
    protein: Math.max(0, Math.round(Number(parsed.protein) || 0)),
    carbs: Math.max(0, Math.round(Number(parsed.carbs) || 0)),
    fats: Math.max(0, Math.round(Number(parsed.fats) || 0)),
  };

  return Response.json(result);
}
