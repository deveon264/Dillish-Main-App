import { requireAdmin } from "@/lib/adminAuth";
import { createExerciseVideoUploadUrl } from "@/lib/objectStorageServer";

// Hands a coach a short-lived signed PUT URL so the client can upload a video
// straight to object storage (one network hop instead of relaying every byte
// through this server). No data moves here — only a slot is reserved. The
// matching DB row is written later by /api/exercise-confirm. An abandoned slot
// leaves at most an orphaned object that the scheduled cleanup job reclaims.
export async function POST(request: Request): Promise<Response> {
  try {
    const email = await requireAdmin(request);
    if (!email) {
      return Response.json({ error: "Not authorized" }, { status: 403 });
    }
    const { uploadUrl, objectPath } = await createExerciseVideoUploadUrl();
    return Response.json({ uploadUrl, objectPath });
  } catch (e: any) {
    console.error("exercise-upload-url error:", e?.message ?? e);
    return Response.json({ error: "Could not start upload" }, { status: 500 });
  }
}
