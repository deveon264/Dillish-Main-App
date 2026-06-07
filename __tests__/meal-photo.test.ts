import { test } from "node:test";
import assert from "node:assert/strict";

// objectStorageServer reads PRIVATE_OBJECT_DIR lazily via getPrivateDir(), which
// the GET handler uses to build the object path. A throwaway value for the test.
process.env.PRIVATE_OBJECT_DIR = "/test-bucket/.private";

import {
  mealPhotoGet,
  mealPhotoPost,
  type MealPhotoDeps,
} from "@/app/api/meal-photo+api";

// --- fakes & helpers --------------------------------------------------------

type FakeDeps = MealPhotoDeps & {
  uploads: { mime: string; declaredLength: number; bytesSeen: number; path: string }[];
  signedFor: string[];
  fetched: string[];
};

function makeDeps(
  fetchImpl?: (url: string) => Promise<Response>
): FakeDeps {
  const uploads: FakeDeps["uploads"] = [];
  const signedFor: string[] = [];
  const fetched: string[] = [];
  let counter = 0;
  return {
    uploads,
    signedFor,
    fetched,
    async uploadMealPhotoStream(body, contentType, contentLength) {
      const reader = body.getReader();
      let bytesSeen = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) bytesSeen += value.byteLength;
        }
      } finally {
        reader.releaseLock();
      }
      const path = `/test-bucket/.private/meal-photos/obj-${++counter}`;
      uploads.push({ mime: contentType, declaredLength: contentLength, bytesSeen, path });
      return path;
    },
    async getVideoSignedUrl(objectPath) {
      signedFor.push(objectPath);
      return `https://signed.example/${encodeURIComponent(objectPath)}`;
    },
    async fetchImage(url) {
      fetched.push(url);
      if (fetchImpl) return fetchImpl(url);
      // Default: a small valid jpeg-ish response.
      return imageResponse([new Uint8Array(1024).fill(7)], "image/jpeg");
    },
  };
}

function imageResponse(
  chunks: Uint8Array[],
  contentType: string,
  withLength = true
): Response {
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (withLength) headers["Content-Length"] = String(total);
  return new Response(stream, { status: 200, headers });
}

function postReq(body: unknown): Request {
  return new Request("http://t/api/meal-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PEXELS = "https://images.pexels.com/photos/1/food.jpg";

// =========================================================================
// POST /api/meal-photo — re-hosting & validation
// =========================================================================

test("POST re-hosts a Pexels photo and returns its key", async () => {
  const deps = makeDeps();
  const res = await mealPhotoPost(postReq({ url: PEXELS }), deps);
  assert.equal(res.status, 200);

  const { key } = await res.json();
  assert.equal(key, "obj-1");
  assert.deepEqual(deps.fetched, [PEXELS]);
  assert.equal(deps.uploads.length, 1);
  assert.equal(deps.uploads[0].mime, "image/jpeg");
  assert.equal(deps.uploads[0].bytesSeen, 1024);
});

test("POST without a url is a 400", async () => {
  const deps = makeDeps();
  const res = await mealPhotoPost(postReq({}), deps);
  assert.equal(res.status, 400);
  assert.equal(deps.fetched.length, 0);
  assert.equal(deps.uploads.length, 0);
});

test("POST rejects non-Pexels URLs without fetching them (SSRF guard)", async () => {
  const deps = makeDeps();
  for (const url of [
    "http://images.pexels.com/x.jpg", // not https
    "https://evil.example/x.jpg",
    "https://pexels.com.evil.example/x.jpg",
    "https://localhost/x.jpg",
    "file:///etc/passwd",
  ]) {
    const res = await mealPhotoPost(postReq({ url }), deps);
    assert.equal(res.status, 400, `expected 400 for ${url}`);
  }
  assert.equal(deps.fetched.length, 0);
  assert.equal(deps.uploads.length, 0);
});

test("POST accepts the bare pexels.com host", async () => {
  const deps = makeDeps();
  const res = await mealPhotoPost(postReq({ url: "https://pexels.com/a.jpg" }), deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).key, "obj-1");
});

test("POST returns key:null when the upstream fetch fails", async () => {
  const deps = makeDeps(async () => new Response("nope", { status: 404 }));
  const res = await mealPhotoPost(postReq({ url: PEXELS }), deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).key, null);
  assert.equal(deps.uploads.length, 0);
});

test("POST returns key:null when the upstream content-type is not an image", async () => {
  const deps = makeDeps(async () => imageResponse([new Uint8Array([1, 2])], "text/html"));
  const res = await mealPhotoPost(postReq({ url: PEXELS }), deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).key, null);
  assert.equal(deps.uploads.length, 0);
});

test("POST rejects an oversized photo by its declared Content-Length", async () => {
  const big = new Uint8Array(9 * 1024 * 1024); // 9MB > 8MB cap
  const deps = makeDeps(async () => imageResponse([big], "image/jpeg"));
  const res = await mealPhotoPost(postReq({ url: PEXELS }), deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).key, null);
  assert.equal(deps.uploads.length, 0);
});

test("POST aborts an oversized photo with no Content-Length via the streaming counter", async () => {
  const oneMb = new Uint8Array(1024 * 1024).fill(9);
  const chunks = Array.from({ length: 9 }, () => oneMb); // >8MB
  const deps = makeDeps(async () => imageResponse(chunks, "image/jpeg", false));
  const res = await mealPhotoPost(postReq({ url: PEXELS }), deps);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).key, null);
});

// =========================================================================
// GET /api/meal-photo — redirect / key validation
// =========================================================================

test("GET redirects (302) to a signed URL for a valid key", async () => {
  const deps = makeDeps();
  const res = await mealPhotoGet(
    new Request("http://t/api/meal-photo?key=0123456789abcdef0123", { method: "GET" }),
    deps
  );
  assert.equal(res.status, 302);
  const expectedPath = "/test-bucket/.private/meal-photos/0123456789abcdef0123";
  assert.equal(
    res.headers.get("Location"),
    `https://signed.example/${encodeURIComponent(expectedPath)}`
  );
  assert.match(res.headers.get("Cache-Control") ?? "", /private/);
  assert.deepEqual(deps.signedFor, [expectedPath]);
});

test("GET rejects a missing or malformed key without signing", async () => {
  const deps = makeDeps();
  for (const q of ["", "?key=", "?key=../../etc/passwd", "?key=short", "?key=has/slash/inside"]) {
    const res = await mealPhotoGet(
      new Request(`http://t/api/meal-photo${q}`, { method: "GET" }),
      deps
    );
    assert.equal(res.status, 400, `expected 400 for "${q}"`);
  }
  assert.deepEqual(deps.signedFor, []);
});
