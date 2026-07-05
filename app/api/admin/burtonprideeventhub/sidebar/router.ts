import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CurrentAdmin = Awaited<ReturnType<typeof getCurrentAdmin>>;

type CurrentAdminWithPermissions = NonNullable<CurrentAdmin> & {
  permissions?: string[] | null;
};

function getAdminPermissions(admin: CurrentAdmin): string[] {
  if (!admin) return [];

  const adminWithPermissions = admin as CurrentAdminWithPermissions;

  return Array.isArray(adminWithPermissions.permissions)
    ? adminWithPermissions.permissions
    : [];
}

function hasEventHubAccess(admin: CurrentAdmin) {
  if (!admin) return false;
  if (!admin.is_active) return false;

  if (admin.role === "main_admin") return true;

  const permissions = getAdminPermissions(admin);

  return (
    permissions.includes("event_hub:view") ||
    permissions.includes("money:view") ||
    permissions.includes("admin:dashboard:view")
  );
}

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You must be signed in to view the Burton Pride Event Hub menu.",
        },
        { status: 401 },
      );
    }

    if (!hasEventHubAccess(admin)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You do not have permission to view the Burton Pride Event Hub menu.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      source: "sidebar-fallback",
      usingFallback: true,
      items: [],
    });
  } catch (error: unknown) {
    console.error("Event Hub sidebar API crashed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "The Burton Pride Event Hub sidebar API crashed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}