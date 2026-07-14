import { test } from "node:test";
import assert from "node:assert/strict";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";
import { getPool } from "@/lib/db";
import { deleteObject } from "@/lib/objectStorageServer";

import {
  POST as uploadExercise,
  GET as listExercises,
  DELETE as deleteExercise,
} from "@/app/api/exercises+api";
import { GET as streamVideo } from "@/app/api/exercise-video+api";

// End-to-end guard for the exercise upload chain:
//   POST raw video bytes -> exercises row written -> row appears in the
//   library -> /api/exercise-video 302s to GCS and serves identical Range/206
//   bytes. The video is sent as the raw request body (not multipart) with the
//   text metadata carried in query params, exactly as the native/web clients do.
//
// Unlike the cleanup unit tests (which inject fake storage), this drives the
// REAL streamed upload, signed-URL signing, and 302->GCS redirect against the
// live object-storage sidecar and Postgres. It is therefore guarded: when the
// storage/DB env is not configured (e.g. a CI box without the sidecar) the
// tests are skipped rather than failing.
const hasEnv = !!(
  process.env.DATABASE_URL &&
  process.env.PRIVATE_OBJECT_DIR &&
  process.env.SESSION_SECRET
);
const skip = hasEnv ? false : "object-storage/DB env unavailable";

// A small but non-trivial binary payload with a deterministic pattern so Range
// slices can be compared byte-for-byte against the original upload.
const SIZE = 64 * 1024;
function makeFixture(): Buffer {
  const buf = Buffer.alloc(SIZE);
  for (let i = 0; i < SIZE; i++) buf[i] = (i * 31 + 7) & 0xff;
  return buf;
}

async function adminToken(): Promise<string> {
  const { token } = await mintSessionToken({
    sub: "test-admin",
    email: ADMIN_EMAIL,
    isAdmin: true,
  });
  return token;
}

// POSTs the raw video bytes with metadata in the query string. A Buffer is a
// valid BodyInit at runtime (undici accepts ArrayBufferView), but the DOM lib's
// BodyInit type omits it, so narrow the cast here.
function uploadReq(url: string, bytes: Buffer, token: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.byteLength),
      Authorization: `Bearer ${token}`,
    },
    body: bytes as unknown as BodyInit,
  });
}

function authedReq(url: string, method: string, token: string): Request {
  return new Request(url, { method, headers: { Authorization: `Bearer ${token}` } });
}

test(
  "full upload chain: POST bytes -> library row -> 302 GCS playback with identical Range bytes",
  { skip },
  async () => {
    const token = await adminToken();
    const fixture = makeFixture();
    let exerciseId: string | null = null;

    try {
      // 1. Upload: streams the bytes straight to storage and writes the row.
      const params = new URLSearchParams({
        title: "Upload Chain Test",
        category: "Strength",
        level: "Beginner",
        duration: "0:30",
      });
      const uploadRes = await uploadExercise(
        uploadReq(`http://t/api/exercises?${params}`, fixture, token)
      );
      assert.equal(uploadRes.status, 200, "upload should succeed for an admin");
      const uploaded = await uploadRes.json();
      assert.ok(uploaded.item?.id, "upload should return the new exercise id");
      exerciseId = uploaded.item.id;
      assert.equal(uploaded.item.videoSize, SIZE);

      // 2. The row appears in the library with the correct video_size.
      const listRes = await listExercises(new Request("http://t/api/exercises", { method: "GET" }));
      assert.equal(listRes.status, 200);
      const list = await listRes.json();
      const found = (list.items as any[]).find((it) => it.id === exerciseId);
      assert.ok(found, "the uploaded exercise should appear in GET /api/exercises");
      assert.equal(found.videoSize, SIZE, "library row should report the uploaded byte count");

      // 3. /api/exercise-video resolves to a 302 redirect to GCS.
      const videoRes = await streamVideo(
        new Request(`http://t/api/exercise-video?id=${exerciseId}`, { method: "GET" })
      );
      assert.equal(videoRes.status, 302, "exercise-video should redirect");
      const location = videoRes.headers.get("Location") ?? "";
      assert.match(location, /^https:\/\//, "redirect target should be an absolute https URL");
      assert.match(location, /googleapis\.com/, "redirect should point at Google Cloud Storage");

      // 4. The GCS URL serves a Range request as 206 with bytes identical to
      //    the corresponding slice of the original upload.
      const rangeRes = await fetch(location, { headers: { Range: "bytes=100-199" } });
      assert.equal(rangeRes.status, 206, "GCS should honor the Range request with 206");
      const rangeBytes = Buffer.from(await rangeRes.arrayBuffer());
      assert.equal(rangeBytes.length, 100);
      assert.ok(rangeBytes.equals(fixture.subarray(100, 200)), "Range bytes must match the upload");

      // 5. A full fetch returns every byte exactly as uploaded.
      const fullRes = await fetch(location);
      assert.ok(fullRes.ok, `full download should succeed (got ${fullRes.status})`);
      const fullBytes = Buffer.from(await fullRes.arrayBuffer());
      assert.equal(fullBytes.length, SIZE);
      assert.ok(fullBytes.equals(fixture), "downloaded bytes must be identical to the upload");
    } finally {
      // Clean up the DB row + storage object created by this test.
      if (exerciseId) {
        await deleteExercise(
          authedReq(`http://t/api/exercises?id=${exerciseId}`, "DELETE", token)
        ).catch(() => {});
      }
    }
  }
);

test(
  "a move-keyed upload resolves for its own workout, other workouts via moveIds, and stays out of the library",
  { skip },
  async () => {
    const token = await adminToken();
    const fixture = makeFixture();
    let exerciseId: string | null = null;

    try {
      const params = new URLSearchParams({
        title: "Move Reuse Test",
        category: "Strength",
        level: "Beginner",
        duration: "0:30",
        workoutId: "full-body-sculpt",
        exerciseId: "sc1",
        moveId: "bodyweightSquat",
      });
      const uploadRes = await uploadExercise(
        uploadReq(`http://t/api/exercises?${params}`, fixture, token)
      );
      assert.equal(uploadRes.status, 200);
      const uploaded = await uploadRes.json();
      exerciseId = uploaded.item.id;
      assert.equal(uploaded.item.moveId, "bodyweightSquat", "POST should echo the moveId");

      // Visible when fetching its own workout's clips.
      const ownRes = await listExercises(
        new Request("http://t/api/exercises?workoutId=full-body-sculpt", { method: "GET" })
      );
      const own = await ownRes.json();
      assert.ok(
        (own.items as any[]).some((it) => it.id === exerciseId),
        "clip should be returned for its own workout"
      );

      // Visible from a DIFFERENT workout that shares the move, via moveIds.
      const reuseRes = await listExercises(
        new Request(
          "http://t/api/exercises?workoutId=beginner-fat-burn&moveIds=marchInPlace,bodyweightSquat",
          { method: "GET" }
        )
      );
      const reuse = await reuseRes.json();
      const reused = (reuse.items as any[]).find((it) => it.id === exerciseId);
      assert.ok(reused, "clip should be returned for another workout sharing the move");
      assert.equal(reused.moveId, "bodyweightSquat", "GET should carry the moveId through");

      // The generic library (no params) must not show workout-tied uploads.
      const libRes = await listExercises(new Request("http://t/api/exercises", { method: "GET" }));
      const lib = await libRes.json();
      assert.ok(
        !(lib.items as any[]).some((it) => it.id === exerciseId),
        "workout-tied clip must stay out of the generic library"
      );
    } finally {
      if (exerciseId) {
        await deleteExercise(
          authedReq(`http://t/api/exercises?id=${exerciseId}`, "DELETE", token)
        ).catch(() => {});
      }
    }
  }
);

test(
  "an oversized upload is rejected and leaves no DB row",
  { skip },
  async () => {
    const token = await adminToken();

    // Declare a Content-Length above the 80MB cap so the upload is refused by
    // the early header check, before any bytes are streamed.
    const oversized = 81 * 1024 * 1024;
    const req = new Request("http://t/api/exercises?title=Too+Big", {
      method: "POST",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(oversized),
        Authorization: `Bearer ${token}`,
      },
      body: makeFixture() as unknown as BodyInit,
    });
    const res = await uploadExercise(req);
    assert.equal(res.status, 413, "an oversized upload must be rejected");

    // The refused upload must not have created any exercises row.
    const { rows } = await getPool().query(
      "SELECT id FROM exercises WHERE title = $1",
      ["Too Big"]
    );
    assert.equal(rows.length, 0, "a rejected upload must not create a DB row");
  }
);
