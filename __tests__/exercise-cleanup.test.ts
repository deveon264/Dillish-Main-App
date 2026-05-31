import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sweepFolder,
  referencedPaths,
  type SweepIO,
} from "@/app/api/exercise-cleanup+api";
import type { StoredObject } from "@/lib/objectStorageServer";

// Fixed "now" so grace-window math is deterministic. GRACE_MS is 1 hour, so the
// cutoff below is one hour before NOW.
const NOW = 1_700_000_000_000;
const GRACE_MS = 60 * 60 * 1000;
const CUTOFF = NOW - GRACE_MS;

// A timestamp comfortably older than the grace window (eligible for deletion).
const OLD = CUTOFF - 60_000;
// A timestamp inside the grace window (must be skipped).
const RECENT = CUTOFF + 60_000;

// Builds a fake SweepIO over a fixed object listing. Records every delete so
// tests can assert exactly which paths were removed.
function makeIO(objects: StoredObject[]): SweepIO & { deletedPaths: string[] } {
  const deletedPaths: string[] = [];
  return {
    deletedPaths,
    async listObjects() {
      return objects;
    },
    async deleteObject(path: string) {
      deletedPaths.push(path);
    },
  };
}

test("referenced objects are never deleted, even when old", async () => {
  const referenced = new Set(["/bucket/exercise-videos/keep-1"]);
  const io = makeIO([
    { path: "/bucket/exercise-videos/keep-1", createdAt: OLD },
  ]);

  const result = await sweepFolder("prefix", referenced, CUTOFF, false, io);

  assert.equal(result.scanned, 1);
  assert.equal(result.orphans, 0);
  assert.equal(result.deleted, 0);
  assert.deepEqual(io.deletedPaths, []);
});

test("unreferenced objects older than the grace window are deleted", async () => {
  const referenced = new Set<string>();
  const io = makeIO([
    { path: "/bucket/exercise-videos/orphan-1", createdAt: OLD },
    { path: "/bucket/exercise-videos/orphan-2", createdAt: OLD },
  ]);

  const result = await sweepFolder("prefix", referenced, CUTOFF, false, io);

  assert.equal(result.orphans, 2);
  assert.equal(result.deleted, 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(io.deletedPaths.sort(), [
    "/bucket/exercise-videos/orphan-1",
    "/bucket/exercise-videos/orphan-2",
  ]);
});

test("unreferenced objects newer than the grace window are skipped", async () => {
  const referenced = new Set<string>();
  const io = makeIO([
    { path: "/bucket/exercise-videos/inflight", createdAt: RECENT },
  ]);

  const result = await sweepFolder("prefix", referenced, CUTOFF, false, io);

  assert.equal(result.orphans, 0);
  assert.equal(result.deleted, 0);
  assert.deepEqual(io.deletedPaths, []);
});

test("objects exactly at the cutoff are kept (strictly-older required)", async () => {
  const referenced = new Set<string>();
  const io = makeIO([
    { path: "/bucket/exercise-videos/edge", createdAt: CUTOFF },
  ]);

  const result = await sweepFolder("prefix", referenced, CUTOFF, false, io);

  assert.equal(result.orphans, 0);
  assert.deepEqual(io.deletedPaths, []);
});

test("objects with an unknown creation time (0) are never deleted", async () => {
  const referenced = new Set<string>();
  const io = makeIO([
    { path: "/bucket/exercise-videos/no-timestamp", createdAt: 0 },
  ]);

  const result = await sweepFolder("prefix", referenced, CUTOFF, false, io);

  assert.equal(result.orphans, 0);
  assert.deepEqual(io.deletedPaths, []);
});

test("mixed listing: only old orphans are deleted, referenced/recent are kept", async () => {
  const referenced = new Set(["/bucket/exercise-videos/keep"]);
  const io = makeIO([
    { path: "/bucket/exercise-videos/keep", createdAt: OLD }, // referenced
    { path: "/bucket/exercise-videos/orphan", createdAt: OLD }, // delete
    { path: "/bucket/exercise-videos/recent", createdAt: RECENT }, // too new
  ]);

  const result = await sweepFolder("prefix", referenced, CUTOFF, false, io);

  assert.equal(result.scanned, 3);
  assert.equal(result.orphans, 1);
  assert.equal(result.deleted, 1);
  assert.deepEqual(io.deletedPaths, ["/bucket/exercise-videos/orphan"]);
  assert.deepEqual(result.orphanPaths, ["/bucket/exercise-videos/orphan"]);
});

test("dryRun reports orphans without deleting anything", async () => {
  const referenced = new Set<string>();
  const io = makeIO([
    { path: "/bucket/exercise-videos/orphan-1", createdAt: OLD },
    { path: "/bucket/exercise-videos/orphan-2", createdAt: OLD },
  ]);

  const result = await sweepFolder("prefix", referenced, CUTOFF, true, io);

  assert.equal(result.orphans, 2);
  assert.equal(result.deleted, 0);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.orphanPaths.sort(), [
    "/bucket/exercise-videos/orphan-1",
    "/bucket/exercise-videos/orphan-2",
  ]);
  assert.deepEqual(io.deletedPaths, []);
});

test("a failed delete is counted as failed, not deleted, and does not abort the sweep", async () => {
  const referenced = new Set<string>();
  const objects: StoredObject[] = [
    { path: "/bucket/exercise-videos/orphan-1", createdAt: OLD },
    { path: "/bucket/exercise-videos/orphan-2", createdAt: OLD },
  ];
  const deletedPaths: string[] = [];
  const io: SweepIO = {
    async listObjects() {
      return objects;
    },
    async deleteObject(path: string) {
      if (path.endsWith("orphan-1")) throw new Error("boom");
      deletedPaths.push(path);
    },
  };

  const result = await sweepFolder("prefix", referenced, CUTOFF, false, io);

  assert.equal(result.orphans, 2);
  assert.equal(result.deleted, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(deletedPaths, ["/bucket/exercise-videos/orphan-2"]);
});

test("posters are reconciled against the poster set (not the video set)", async () => {
  // The video for this row is referenced, but its poster is an orphan.
  const referenced = referencedPaths([
    {
      video_object_path: "/bucket/exercise-videos/v1",
      poster_object_path: "/bucket/exercise-posters/p-keep",
    },
  ]);

  const posterIO = makeIO([
    { path: "/bucket/exercise-posters/p-keep", createdAt: OLD }, // referenced
    { path: "/bucket/exercise-posters/p-orphan", createdAt: OLD }, // delete
  ]);

  const result = await sweepFolder(
    "posters",
    referenced.posters,
    CUTOFF,
    false,
    posterIO
  );

  assert.equal(result.deleted, 1);
  assert.deepEqual(posterIO.deletedPaths, ["/bucket/exercise-posters/p-orphan"]);
});

test("a null poster_object_path does not protect or mis-handle unrelated poster objects", async () => {
  const referenced = referencedPaths([
    // One row with a real poster.
    {
      video_object_path: "/bucket/exercise-videos/v1",
      poster_object_path: "/bucket/exercise-posters/p-keep",
    },
    // One row with NO poster — must contribute nothing to the poster set.
    {
      video_object_path: "/bucket/exercise-videos/v2",
      poster_object_path: null,
    },
  ]);

  // The null must not appear in the set (it would be a bug if it did).
  assert.equal(referenced.posters.has("/bucket/exercise-posters/p-keep"), true);
  assert.equal(referenced.posters.size, 1);
  assert.equal(referenced.posters.has(null as any), false);

  const posterIO = makeIO([
    { path: "/bucket/exercise-posters/p-keep", createdAt: OLD }, // referenced -> keep
    { path: "/bucket/exercise-posters/p-unrelated", createdAt: OLD }, // orphan -> delete
  ]);

  const result = await sweepFolder(
    "posters",
    referenced.posters,
    CUTOFF,
    false,
    posterIO
  );

  // The unrelated poster is correctly deleted; the referenced one is kept.
  assert.equal(result.deleted, 1);
  assert.deepEqual(posterIO.deletedPaths, [
    "/bucket/exercise-posters/p-unrelated",
  ]);
});

test("referencedPaths collects every video path and skips null posters", async () => {
  const { videos, posters } = referencedPaths([
    { video_object_path: "/b/exercise-videos/a", poster_object_path: "/b/exercise-posters/a" },
    { video_object_path: "/b/exercise-videos/b", poster_object_path: null },
    { video_object_path: "/b/exercise-videos/c", poster_object_path: "/b/exercise-posters/c" },
  ]);

  assert.deepEqual([...videos].sort(), [
    "/b/exercise-videos/a",
    "/b/exercise-videos/b",
    "/b/exercise-videos/c",
  ]);
  assert.deepEqual([...posters].sort(), [
    "/b/exercise-posters/a",
    "/b/exercise-posters/c",
  ]);
});
