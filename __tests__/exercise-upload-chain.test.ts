import { test } from "node:test";
import assert from "node:assert/strict";

import { ADMIN_EMAIL } from "@/constants/admin";
import { mintSessionToken } from "@/lib/adminAuth";
import { getPool } from "@/lib/db";
import { deleteObject } from "@/lib/objectStorageServer";

import { POST as uploadUrl } from "@/app/api/exercise-upload-url+api";
import { POST as confirm } from "@/app/api/exercise-confirm+api";
import { GET as listExercises, DELETE as deleteExercise } from "@/app/api/exercises+api";
import { GET as streamVideo } from "@/app/api/exercise-video+api";

// End-to-end guard for the native direct-to-storage upload chain:
//   reserve slot -> PUT bytes straight to GCS -> confirm (DB row) ->
//   row appears in the library -> /api/exercise-video 302s to GCS and serves
//   identical Range/206 bytes. Also proves an abandoned slot (PUT, no confirm)
//   leaves no DB row.
//
// Unlike the cleanup unit tests (which inject fake storage), this drives the
// REAL signed-URL signing, confirm validation, and 302->GCS redirect against
// the live object-storage sidecar and Postgres. It is therefore guarded: when
// the storage/DB env is not configured (e.g. a CI box without the sidecar) the
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

function authedJson(url: string, method: string, body: unknown, token: string): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function authedReq(url: string, method: string, token: string): Request {
  return new Request(url, { method, headers: { Authorization: `Bearer ${token}` } });
}

test(
  "full upload chain: slot -> PUT -> confirm -> library row -> 302 GCS playback with identical Range bytes",
  { skip },
  async () => {
    const token = await adminToken();
    const fixture = makeFixture();
    let exerciseId: string | null = null;
    let objectPath: string | null = null;

    try {
      // 1. Reserve a signed PUT slot. No bytes move yet — only an object path.
      const slotRes = await uploadUrl(
        authedReq("http://t/api/exercise-upload-url", "POST", token)
      );
      assert.equal(slotRes.status, 200, "slot reservation should succeed for an admin");
      const slot = await slotRes.json();
      assert.ok(typeof slot.uploadUrl === "string" && slot.uploadUrl.length > 0);
      assert.ok(typeof slot.objectPath === "string" && slot.objectPath.includes("/exercise-videos/"));
      objectPath = slot.objectPath;

      // 2. Upload the bytes straight to storage via the signed URL.
      const put = await fetch(slot.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(SIZE) },
        body: fixture,
      });
      assert.ok(put.ok, `direct PUT to signed URL should succeed (got ${put.status})`);

      // 3. Confirm: writes the exercises row pointing at the uploaded object.
      const confirmRes = await confirm(
        authedJson("http://t/api/exercise-confirm", "POST", {
          objectPath,
          title: "Upload Chain Test",
          category: "Strength",
          level: "Beginner",
          duration: "0:30",
          videoMime: "video/mp4",
          videoSize: SIZE,
        }, token)
      );
      assert.equal(confirmRes.status, 200, "confirm should succeed");
      const confirmed = await confirmRes.json();
      assert.ok(confirmed.item?.id, "confirm should return the new exercise id");
      exerciseId = confirmed.item.id;
      assert.equal(confirmed.item.videoSize, SIZE);

      // 4. The row appears in the library with the correct video_size.
      const listRes = await listExercises(new Request("http://t/api/exercises", { method: "GET" }));
      assert.equal(listRes.status, 200);
      const list = await listRes.json();
      const found = (list.items as any[]).find((it) => it.id === exerciseId);
      assert.ok(found, "the confirmed exercise should appear in GET /api/exercises");
      assert.equal(found.videoSize, SIZE, "library row should report the uploaded byte count");

      // 5. /api/exercise-video resolves to a 302 redirect to GCS.
      const videoRes = await streamVideo(
        new Request(`http://t/api/exercise-video?id=${exerciseId}`, { method: "GET" })
      );
      assert.equal(videoRes.status, 302, "exercise-video should redirect");
      const location = videoRes.headers.get("Location") ?? "";
      assert.match(location, /^https:\/\//, "redirect target should be an absolute https URL");
      assert.match(location, /googleapis\.com/, "redirect should point at Google Cloud Storage");

      // 6. The GCS URL serves a Range request as 206 with bytes identical to
      //    the corresponding slice of the original upload.
      const rangeRes = await fetch(location, { headers: { Range: "bytes=100-199" } });
      assert.equal(rangeRes.status, 206, "GCS should honor the Range request with 206");
      const rangeBytes = Buffer.from(await rangeRes.arrayBuffer());
      assert.equal(rangeBytes.length, 100);
      assert.ok(rangeBytes.equals(fixture.subarray(100, 200)), "Range bytes must match the upload");

      // 7. A full fetch returns every byte exactly as uploaded.
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
      } else if (objectPath) {
        await deleteObject(objectPath).catch(() => {});
      }
    }
  }
);

test(
  "an abandoned slot (PUT without confirm) writes no DB row",
  { skip },
  async () => {
    const token = await adminToken();
    const fixture = makeFixture();
    let objectPath: string | null = null;

    try {
      // Reserve a slot and upload bytes, but never call confirm.
      const slotRes = await uploadUrl(
        authedReq("http://t/api/exercise-upload-url", "POST", token)
      );
      assert.equal(slotRes.status, 200);
      const slot = await slotRes.json();
      objectPath = slot.objectPath;

      const put = await fetch(slot.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(SIZE) },
        body: fixture,
      });
      assert.ok(put.ok, `direct PUT should succeed (got ${put.status})`);

      // No confirm => no exercises row should reference this object.
      const { rows } = await getPool().query(
        "SELECT id FROM exercises WHERE video_object_path = $1",
        [objectPath]
      );
      assert.equal(rows.length, 0, "an abandoned slot must not create a DB row");
    } finally {
      // The orphaned object would normally be reclaimed by the scheduled
      // cleanup sweep; remove it now so the test leaves nothing behind.
      if (objectPath) await deleteObject(objectPath).catch(() => {});
    }
  }
);
