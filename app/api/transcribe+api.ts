import OpenAI, { toFile } from "openai";

type Env = Record<string, string | undefined>;

export type TranscribeDeps = {
  env?: Env;
  // Injectable for tests: receives the prepared file + model and returns the
  // provider response ({ text }).
  createTranscription?: (input: { file: unknown; model: string }) => Promise<{ text?: string }>;
  // Injectable for tests: fetch used to reach the local Whisper sidecar.
  localFetch?: typeof fetch;
};

// Speech-to-text for voice meal logging. The client records a short m4a clip,
// sends it here as base64, and feeds the returned transcript through the
// existing /api/analyze text path. Unauthenticated by design, matching
// /api/analyze and /api/food-photo.
export async function transcribePost(request: Request, deps: TranscribeDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const apiKey = env.OPENAI_API_KEY ?? env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = env.OPENAI_BASE_URL ?? env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  // Open-source fallback: a local Whisper sidecar (scripts/
  // local-transcribe-sidecar.mjs). Used when OpenAI has no key or fails
  // (e.g. audio-model quota limits), so voice logging keeps working.
  const localUrl = env.LOCAL_TRANSCRIBE_URL?.replace(/\/$/, "");
  if (!apiKey && !localUrl) {
    return Response.json({ error: "AI service is not configured yet." }, { status: 503 });
  }

  let body: { audio?: string; format?: string };
  try {
    body = (await request.json()) as { audio?: string; format?: string };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.audio || typeof body.audio !== "string" || !body.audio.trim()) {
    return Response.json({ error: "Record a short description of your meal first." }, { status: 400 });
  }
  // Native records m4a; web records webm/opus (wav supported for tooling).
  // The extension tells the provider which container to expect.
  const ext = body.format === "webm" ? "webm" : body.format === "wav" ? "wav" : "m4a";

  // whisper-1 is the most broadly enabled audio model across account tiers;
  // newer transcribe models hit per-model quota limits on some accounts.
  const model = env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";

  const openai =
    deps.createTranscription || !apiKey ? null : new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  const createTranscription =
    deps.createTranscription ??
    ((input: { file: unknown; model: string }) =>
      openai!.audio.transcriptions.create(input as any) as Promise<{ text?: string }>);

  const localFetch = deps.localFetch ?? fetch;
  const transcribeLocally = async (): Promise<{ text?: string }> => {
    const resp = await localFetch(`${localUrl}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: body.audio, format: ext }),
    });
    if (!resp.ok) throw new Error(`local sidecar responded ${resp.status}`);
    return (await resp.json()) as { text?: string };
  };

  let transcription: { text?: string };
  try {
    if (apiKey) {
      const file = await toFile(Buffer.from(body.audio, "base64"), `meal.${ext}`);
      transcription = await createTranscription({ file, model });
    } else {
      transcription = await transcribeLocally();
    }
  } catch (e: any) {
    console.error("transcribe error: provider request failed:", e?.status ?? "", e?.message ?? e);
    if (apiKey && localUrl) {
      // The hosted provider failed (quota, outage); retry on the local
      // open-source Whisper sidecar before giving up.
      try {
        transcription = await transcribeLocally();
      } catch (le: any) {
        console.error("transcribe error: local fallback failed:", le?.message ?? le);
        return Response.json(
          { error: "Could not transcribe the recording. Please try again." },
          { status: 502 },
        );
      }
    } else {
      return Response.json(
        { error: "Could not transcribe the recording. Please try again." },
        { status: 502 },
      );
    }
  }

  const text = transcription?.text?.trim();
  if (!text) {
    return Response.json(
      { error: "We couldn't hear a meal in that recording. Please try again." },
      { status: 422 },
    );
  }

  return Response.json({ text });
}

export async function POST(request: Request): Promise<Response> {
  return transcribePost(request);
}
