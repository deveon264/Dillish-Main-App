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
