import { test } from "node:test";
import assert from "node:assert/strict";

import { foodPhotoPost } from "@/app/api/food-photo+api";

function postReq(body: unknown): Request {
  return new Request("http://t/api/food-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function pexelsResponse(src: Record<string, string> = {}): Response {
  return Response.json({ photos: [{ src }] });
}

test("food-photo returns null when PEXELS_API_KEY is missing", async () => {
  const res = await foodPhotoPost(postReq({ name: "Banana" }), { env: {} });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { photoUrl: null });
});

test("food-photo returns the best Pexels image URL", async () => {
  let requestedUrl = "";
  let auth = "";
  const res = await foodPhotoPost(postReq({ name: "Banana" }), {
    env: { PEXELS_API_KEY: "test-key" },
    async fetchPhotos(url, init) {
      requestedUrl = url;
      auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      return pexelsResponse({
        large: "https://images.pexels.com/photos/banana-large.jpg",
        medium: "https://images.pexels.com/photos/banana-medium.jpg",
      });
    },
  });

  assert.equal(res.status, 200);
  assert.match(decodeURIComponent(requestedUrl), /query=Banana food/);
  assert.equal(auth, "test-key");
  assert.deepEqual(await res.json(), {
    photoUrl: "https://images.pexels.com/photos/banana-large.jpg",
  });
});

test("food-photo includes original text when it improves the search phrase", async () => {
  let requestedUrl = "";
  const res = await foodPhotoPost(postReq({ name: "Breakfast bowl", text: "oats with banana and berries" }), {
    env: { PEXELS_API_KEY: "test-key" },
    async fetchPhotos(url) {
      requestedUrl = decodeURIComponent(url);
      return pexelsResponse({ medium: "https://images.pexels.com/photos/bowl.jpg" });
    },
  });

  assert.equal(res.status, 200);
  assert.match(requestedUrl, /Breakfast bowl oats with banana and berries food/);
});

test("food-photo returns null for empty or non-meal names", async () => {
  const deps = {
    env: { PEXELS_API_KEY: "test-key" },
    async fetchPhotos() {
      throw new Error("should not fetch");
    },
  };

  assert.deepEqual(await (await foodPhotoPost(postReq({}), deps)).json(), { photoUrl: null });
  assert.deepEqual(await (await foodPhotoPost(postReq({ name: "Not a meal" }), deps)).json(), { photoUrl: null });
});

test("food-photo returns null when Pexels fails", async () => {
  const res = await foodPhotoPost(postReq({ name: "Banana" }), {
    env: { PEXELS_API_KEY: "test-key" },
    async fetchPhotos() {
      return Response.json({ error: "nope" }, { status: 500 });
    },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { photoUrl: null });
});
