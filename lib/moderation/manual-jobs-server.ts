import "server-only";
import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import type { ManualSummary } from "./manual-job-input";
export async function manualAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin?.security_session_id) return null;
  const { data, error } = await supabaseAdmin.rpc("moderation_manual_access", {
    p_admin: admin.id,
    p_session: admin.security_session_id,
  });
  if (error)
    throw new Error(
      "Manual jobs are unavailable. Install the manual-jobs SQL update and try again.",
    );
  return data?.result === "ok" ? admin : null;
}
export async function manualSummaries(ids: string[]) {
  if (!ids.length)
    return { adminId: "", items: [] as ManualSummary[], error: "" };
  try {
    const admin = await manualAdmin();
    if (!admin)
      return {
        adminId: "",
        items: [] as ManualSummary[],
        error: "Manual details require an active Main Admin security session.",
      };
    const { data, error } = await supabaseAdmin.rpc(
      "moderation_manual_summaries",
      { p_admin: admin.id, p_session: admin.security_session_id, p_jobs: ids },
    );
    if (error || data?.result !== "ok")
      throw new Error(
        "Manual capture details could not be loaded. Refresh the page to try again.",
      );
    return {
      adminId: admin.id,
      items: data.items as ManualSummary[],
      error: "",
    };
  } catch (e) {
    return {
      adminId: "",
      items: [] as ManualSummary[],
      error:
        e instanceof Error ? e.message : "Manual details could not be loaded.",
    };
  }
}
export { supabaseAdmin as manualDb };
