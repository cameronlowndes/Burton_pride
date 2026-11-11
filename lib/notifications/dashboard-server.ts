import "server-only";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  safeAdminPath,
  type DashboardCategory,
  type Priority,
} from "./dashboard";

/** Call from an authorised server action after the business operation succeeds.
 * For atomic capture, call admin_dashboard_notification_publish inside the same DB transaction.
 * Never expose this helper as a general browser notification-creation endpoint. */
export async function publishDashboardNotification(input: {
  eventKey: string;
  category: DashboardCategory;
  recipients: string[];
  title: string;
  message: string;
  destination: string;
  priority?: Priority;
  requiredPermission?: string;
}) {
  if (!safeAdminPath(input.destination))
    throw new Error("Use an internal Admin destination.");
  const { data, error } = await supabaseAdmin.rpc(
    "admin_dashboard_notification_publish",
    {
      p_event_key: input.eventKey,
      p_category: input.category,
      p_recipients: input.recipients,
      p_title: input.title,
      p_message: input.message,
      p_destination: input.destination,
      p_priority: input.priority ?? "routine",
      p_permission: input.requiredPermission ?? "admin:dashboard:view",
    },
  );
  if (error)
    throw new Error(
      `Dashboard notification could not be saved (${error.code}).`,
    );
  return data as string;
}
