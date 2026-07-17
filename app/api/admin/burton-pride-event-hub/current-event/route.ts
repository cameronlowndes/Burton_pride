import { getActiveBurtonPrideEvent } from "@/lib/event-hub-app/server";
import {
  createEventAuditLog,
  eventAuditApiError,
  noStoreJson,
  requireEventAuditPermission,
} from "@/lib/event-hub-app/event-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_PERMISSION = "event_audit:view";

type AuditActor = Awaited<
  ReturnType<typeof requireEventAuditPermission>
>;

type AuditInput = Parameters<
  typeof createEventAuditLog
>[0];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return clean(
      (error as { message?: unknown }).message,
    ).slice(0, 500);
  }

  return "Failed to load the active event.";
}

async function writeAuditSafely(
  input: AuditInput,
): Promise<boolean> {
  try {
    await createEventAuditLog(input);
    return true;
  } catch (auditError) {
    console.error(
      "Active event audit write failed:",
      auditError,
    );

    return false;
  }
}

export async function GET(request: Request) {
  let actor: AuditActor | null = null;

  try {
    /*
     * This obtains a trusted administrator and confirms access.
     *
     * Replace event_audit:view with your dedicated Event Hub
     * viewing permission when one exists, such as:
     *
     * event_hub:view
     */
    actor = await requireEventAuditPermission(
      REQUIRED_PERMISSION,
    );

    const event = await getActiveBurtonPrideEvent();

    return noStoreJson({
      ok: true,
      event,
      refreshed_at: new Date().toISOString(),
    });
  } catch (error) {
    const response = eventAuditApiError(error);

    /*
     * Only failures are logged.
     *
     * Successful active-event requests are not logged because this
     * endpoint may run whenever the Event Hub loads or refreshes.
     */
    if (actor) {
      await writeAuditSafely({
        actor,
        eventId: null,

        action: "event.active_event_load_failed",
        actionLabel: "Active event failed to load",

        area: "events",
        status: "failed",
        riskLevel: "low",

        record: {
          type: "burton_pride_event",
          id: "active-event",
          title: "Active Burton Pride event",
        },

        metadata: {
          source: "active_burton_pride_event_api",
          operation: "load_active_event",
          error_message: safeErrorMessage(error),
        },

        request,
        responseStatus: response.status,
      });
    }

    return response;
  }
}