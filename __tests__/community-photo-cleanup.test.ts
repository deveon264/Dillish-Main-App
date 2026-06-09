import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";
// The cleanup sweep builds the folder prefix from PRIVATE_OBJECT_DIR.
process.env.PRIVATE_OBJECT_DIR = "/bucket/.private";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";

import { runCommunityPhotoCleanup } from "@/app/api/community-photo-cleanup+api";
import type { SweepIO } from "@/app/api/exercise-cleanup+api";
import type { StoredObject } from "@/lib/objectStorageServer";
import { installFakeDb, uninstallFakeDb, type FakeDb } from "./support/fakeUserDb";

const PRIVATE_DIR = "/bucket/.private";
const COMMUNITY_PREFIX = `${PRIVATE_DIR}/community-photos/`;
const VIDEOS_PREFIX = `${PRIVATE_DIR}/exercise-videos/`;

// GRACE_MS in the endpoint is 1 hour. The endpoint computes its own cutoff from
// the real Date.now(), so seed object ages relative to now: "OLD" objects are
// comfortably past the grace window (eligible for deletion) and "RECENT"
// objects are inside it (still possibly in-flight, must be kept).
const HOUR_MS = 60 * 60 * 1000;
const OLD = () => Date.now() - 2 * HOUR_MS; // 2 hours old -> eligible
const RECENT = () => Date.now() - 1 * 60 * 1000; // 1 minute old -> keep

let db: FakeDb;

beforeEach(() => {
  db = installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// A prefix-scoped fake storage shared as the SweepIO seam. listObjects only
// returns objects whose path starts with the requested prefix, exactly like the
// real GCS listing, so the sweep can only ever touch the community-photos folder.
type Fake = SweepIO & {
  objects: Map<string, { createdAt: number }>;
  deleted: string[];
  listedPrefixes: string[];
};

function makeFake(seed: { path: string; createdAt: number }[] = []): Fake {
  const objects = new Map<string, { createdAt: number }>();
  for (const o of seed) objects.set(o.path, { createdAt: o.createdAt });
  const deleted: string[] = [];
  const listedPrefixes: string[] = [];
  return {
    objects,
    deleted,
    listedPrefixes,
    async listObjects(prefixPath: string): Promise<StoredObject[]> {
      listedPrefixes.push(prefixPath);
      const out: StoredObject[] = [];
      for (const [path, meta] of objects) {
        if (path.startsWith(prefixPath)) out.push({ path, createdAt: meta.createdAt });
      }
      return out;
    },
    async deleteObject(objectPath: string) {
      deleted.push(objectPath);
      objects.delete(objectPath);
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

function cleanupRequest(token: string | null, query = ""): Request {
  return new Request(`http://t/api/community-photo-cleanup${query}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test("unreferenced community photos older than the grace window are deleted", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${COMMUNITY_PREFIX}orphan-1`, createdAt: OLD() },
    { path: `${COMMUNITY_PREFIX}orphan-2`, createdAt: OLD() },
  ]);

  const res = await runCommunityPhotoCleanup(cleanupRequest(token), fake);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.scanned, 2);
  assert.equal(body.referenced, 0);
  assert.equal(body.orphans, 2);
  assert.equal(body.deleted, 2);
  assert.equal(body.failed, 0);
  assert.deepEqual(fake.deleted.sort(), [
    `${COMMUNITY_PREFIX}orphan-1`,
    `${COMMUNITY_PREFIX}orphan-2`,
  ]);
});

test("a photo referenced by a community post is never deleted, even when old", async () => {
  const token = await adminToken();
  db.seedCommunityPost({ photo_object_path: `${COMMUNITY_PREFIX}keep` });
  const fake = makeFake([{ path: `${COMMUNITY_PREFIX}keep`, createdAt: OLD() }]);

  const res = await runCommunityPhotoCleanup(cleanupRequest(token), fake);
  const body = await res.json();

  assert.equal(body.referenced, 1);
  assert.equal(body.orphans, 0);
  assert.equal(body.deleted, 0);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${COMMUNITY_PREFIX}keep`), true);
});

test("recent (in-flight) photos are kept even when unreferenced", async () => {
  const token = await adminToken();
  const fake = makeFake([{ path: `${COMMUNITY_PREFIX}inflight`, createdAt: RECENT() }]);

  const res = await runCommunityPhotoCleanup(cleanupRequest(token), fake);
  const body = await res.json();

  assert.equal(body.orphans, 0);
  assert.equal(body.deleted, 0);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${COMMUNITY_PREFIX}inflight`), true);
});

test("mixed listing: only old orphans are deleted, referenced/recent are kept", async () => {
  const token = await adminToken();
  db.seedCommunityPost({ photo_object_path: `${COMMUNITY_PREFIX}keep` });
  // A text-only post contributes a null path that must never match a stray object.
  db.seedCommunityPost({ photo_object_path: null });
  const fake = makeFake([
    { path: `${COMMUNITY_PREFIX}keep`, createdAt: OLD() }, // referenced
    { path: `${COMMUNITY_PREFIX}orphan`, createdAt: OLD() }, // delete
    { path: `${COMMUNITY_PREFIX}recent`, createdAt: RECENT() }, // too new
  ]);

  const res = await runCommunityPhotoCleanup(cleanupRequest(token), fake);
  const body = await res.json();

  assert.equal(body.scanned, 3);
  assert.equal(body.referenced, 1);
  assert.equal(body.orphans, 1);
  assert.equal(body.deleted, 1);
  assert.deepEqual(fake.deleted, [`${COMMUNITY_PREFIX}orphan`]);
  assert.equal(fake.objects.has(`${COMMUNITY_PREFIX}keep`), true);
  assert.equal(fake.objects.has(`${COMMUNITY_PREFIX}recent`), true);
});

test("the sweep only ever lists the community-photos folder", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${COMMUNITY_PREFIX}orphan`, createdAt: OLD() },
    // An exercise object that happens to be old must never be touched: the
    // sweep is scoped to the community-photos prefix only.
    { path: `${VIDEOS_PREFIX}exercise-orphan`, createdAt: OLD() },
  ]);

  await runCommunityPhotoCleanup(cleanupRequest(token), fake);

  assert.deepEqual(fake.listedPrefixes, [COMMUNITY_PREFIX]);
  assert.equal(fake.deleted.some((p) => p.startsWith(VIDEOS_PREFIX)), false);
  assert.equal(fake.objects.has(`${VIDEOS_PREFIX}exercise-orphan`), true);
});

test("dryRun reports orphans without deleting anything", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${COMMUNITY_PREFIX}orphan-1`, createdAt: OLD() },
    { path: `${COMMUNITY_PREFIX}orphan-2`, createdAt: OLD() },
  ]);

  const res = await runCommunityPhotoCleanup(cleanupRequest(token, "?dryRun=1"), fake);
  const body = await res.json();

  assert.equal(body.dryRun, true);
  assert.equal(body.orphans, 2);
  assert.equal(body.deleted, 0);
  assert.deepEqual(body.orphanPaths.sort(), [
    `${COMMUNITY_PREFIX}orphan-1`,
    `${COMMUNITY_PREFIX}orphan-2`,
  ]);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.size, 2);
});

test("objects with an unknown creation time (0) are never deleted", async () => {
  const token = await adminToken();
  const fake = makeFake([{ path: `${COMMUNITY_PREFIX}no-timestamp`, createdAt: 0 }]);

  const res = await runCommunityPhotoCleanup(cleanupRequest(token), fake);
  const body = await res.json();

  assert.equal(body.orphans, 0);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${COMMUNITY_PREFIX}no-timestamp`), true);
});

test("a request without an admin token is rejected (403) and deletes nothing", async () => {
  const fake = makeFake([{ path: `${COMMUNITY_PREFIX}orphan`, createdAt: OLD() }]);

  const res = await runCommunityPhotoCleanup(cleanupRequest(null), fake);
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "Not authorized" });

  // The folder was never even listed; nothing was removed.
  assert.deepEqual(fake.listedPrefixes, []);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${COMMUNITY_PREFIX}orphan`), true);
});
