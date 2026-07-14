import { test } from "node:test";
import assert from "node:assert/strict";

import { transcribePost } from "@/app/api/transcribe+api";

function postReq(body: unknown): Request {
  return new Request("http://t/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const AUDIO_B64 = Buffer.from("fake-audio-bytes").toString("base64");

test("transcribe returns 503 when OPENAI_API_KEY is missing", async () => {
  const res = await transcribePost(postReq({ audio: AUDIO_B64 }), { env: {} });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "AI service is not configured yet." });
});

test("transcribe returns 400 when audio is missing", async () => {
  const res = await transcribePost(postReq({}), { env: { OPENAI_API_KEY: "test-key" } });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Record a short description of your meal first." });
});

test("transcribe returns 400 on a non-JSON body", async () => {
  const req = new Request("http://t/api/transcribe", { method: "POST", body: "not json" });
  const res = await transcribePost(req, { env: { OPENAI_API_KEY: "test-key" } });
  assert.equal(res.status, 400);
});

test("transcribe passes the decoded audio to the provider and returns the text", async () => {
  let seen: any;
  const res = await transcribePost(postReq({ audio: AUDIO_B64 }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createTranscription(input) {
      seen = input;
      return { text: "two scrambled eggs with toast and orange juice" };
    },
  });

  assert.equal(res.status, 200);
  assert.equal(seen.model, "whisper-1");
  assert.equal(seen.file.name, "meal.m4a");
  assert.deepEqual(await res.json(), { text: "two scrambled eggs with toast and orange juice" });
});

test("transcribe names the file per the client-reported format and honors the model override", async () => {
  let seen: any;
  const res = await transcribePost(postReq({ audio: AUDIO_B64, format: "webm" }), {
    env: { OPENAI_API_KEY: "test-key", OPENAI_TRANSCRIBE_MODEL: "gpt-4o-mini-transcribe" },
    async createTranscription(input) {
      seen = input;
      return { text: "a bowl of oatmeal" };
    },
  });
  assert.equal(res.status, 200);
  assert.equal(seen.model, "gpt-4o-mini-transcribe");
  assert.equal(seen.file.name, "meal.webm");
});

test("transcribe returns 422 when the transcript comes back empty", async () => {
  const res = await transcribePost(postReq({ audio: AUDIO_B64 }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createTranscription() {
      return { text: "   " };
    },
  });
  assert.equal(res.status, 422);
  assert.deepEqual(await res.json(), {
    error: "We couldn't hear a meal in that recording. Please try again.",
  });
});

test("transcribe returns 502 when the provider fails and no local fallback is configured", async () => {
  const res = await transcribePost(postReq({ audio: AUDIO_B64 }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createTranscription() {
      throw new Error("boom");
    },
  });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), {
    error: "Could not transcribe the recording. Please try again.",
  });
});

test("transcribe falls back to the local sidecar when the provider fails", async () => {
  let localBody: any;
  const res = await transcribePost(postReq({ audio: AUDIO_B64 }), {
    env: { OPENAI_API_KEY: "test-key", LOCAL_TRANSCRIBE_URL: "http://127.0.0.1:1107" },
    async createTranscription() {
      const err: any = new Error("quota");
      err.status = 429;
      throw err;
    },
    localFetch: (async (url: any, init: any) => {
      assert.equal(url, "http://127.0.0.1:1107/transcribe");
      localBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ text: "grilled chicken salad" }), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(res.status, 200);
  assert.equal(localBody.audio, AUDIO_B64);
  assert.equal(localBody.format, "m4a");
  assert.deepEqual(await res.json(), { text: "grilled chicken salad" });
});

test("transcribe uses the local sidecar directly when no API key is set", async () => {
  const res = await transcribePost(postReq({ audio: AUDIO_B64, format: "webm" }), {
    env: { LOCAL_TRANSCRIBE_URL: "http://127.0.0.1:1107" },
    localFetch: (async (_url: any, init: any) => {
      const parsed = JSON.parse(init.body);
      assert.equal(parsed.format, "webm");
      return new Response(JSON.stringify({ text: "a protein smoothie" }), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "a protein smoothie" });
});

test("transcribe returns 502 when both the provider and the local sidecar fail", async () => {
  const res = await transcribePost(postReq({ audio: AUDIO_B64 }), {
    env: { OPENAI_API_KEY: "test-key", LOCAL_TRANSCRIBE_URL: "http://127.0.0.1:1107" },
    async createTranscription() {
      throw new Error("quota");
    },
    localFetch: (async () => new Response("nope", { status: 500 })) as typeof fetch,
  });
  assert.equal(res.status, 502);
});
