import OpenAI from "openai";

type Nutrition = {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
};

type Env = Record<string, string | undefined>;

export type AnalyzeDeps = {
  env?: Env;
  createCompletion?: (input: any) => Promise<any>;
};

const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The identified food or meal name." },
    kcal: { type: "number", description: "Estimated calories for the shown or described portion." },
    protein: { type: "number", description: "Estimated protein grams for the portion." },
    carbs: { type: "number", description: "Estimated carbohydrate grams for the portion." },
    fats: { type: "number", description: "Estimated fat grams for the portion." },
  },
  required: ["name", "kcal", "protein", "carbs", "fats"],
  additionalProperties: false,
} as const;

export async function analyzeMealPost(request: Request, deps: AnalyzeDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY ?? env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = env.OPENAI_BASE_URL ?? env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) {
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

  const openai = deps.createCompletion
    ? null
    : new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const createCompletion =
    deps.createCompletion ??
    ((input: any) => openai!.chat.completions.create(input));

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
    completion = await createCompletion({
      // Lower-cost, vision-capable default for photo and text meal analysis.
      model: env.OPENAI_MODEL ?? "gpt-5.4-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "nutrition_estimate",
          strict: true,
          schema: NUTRITION_SCHEMA,
        },
      },
      max_completion_tokens: 2048,
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

export async function POST(request: Request): Promise<Response> {
  return analyzeMealPost(request);
}
