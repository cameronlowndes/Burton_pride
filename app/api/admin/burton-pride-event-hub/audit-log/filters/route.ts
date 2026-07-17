import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import {
  actorHasPermission,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/event-hub-app/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventCatalogueRow = {
  id: string;
  event_name: string | null;
  event_year: number | null;
  event_date: string | null;
  is_active: boolean | null;
  is_archived: boolean | null;
};

type AdminCatalogueRow = {
  admin_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  admin_role: string | null;
};

type ActionCatalogueRow = {
  action: string | null;
  action_label: string | null;
};

type AreaCatalogueRow = {
  area: string | null;
};

function uniqueBy<T>(
  items: T[],
  getKey: (item: T) => string | null | undefined,
): T[] {
  const result = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item)?.trim();

    if (!key || result.has(key)) {
      continue;
    }

    result.set(key, item);
  }

  return Array.from(result.values());
}

function normaliseText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export async function GET() {
  try {
    const actor = await requireEventAuditPermission("event_audit:view");

    const canViewAllEvents = actorHasPermission(
      actor,
      "event_audit:view_all_events",
    );

    const canViewSecurity = actorHasPermission(
      actor,
      "event_audit:view_security",
    );

    /*
     * EVENT CATALOGUE
     *
     * Admins with event_audit:view_all_events can see every event.
     * Other admins can only select the active event.
     */
    let eventsQuery = supabaseAdmin
      .from("burton_pride_events")
      .select(
        "id,event_name,event_year,event_date,is_active,is_archived",
      )
      .order("event_year", {
        ascending: false,
        nullsFirst: false,
      })
      .order("event_date", {
        ascending: false,
        nullsFirst: false,
      });

    if (!canViewAllEvents) {
      eventsQuery = eventsQuery
        .eq("is_active", true)
        .eq("is_archived", false);
    }

    /*
     * ADMIN CATALOGUE
     */
    let adminsQuery = supabaseAdmin
      .from("event_audit_logs")
      .select("admin_id,admin_name,admin_email,admin_role")
      .not("admin_id", "is", null)
      .order("admin_name", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(2000);

    /*
     * ACTION CATALOGUE
     */
    let actionsQuery = supabaseAdmin
      .from("event_audit_logs")
      .select("action,action_label")
      .not("action", "is", null)
      .order("action_label", {
        ascending: true,
        nullsFirst: false,
      })
      .order("action", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(5000);

    /*
     * AREA CATALOGUE
     */
    let areasQuery = supabaseAdmin
      .from("event_audit_logs")
      .select("area")
      .not("area", "is", null)
      .order("area", {
        ascending: true,
        nullsFirst: false,
      })
      .limit(5000);

    /*
     * Hide security audit entries from admins who do not have the
     * event_audit:view_security permission.
     *
     * NULL is included because older audit records may not have the
     * is_security_event value populated.
     */
    if (!canViewSecurity) {
      const securityFilter =
        "is_security_event.eq.false,is_security_event.is.null";

      adminsQuery = adminsQuery.or(securityFilter);
      actionsQuery = actionsQuery.or(securityFilter);
      areasQuery = areasQuery.or(securityFilter);
    }

    const [
      eventsResult,
      adminsResult,
      actionsResult,
      areasResult,
    ] = await Promise.all([
      eventsQuery,
      adminsQuery,
      actionsQuery,
      areasQuery,
    ]);

    if (eventsResult.error) {
      console.error(
        "Event audit catalogue events query failed:",
        eventsResult.error,
      );

      throw eventsResult.error;
    }

    if (adminsResult.error) {
      console.error(
        "Event audit catalogue admins query failed:",
        adminsResult.error,
      );

      throw adminsResult.error;
    }

    if (actionsResult.error) {
      console.error(
        "Event audit catalogue actions query failed:",
        actionsResult.error,
      );

      throw actionsResult.error;
    }

    if (areasResult.error) {
      console.error(
        "Event audit catalogue areas query failed:",
        areasResult.error,
      );

      throw areasResult.error;
    }

    const events = (eventsResult.data ?? []) as EventCatalogueRow[];
    const adminRows = (adminsResult.data ?? []) as AdminCatalogueRow[];
    const actionRows = (actionsResult.data ?? []) as ActionCatalogueRow[];
    const areaRows = (areasResult.data ?? []) as AreaCatalogueRow[];

    const admins = uniqueBy(adminRows, (row) => row.admin_id)
      .map((row) => ({
        admin_id: normaliseText(row.admin_id),
        admin_name:
          normaliseText(row.admin_name) ||
          normaliseText(row.admin_email) ||
          "Unknown administrator",
        admin_email: normaliseText(row.admin_email),
        admin_role: normaliseText(row.admin_role),
      }))
      .sort((first, second) =>
        first.admin_name.localeCompare(second.admin_name),
      );

    const actions = uniqueBy(actionRows, (row) => row.action)
      .map((row) => ({
        action: normaliseText(row.action),
        action_label:
          normaliseText(row.action_label) ||
          normaliseText(row.action),
      }))
      .filter((row) => row.action.length > 0)
      .sort((first, second) =>
        first.action_label.localeCompare(second.action_label),
      );

    const areas = Array.from(
      new Set(
        areaRows
          .map((row) => normaliseText(row.area))
          .filter(Boolean),
      ),
    ).sort((first, second) => first.localeCompare(second));

    return noStoreJson({
      ok: true,
      events,
      admins,
      actions,
      areas,
      permissions: {
        canViewAllEvents,
        canViewSecurity,
      },

      // Kept for compatibility with existing frontend code.
      canViewAllEvents,
      canViewSecurity,
    });
  } catch (error) {
    console.error("Event audit catalogue API failed:", error);

    return eventAuditApiError(error);
  }
}