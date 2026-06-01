import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";

import { mintSessionToken } from "@/lib/adminAuth";
import {
  avatarGet,
  avatarPost,
  avatarDelete,
  type AvatarStorage,
} from "@/app/api/avatar+api";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

const MAX_AVATAR_BYTES = 8 * 1024 * 1024; // mirrors the handler's limit

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// --- fakes & helpers --------------------------------------------------------

// A fake storage seam that records what the handler asked it to do. Crucially
// `uploadAvatarStream` fully drains the piped body, so the handler's streaming
// size-limiting TransformStream actually runs (and can abort mid-stream) just as
// it would against real object storage.
type FakeStorage = AvatarStorage & {
  uploads: { mime: string; declaredLength: number; bytesSeen: number; path: string }[];
  deleted: string[];
  signedFor: string[];
};

function makeStorage(): FakeStorage {
  const uploads: FakeStorage["uploads"] = [];
  const deleted: string[] = [];
  const signedFor: string[] = [];
  let counter = 0;
  return {
    uploads,
    deleted,
    signedFor,
    async uploadAvatarStream(body, contentType, contentLength) {
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
      const path = `/bucket/profile-avatars/obj-${++counter}`;
      uploads.push({ mime: contentType, declaredLength: contentLength, bytesSeen, path });
      return path;
    },
    async deleteObject(objectPath) {
      deleted.push(objectPath);
    },
    async getVideoSignedUrl(objectPath) {
      signedFor.push(objectPath);
      return `https://signed.example/${encodeURIComponent(objectPath)}`;
    },
  };
}

let userSeq = 0;
async function seedMember(extra: Record<string, any> = {}) {
  const id = `u-${++userSeq}`;
  const email = `member${userSeq}@example.com`;
  db.seedUser({ id, email, name: "Member", ...extra });
  const { token } = await mintSessionToken({ sub: id, email, isAdmin: false });
  return { id, email, token };
}

function bufferPost(token: string, contentType: string, bytes: Uint8Array): Request {
  return new Request("http://t/api/avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: bytes,
  });
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
  });
}

// A POST whose body is a stream with NO Content-Length header — mirrors the
// native upload clients that omit it (the regression this test guards).
function streamingPost(
  token: string,
  contentType: string,
  chunks: Uint8Array[]
): Request {
  return new Request("http://t/api/avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: streamOf(chunks),
    // Required by undici when streaming a request body.
    duplex: "half",
  } as any);
}

// =========================================================================
// POST /api/avatar — auth & validation
// =========================================================================

test("POST without a Bearer token is rejected", async () => {
  const storage = makeStorage();
  const res = await avatarPost(
    new Request("http://t/api/avatar", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array([1, 2, 3]),
    }),
    storage
  );
  assert.equal(res.status, 401);
  assert.equal(storage.uploads.length, 0);
});

test("POST with a non-image content-type is rejected", async () => {
  const { token } = await seedMember();
  const storage = makeStorage();
  const res = await avatarPost(
    bufferPost(token, "application/pdf", new Uint8Array([1, 2, 3])),
    storage
  );
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /image/i);
  assert.equal(storage.uploads.length, 0);
});

test("POST for an account that no longer exists returns 404", async () => {
  // Mint a token for an id that was never seeded.
  const { token } = await mintSessionToken({
    sub: "ghost",
    email: "ghost@example.com",
    isAdmin: false,
  });
  const storage = makeStorage();
  const res = await avatarPost(
    bufferPost(token, "image/png", new Uint8Array([1, 2, 3])),
    storage
  );
  assert.equal(res.status, 404);
  assert.equal(storage.uploads.length, 0);
});

// =========================================================================
// POST /api/avatar — success & cleanup
// =========================================================================

test("POST uploads the photo, updates the account, and returns the public user", async () => {
  const { id, token } = await seedMember();
  const storage = makeStorage();
  const bytes = new Uint8Array(2048).fill(7);

  const res = await avatarPost(bufferPost(token, "image/png", bytes), storage);
  assert.equal(res.status, 200);

  const { user } = await res.json();
  // The public user carries a cache-busting version derived from the new object
  // path, never the raw bytes.
  assert.equal(user.id, id);
  assert.equal(user.avatar, null);
  assert.equal(user.avatarVersion, "obj-1");

  // Exactly one upload, with the mime forwarded and the whole body streamed.
  assert.equal(storage.uploads.length, 1);
  assert.equal(storage.uploads[0].mime, "image/png");
  assert.equal(storage.uploads[0].bytesSeen, bytes.byteLength);

  // The account row now points at the uploaded object.
  assert.equal(db.users.get(id)!.avatar_object_path, "/bucket/profile-avatars/obj-1");
  assert.equal(db.users.get(id)!.avatar_mime, "image/png");

  // No previous photo, so nothing was deleted.
  assert.deepEqual(storage.deleted, []);
});

test("POST replacing an existing photo deletes the previous object", async () => {
  const previous = "/bucket/profile-avatars/old-one";
  const { id, token } = await seedMember({
    avatar_object_path: previous,
    avatar_mime: "image/jpeg",
  });
  const storage = makeStorage();

  const res = await avatarPost(
    bufferPost(token, "image/png", new Uint8Array(512).fill(3)),
    storage
  );
  assert.equal(res.status, 200);

  // The newly uploaded object replaced the old one on the account...
  assert.equal(db.users.get(id)!.avatar_object_path, "/bucket/profile-avatars/obj-1");
  // ...and the previous object was cleaned up.
  assert.deepEqual(storage.deleted, [previous]);
});

// =========================================================================
// POST /api/avatar — missing Content-Length (the native regression)
// =========================================================================

test("POST with no Content-Length still succeeds and streams the bytes", async () => {
  const { id, token } = await seedMember();
  const storage = makeStorage();
  const chunk = new Uint8Array(4096).fill(1);

  const req = streamingPost(token, "image/jpeg", [chunk, chunk]);
  // Sanity: this request really does omit Content-Length.
  assert.equal(req.headers.get("content-length"), null);

  const res = await avatarPost(req, storage);
  assert.equal(res.status, 200);

  // The handler proceeded with a declared length of 0 (unknown) but still
  // streamed and stored every byte.
  assert.equal(storage.uploads.length, 1);
  assert.equal(storage.uploads[0].declaredLength, 0);
  assert.equal(storage.uploads[0].bytesSeen, chunk.byteLength * 2);
  assert.equal(db.users.get(id)!.avatar_object_path, "/bucket/profile-avatars/obj-1");
});

test("POST over the 8MB limit is rejected purely by the streaming counter", async () => {
  const { id, token } = await seedMember();
  const storage = makeStorage();

  // 9 x 1MB chunks (>8MB), sent without a Content-Length so the early header
  // check can't fire — only the streaming TransformStream can stop this.
  const oneMb = new Uint8Array(1024 * 1024).fill(9);
  const chunks = Array.from({ length: 9 }, () => oneMb);
  assert.ok(chunks.length * oneMb.byteLength > MAX_AVATAR_BYTES);

  const req = streamingPost(token, "image/jpeg", chunks);
  assert.equal(req.headers.get("content-length"), null);

  const res = await avatarPost(req, storage);
  assert.equal(res.status, 413);
  assert.match((await res.json()).error, /too large/i);

  // The aborted upload left the account untouched and stored nothing.
  assert.equal(storage.uploads.length, 0);
  assert.equal(db.users.get(id)!.avatar_object_path, null);
});

// =========================================================================
// GET /api/avatar — redirect / fallback
// =========================================================================

test("GET redirects (302) to a signed URL when the account has a photo", async () => {
  const objectPath = "/bucket/profile-avatars/has-photo";
  const { id } = await seedMember({ avatar_object_path: objectPath, avatar_mime: "image/png" });
  const storage = makeStorage();

  const res = await avatarGet(
    new Request(`http://t/api/avatar?id=${id}`, { method: "GET" }),
    storage
  );
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get("Location"),
    `https://signed.example/${encodeURIComponent(objectPath)}`
  );
  assert.match(res.headers.get("Cache-Control") ?? "", /private/);
  assert.deepEqual(storage.signedFor, [objectPath]);
});

test("GET returns 404 when the account has no stored photo", async () => {
  const { id } = await seedMember();
  const storage = makeStorage();
  const res = await avatarGet(
    new Request(`http://t/api/avatar?id=${id}`, { method: "GET" }),
    storage
  );
  assert.equal(res.status, 404);
  assert.deepEqual(storage.signedFor, []);
});

test("GET without an id is a 400", async () => {
  const storage = makeStorage();
  const res = await avatarGet(
    new Request("http://t/api/avatar", { method: "GET" }),
    storage
  );
  assert.equal(res.status, 400);
});

// =========================================================================
// DELETE /api/avatar — clears the photo and reclaims the object
// =========================================================================

test("DELETE clears the photo and deletes the stored object", async () => {
  const objectPath = "/bucket/profile-avatars/to-remove";
  const { id, token } = await seedMember({
    avatar_object_path: objectPath,
    avatar_mime: "image/png",
  });
  const storage = makeStorage();

  const res = await avatarDelete(
    new Request("http://t/api/avatar", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
    storage
  );
  assert.equal(res.status, 200);

  const { user } = await res.json();
  assert.equal(user.avatarVersion, null);
  assert.equal(user.avatar, null);

  assert.equal(db.users.get(id)!.avatar_object_path, null);
  assert.deepEqual(storage.deleted, [objectPath]);
});

test("DELETE without a Bearer token is rejected", async () => {
  const storage = makeStorage();
  const res = await avatarDelete(
    new Request("http://t/api/avatar", { method: "DELETE" }),
    storage
  );
  assert.equal(res.status, 401);
  assert.deepEqual(storage.deleted, []);
});

test("DELETE for an account that no longer exists returns 404", async () => {
  const { token } = await mintSessionToken({
    sub: "ghost",
    email: "ghost@example.com",
    isAdmin: false,
  });
  const storage = makeStorage();
  const res = await avatarDelete(
    new Request("http://t/api/avatar", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
    storage
  );
  assert.equal(res.status, 404);
  assert.deepEqual(storage.deleted, []);
});
