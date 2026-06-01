import { requireAdmin } from "@/lib/adminAuth";
import { createExerciseVideoUploadUrl } from "@/lib/objectStorageServer";

// DEPRECATED — NOT CALLED BY THE CLIENT. This was the first step of the native
// direct-to-storage upload flow: it handed a coach a short-lived signed PUT URL
// so the client could upload a video straight to object storage. That path was
// reverted because the Replit Object Storage sidecar's signed-URL endpoint is
// not reliably available in this environment, so it threw a 500 before any
// bytes transferred. Native now relays bytes through POST /api/exercises like
// web (see lib/exercises.ts). Kept only so the route isn't mistaken for active;
// it can be deleted once the direct-to-storage path is revisited.
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
