import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// adminAuth reads SESSION_SECRET lazily, so setting it before any handler runs
// is enough. A throwaway value for the test runtime.
process.env.SESSION_SECRET = "test-session-secret-please-ignore";
// The cleanup sweep builds the folder prefix from PRIVATE_OBJECT_DIR.
process.env.PRIVATE_OBJECT_DIR = "/bucket/.private";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";

import { runMealPhotoCleanup } from "@/app/api/meal-photo-cleanup+api";
import type { SweepIO } from "@/app/api/exercise-cleanup+api";
import type { StoredObject } from "@/lib/objectStorageServer";
import { installFakeDb, uninstallFakeDb } from "./support/fakeUserDb";

const PRIVATE_DIR = "/bucket/.private";
const MEAL_PREFIX = `${PRIVATE_DIR}/meal-photos/`;
const VIDEOS_PREFIX = `${PRIVATE_DIR}/exercise-videos/`;

// MAX_AGE_MS in the endpoint is 90 days. The endpoint computes its own cutoff
// from the real Date.now(), so seed object ages relative to now: "OLD" objects
// are comfortably past the age window (eligible for deletion) and "RECENT"
// objects are well within it (must be kept).
const DAY_MS = 24 * 60 * 60 * 1000;
const OLD = () => Date.now() - 120 * DAY_MS; // 120 days old -> delete
const RECENT = () => Date.now() - 1 * DAY_MS; // 1 day old -> keep

beforeEach(() => {
  installFakeDb();
});

afterEach(() => {
  uninstallFakeDb();
});

// A prefix-scoped fake storage shared as the SweepIO seam. listObjects only
// returns objects whose path starts with the requested prefix, exactly like the
// real GCS listing, so the sweep can only ever touch the meal-photos folder.
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
  return new Request(`http://t/api/meal-photo-cleanup${query}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test("meal-photo objects older than the age window are deleted", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${MEAL_PREFIX}old-1`, createdAt: OLD() },
    { path: `${MEAL_PREFIX}old-2`, createdAt: OLD() },
  ]);

  const res = await runMealPhotoCleanup(cleanupRequest(token), fake);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.scanned, 2);
  assert.equal(body.orphans, 2);
  assert.equal(body.deleted, 2);
  assert.equal(body.failed, 0);
  assert.deepEqual(fake.deleted.sort(), [`${MEAL_PREFIX}old-1`, `${MEAL_PREFIX}old-2`]);
});

test("recent meal-photo objects are never deleted", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${MEAL_PREFIX}recent`, createdAt: RECENT() },
  ]);

  const res = await runMealPhotoCleanup(cleanupRequest(token), fake);
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.orphans, 0);
  assert.equal(body.deleted, 0);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${MEAL_PREFIX}recent`), true);
});

test("a mixed listing deletes only the old photos and keeps recent ones", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${MEAL_PREFIX}old`, createdAt: OLD() },
    { path: `${MEAL_PREFIX}recent`, createdAt: RECENT() },
  ]);

  const res = await runMealPhotoCleanup(cleanupRequest(token), fake);
  const body = await res.json();

  assert.equal(body.scanned, 2);
  assert.equal(body.deleted, 1);
  assert.deepEqual(fake.deleted, [`${MEAL_PREFIX}old`]);
  assert.equal(fake.objects.has(`${MEAL_PREFIX}recent`), true);
});

test("the sweep only ever lists the meal-photos folder", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${MEAL_PREFIX}old`, createdAt: OLD() },
    // An exercise object that happens to be old must never be touched: the
    // sweep is scoped to the meal-photos prefix only.
    { path: `${VIDEOS_PREFIX}exercise-orphan`, createdAt: OLD() },
  ]);

  await runMealPhotoCleanup(cleanupRequest(token), fake);

  assert.deepEqual(fake.listedPrefixes, [MEAL_PREFIX]);
  assert.equal(fake.deleted.some((p) => p.startsWith(VIDEOS_PREFIX)), false);
  assert.equal(fake.objects.has(`${VIDEOS_PREFIX}exercise-orphan`), true);
});

test("dryRun reports orphans without deleting anything", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${MEAL_PREFIX}old-1`, createdAt: OLD() },
    { path: `${MEAL_PREFIX}old-2`, createdAt: OLD() },
  ]);

  const res = await runMealPhotoCleanup(cleanupRequest(token, "?dryRun=1"), fake);
  const body = await res.json();

  assert.equal(body.dryRun, true);
  assert.equal(body.orphans, 2);
  assert.equal(body.deleted, 0);
  assert.deepEqual(body.orphanPaths.sort(), [`${MEAL_PREFIX}old-1`, `${MEAL_PREFIX}old-2`]);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.size, 2);
});

test("objects with an unknown creation time (0) are never deleted", async () => {
  const token = await adminToken();
  const fake = makeFake([
    { path: `${MEAL_PREFIX}no-timestamp`, createdAt: 0 },
  ]);

  const res = await runMealPhotoCleanup(cleanupRequest(token), fake);
  const body = await res.json();

  assert.equal(body.orphans, 0);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${MEAL_PREFIX}no-timestamp`), true);
});

test("a request without an admin token is rejected (403) and deletes nothing", async () => {
  const fake = makeFake([{ path: `${MEAL_PREFIX}old`, createdAt: OLD() }]);

  const res = await runMealPhotoCleanup(cleanupRequest(null), fake);
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "Not authorized" });

  // The folder was never even listed; nothing was removed.
  assert.deepEqual(fake.listedPrefixes, []);
  assert.deepEqual(fake.deleted, []);
  assert.equal(fake.objects.has(`${MEAL_PREFIX}old`), true);
});
