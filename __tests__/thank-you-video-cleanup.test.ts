import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";
// The cleanup sweep builds folder prefixes from PRIVATE_OBJECT_DIR.
process.env.PRIVATE_OBJECT_DIR = "/bucket/.private";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";

import { runCleanup, type SweepIO } from "@/app/api/exercise-cleanup+api";
import {
  thankYouVideoGet,
  thankYouVideoPost,
  type ThankYouVideoStorage,
} from "@/app/api/thank-you-video+api";
import type { StoredObject } from "@/lib/objectStorageServer";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

const PRIVATE_DIR = "/bucket/.private";
const THANK_YOU_PREFIX = `${PRIVATE_DIR}/thank-you-videos/`;
const VIDEOS_PREFIX = `${PRIVATE_DIR}/exercise-videos/`;
const POSTERS_PREFIX = `${PRIVATE_DIR}/exercise-posters/`;

// GRACE_MS in the cleanup endpoint is 1 hour. The endpoint computes its own
// cutoff from the real Date.now(), so seed object ages relative to now: "OLD"
// objects are comfortably past the grace window and would be deleted if the
// sweep ever touched their folder.
const GRACE_MS = 60 * 60 * 1000;
const OLD = () => Date.now() - 2 * GRACE_MS;

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// --- a single in-memory storage backing both seams -------------------------
// Implements ThankYouVideoStorage (used by the thank-you handlers) AND SweepIO
// (used by the cleanup sweep), over one shared object map. listObjects is
// prefix-scoped exactly like the real GCS listing, so a thank-you-videos object
// only ever appears when something asks for that prefix.
type Fake = ThankYouVideoStorage &
  SweepIO & {
    objects: Map<string, { createdAt: number }>;
    deleted: string[];
    listedPrefixes: string[];
  };

function makeFake(seed: { path: string; createdAt: number }[] = []): Fake {
  const objects = new Map<string, { createdAt: number }>();
  for (const o of seed) objects.set(o.path, { createdAt: o.createdAt });
  const deleted: string[] = [];
  const listedPrefixes: string[] = [];
  let counter = 0;

  return {
    objects,
    deleted,
    listedPrefixes,
    async uploadThankYouVideoStream(body, _contentType, _contentLength) {
      // Fully drain the piped body so the handler's size-limiting
      // TransformStream actually runs, just as it would against real storage.
      const reader = body.getReader();
      try {
        for (;;) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
      const path = `${THANK_YOU_PREFIX}obj-${++counter}`;
      // Seed it OLD so a (hypothetical) sweep of this folder would delete it —
      // proving survival is due to the folder never being swept, not its age.
      objects.set(path, { createdAt: OLD() });
      return path;
    },
    async getVideoSignedUrl(objectPath) {
      return `https://signed.example/${encodeURIComponent(objectPath)}`;
    },
    async deleteObject(objectPath) {
      deleted.push(objectPath);
      objects.delete(objectPath);
    },
    async listObjects(prefixPath): Promise<StoredObject[]> {
      listedPrefixes.push(prefixPath);
      const out: StoredObject[] = [];
      for (const [path, meta] of objects) {
        if (path.startsWith(prefixPath)) out.push({ path, createdAt: meta.createdAt });
      }
      return out;
    },
  };
}

async function adminToken(): Promise<string> {
  const { token } = await mintSessionToken({
    sub: "test-admin",
    email: ADMIN_EMAIL,
    isAdmin: true,
  });
  return token;
}

function videoPost(token: string, bytes: Uint8Array): Request {
  return new Request("http://t/api/thank-you-video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes as unknown as BodyInit,
  });
}

// =========================================================================
// The cleanup sweep never lists or deletes the thank-you-videos folder
// =========================================================================

test("cleanup never lists or deletes anything under the thank-you-videos prefix", async () => {
  const token = await adminToken();

  // Storage holds an exercise orphan (old, unreferenced -> eligible for
  // deletion) alongside the onboarding thank-you video (also old). The DB
  // references no exercises, so the only thing protecting the thank-you video
  // is that its folder is never swept.
  const fake = makeFake([
    { path: `${VIDEOS_PREFIX}orphan`, createdAt: OLD() },
    { path: `${THANK_YOU_PREFIX}thanks`, createdAt: OLD() },
  ]);

  const res = await runCleanup(
    new Request("http://t/api/exercise-cleanup", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fake
  );
  assert.equal(res.status, 200);
  const body = await res.json();

  // The exercise orphan WAS deleted (the sweep really did run)...
  assert.deepEqual(fake.deleted, [`${VIDEOS_PREFIX}orphan`]);
  assert.equal(body.deleted, 1);

  // ...but the thank-you video was never deleted and still sits in storage.
  assert.equal(fake.objects.has(`${THANK_YOU_PREFIX}thanks`), true);
  assert.equal(
    fake.deleted.some((p) => p.startsWith(THANK_YOU_PREFIX)),
    false
  );

  // The sweep only ever listed the two exercise folders — never the
  // thank-you-videos folder.
  assert.deepEqual(fake.listedPrefixes.sort(), [POSTERS_PREFIX, VIDEOS_PREFIX]);
  assert.equal(
    fake.listedPrefixes.some((p) => p.startsWith(THANK_YOU_PREFIX)),
    false
  );
});

test("an old thank-you video survives cleanup even when it is the only object in storage", async () => {
  const token = await adminToken();
  const fake = makeFake([{ path: `${THANK_YOU_PREFIX}only`, createdAt: OLD() }]);

  const res = await runCleanup(
    new Request("http://t/api/exercise-cleanup", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fake
  );
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.scanned, 0, "thank-you-videos must not be scanned by the sweep");
  assert.equal(body.deleted, 0);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${THANK_YOU_PREFIX}only`), true);
});

// =========================================================================
// Upload -> replace -> cleanup: old object gone, current one untouched & plays
// =========================================================================

test("a replaced thank-you video plays after cleanup; old object removed, current untouched", async () => {
  const token = await adminToken();
  const fake = makeFake();

  // 1. Upload the first thank-you video.
  const first = await thankYouVideoPost(
    videoPost(token, new Uint8Array(1024).fill(1)),
    fake
  );
  assert.equal(first.status, 200);
  const firstPath = db.settings.get("thank_you_video_path")!;
  assert.ok(firstPath.startsWith(THANK_YOU_PREFIX));
  assert.equal(fake.objects.has(firstPath), true);

  // 2. Replace it. The handler stores the new object and deletes the old one.
  const second = await thankYouVideoPost(
    videoPost(token, new Uint8Array(2048).fill(2)),
    fake
  );
  assert.equal(second.status, 200);
  const currentPath = db.settings.get("thank_you_video_path")!;
  assert.notEqual(currentPath, firstPath);
  assert.deepEqual(fake.deleted, [firstPath], "the replaced object was reclaimed");
  assert.equal(fake.objects.has(firstPath), false);
  assert.equal(fake.objects.has(currentPath), true);

  // 3. Run cleanup. There are no exercises, so an exercise orphan would be
  //    deleted — but the current thank-you object lives in its own folder and
  //    is past the grace window, so this is the strongest test of survival.
  const cleanupRes = await runCleanup(
    new Request("http://t/api/exercise-cleanup", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fake
  );
  assert.equal(cleanupRes.status, 200);

  // The current thank-you object is untouched by cleanup.
  assert.equal(fake.objects.has(currentPath), true);
  assert.equal(
    fake.deleted.some((p) => p === currentPath),
    false
  );

  // 4. It still plays: GET resolves to a 302 signed-URL redirect for the
  //    current object.
  const playRes = await thankYouVideoGet(
    new Request("http://t/api/thank-you-video", { method: "GET" }),
    fake
  );
  assert.equal(playRes.status, 302);
  assert.equal(
    playRes.headers.get("Location"),
    `https://signed.example/${encodeURIComponent(currentPath)}`
  );
});
