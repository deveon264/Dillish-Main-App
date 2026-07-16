import { test } from "node:test";
import assert from "node:assert/strict";

import { analyzeMealPost } from "@/app/api/analyze+api";

function postReq(body: unknown): Request {
  return new Request("http://t/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("analyze returns 503 when OPENAI_API_KEY is missing", async () => {
  const res = await analyzeMealPost(postReq({ text: "2 eggs" }), { env: {} });
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "AI service is not configured yet." });
});

test("analyze handles text meals with a mocked OpenAI completion", async () => {
  let seen: any;
  const res = await analyzeMealPost(postReq({ text: "2 eggs and toast" }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createCompletion(input) {
      seen = input;
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Eggs and toast",
                kcal: 340,
                protein: 20,
                carbs: 28,
                fats: 16,
                portion: "1 plate (2 eggs, 1 slice)",
              }),
            },
          },
        ],
      };
    },
  });

  assert.equal(res.status, 200);
  assert.equal(seen.model, "gpt-5.4-mini");
  assert.equal(seen.response_format.type, "json_schema");
  assert.match(seen.messages[1].content, /2 eggs and toast/);
  assert.deepEqual(await res.json(), {
    name: "Eggs and toast",
    kcal: 340,
    protein: 20,
    carbs: 28,
    fats: 16,
    portion: "1 plate (2 eggs, 1 slice)",
  });
});

test("analyze tolerates a missing portion by returning an empty string", async () => {
  const res = await analyzeMealPost(postReq({ text: "an apple" }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createCompletion() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({ name: "Apple", kcal: 95, protein: 0, carbs: 25, fats: 0 }),
            },
          },
        ],
      };
    },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    name: "Apple",
    kcal: 95,
    protein: 0,
    carbs: 25,
    fats: 0,
    portion: "",
  });
});

test("analyze sends image input for photo meals", async () => {
  let userContent: any;
  const res = await analyzeMealPost(postReq({ image: "abc123" }), {
    env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-5.4" },
    async createCompletion(input) {
      userContent = input.messages[1].content;
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: "Banana",
                kcal: 105,
                protein: 1,
                carbs: 27,
                fats: 0,
              }),
            },
          },
        ],
      };
    },
  });

  assert.equal(res.status, 200);
  assert.equal(userContent[1].type, "image_url");
  assert.equal(userContent[1].image_url.url, "data:image/jpeg;base64,abc123");
});

test("analyze teaches the model regional foods in the system prompt", async () => {
  let systemPrompt = "";
  await analyzeMealPost(postReq({ text: "dried meat snack" }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createCompletion(input) {
      systemPrompt = input.messages[0].content;
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({ name: "Biltong", kcal: 250, protein: 40, carbs: 1, fats: 10, portion: "100g" }),
            },
          },
        ],
      };
    },
  });

  assert.match(systemPrompt, /biltong/i);
  assert.match(systemPrompt, /droewors/i);
  assert.match(systemPrompt, /not beef jerky/i);
});

test("a user correction rides along with the photo and is framed as the food's identity", async () => {
  let userContent: any;
  const res = await analyzeMealPost(postReq({ image: "abc123", text: "droewors" }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createCompletion(input) {
      userContent = input.messages[1].content;
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({ name: "Droewors", kcal: 180, protein: 16, carbs: 1, fats: 12, portion: "50g" }),
            },
          },
        ],
      };
    },
  });

  assert.equal(res.status, 200);
  assert.match(userContent[0].text, /identifies this food as: "droewors"/);
  assert.match(userContent[0].text, /Trust that identity/);
  assert.equal(userContent[1].type, "image_url");
  assert.equal(userContent[1].image_url.url, "data:image/jpeg;base64,abc123");
});

test("analyze returns 502 for invalid model JSON", async () => {
  const res = await analyzeMealPost(postReq({ text: "chicken salad" }), {
    env: { OPENAI_API_KEY: "test-key" },
    async createCompletion() {
      return { choices: [{ message: { content: "not json" } }] };
    },
  });

  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: "Could not read a result for that meal. Please try again." });
});
