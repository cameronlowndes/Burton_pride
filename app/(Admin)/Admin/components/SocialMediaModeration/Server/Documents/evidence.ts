import "server-only";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const PAGE = "/Admin/SocialMediaModeration/Documents";
export const IMAGES = "moderation_evidence_images";
export const MAX_IMAGE_BYTES = 750 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const db = supabaseAdmin;

export async function evidenceAdmin() {
  if (!(await getCurrentAdmin())) return null;
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (!user || error) return null;
  const admin = await db.from("admin_users").select("id,role,is_main_admin")
    .eq("supabase_user_id", user.id).eq("is_active", true).maybeSingle();
  if (admin.error) throw new Error("Could not verify evidence access.");
  if (admin.data?.is_main_admin || admin.data?.role === "main_admin") return admin.data.id;
  return null;
}

export async function readEvidence(id: string) {
  const job = await db.from("moderation_jobs").select("id,platform,comment_id,content,received_at")
    .eq("id", id).maybeSingle();
  if (job.error) throw new Error("Could not load evidence.");
  if (!job.data) return null;

  const [decision, images] = await Promise.all([
    db.from("moderation_decisions").select("decision,reason,policy_version,reviewed_at,review_note")
      .eq("job_id", id).maybeSingle(),
    db.from(IMAGES).select("id,file_name,uploaded_at").eq("job_id", id)
      .order("uploaded_at", { ascending: false }).order("id", { ascending: false }).limit(30),
  ]);
  if (decision.error || images.error) throw new Error("Could not load evidence details.");
  return { job: job.data, decision: decision.data, images: images.data };
}

export function imageMime(bytes: Buffer) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
      bytes.toString("ascii", 12, 16) === "IHDR") return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return "image/jpeg";
  return null;
}

export const londonDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "long", timeZone: "Europe/London",
});
