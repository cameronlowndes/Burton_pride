import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SavingTargetPayload = {
  id?: string | null;
  year?: string | number | null;
  target_name?: string | null;
  target_amount_pence?: number | null;
  saved_amount_pence?: number | null;
  months_to_save?: number | null;
  notes?: string | null;
  action?: "restore" | "update" | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanOptionalText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function cleanMoneyPence(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount);
}

function cleanMonths(value: unknown) {
  const months = Number(value || 1);
  if (!Number.isFinite(months) || months < 1) return 1;
  return Math.round(months);
}

function getDisplayName(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return "Unknown user";

  const fullName = `${user.firstName || ""} ${user.lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  if (fullName) return fullName;

  const email = user.emailAddresses?.[0]?.emailAddress || "";

  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  return "Unknown user";
}

function getPrimaryEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.emailAddresses?.[0]?.emailAddress || null;
}

async function getActor() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      ),
    };
  }

  const user = await currentUser();

  return {
    ok: true as const,
    userId,
    name: getDisplayName(user),
    email: getPrimaryEmail(user),
  };
}

async function createAuditLog(payload: {
  actorName: string;
  actorEmail: string | null;
  action: string;
  targetId?: string | null;
  targetName?: string | null;
  beforeData?: any;
  afterData?: any;
  changedFields?: any;
  metadata?: any;
}) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/admin/money/audit-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: payload.action,
        transactionId: payload.targetId || null,
        transaction_id: payload.targetId || null,
        transactionTitle: payload.targetName || "Saving target",
        transaction_title: payload.targetName || "Saving target",
        createdBy: payload.actorName,
        created_by: payload.actorName,
        createdByEmail: payload.actorEmail,
        created_by_email: payload.actorEmail,
        beforeData: payload.beforeData || null,
        before_data: payload.beforeData || null,
        afterData: payload.afterData || null,
        after_data: payload.afterData || null,
        changedFields: payload.changedFields || null,
        changed_fields: payload.changedFields || null,
        metadata: {
          area: "saving_targets",
          source: "money_saving_targets_api",
          actor_name: payload.actorName,
          actor_email: payload.actorEmail,
          ...(payload.metadata || {}),
        },
      }),
    }).catch(() => null);
  } catch {
    // Do not block saving targets if audit logging fails.
  }
}

function getChangedFields(beforeData: any, afterData: any) {
  const fields = [
    "year",
    "target_name",
    "target_amount_pence",
    "saved_amount_pence",
    "months_to_save",
    "notes",
    "deleted_at",
    "deleted_by",
    "deleted_by_email",
    "deleted_by_user_id",
  ];

  return fields.filter((field) => {
    const beforeValue = beforeData?.[field] ?? null;
    const afterValue = afterData?.[field] ?? null;
    return String(beforeValue) !== String(afterValue);
  });
}

function apiError(error: any, message: string, status = 500) {
  console.error(message, error);

  return NextResponse.json(
    {
      error: message,
      details: error?.message || String(error || ""),
      hint:
        "Check the money_saving_targets table has all columns including deleted_at, deleted_by, deleted_by_email, deleted_by_user_id.",
    },
    { status },
  );
}

async function readJsonBody(request: Request) {
  const text = await request.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function findSavingTargetById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("money_saving_targets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return {
    data,
    error,
  };
}

export async function GET(request: Request) {
  const actor = await getActor();

  if (!actor.ok) {
    return actor.response;
  }

  const { searchParams } = new URL(request.url);
  const year = cleanText(searchParams.get("year"));
  const includeDeleted =
    searchParams.get("includeDeleted") === "true" ||
    searchParams.get("include_deleted") === "true";
  const deletedOnly =
    searchParams.get("deletedOnly") === "true" ||
    searchParams.get("deleted_only") === "true";

  let query = supabaseAdmin
    .from("money_saving_targets")
    .select("*")
    .order("created_at", { ascending: true });

  if (year) {
    query = query.eq("year", year);
  }

  if (deletedOnly) {
    query = query.not("deleted_at", "is", null);
  } else if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) {
    return apiError(error, "Failed to load saving targets.");
  }

  return NextResponse.json({
    targets: data || [],
    includeDeleted,
    deletedOnly,
  });
}

export async function POST(request: Request) {
  const actor = await getActor();

  if (!actor.ok) {
    return actor.response;
  }

  const payload = (await readJsonBody(request)) as SavingTargetPayload | null;

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid saving target payload." },
      { status: 400 },
    );
  }

  const year = cleanText(payload.year);
  const targetName = cleanText(payload.target_name);

  if (!year) {
    return NextResponse.json({ error: "Year is required." }, { status: 400 });
  }

  if (!targetName) {
    return NextResponse.json(
      { error: "Saving target name is required." },
      { status: 400 },
    );
  }

  const insertData = {
    year,
    target_name: targetName,
    target_amount_pence: cleanMoneyPence(payload.target_amount_pence),
    saved_amount_pence: cleanMoneyPence(payload.saved_amount_pence),
    months_to_save: cleanMonths(payload.months_to_save),
    notes: cleanOptionalText(payload.notes),
    created_by: actor.name,
    created_by_email: actor.email,
    created_by_user_id: actor.userId,
    updated_by: actor.name,
    updated_by_email: actor.email,
    updated_by_user_id: actor.userId,
    deleted_at: null,
    deleted_by: null,
    deleted_by_email: null,
    deleted_by_user_id: null,
  };

  const { data, error } = await supabaseAdmin
    .from("money_saving_targets")
    .insert(insertData)
    .select("*")
    .single();

  if (error) {
    return apiError(error, "Failed to create saving target.");
  }

  await createAuditLog({
    actorName: actor.name,
    actorEmail: actor.email,
    action: "saving_target_create",
    targetId: data?.id || null,
    targetName,
    beforeData: null,
    afterData: data,
    changedFields: Object.keys(insertData),
    metadata: {
      year,
      target_name: targetName,
    },
  });

  return NextResponse.json({
    target: data,
  });
}

export async function PATCH(request: Request) {
  const actor = await getActor();

  if (!actor.ok) {
    return actor.response;
  }

  const payload = (await readJsonBody(request)) as SavingTargetPayload | null;

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid saving target payload." },
      { status: 400 },
    );
  }

  const id = cleanText(payload.id);

  if (!id) {
    return NextResponse.json(
      { error: "Saving target ID is required." },
      { status: 400 },
    );
  }

  const { data: existingTarget, error: existingError } =
    await findSavingTargetById(id);

  if (existingError) {
    return apiError(existingError, "Failed to find saving target.");
  }

  if (!existingTarget) {
    return NextResponse.json(
      {
        error: "Saving target not found.",
        details:
          "No saving target exists with this ID. This can happen if an old local browser-only target is being edited. Create/save it again as a new database target.",
        id,
      },
      { status: 404 },
    );
  }

  if (payload.action === "restore") {
    const restoreData = {
      deleted_at: null,
      deleted_by: null,
      deleted_by_email: null,
      deleted_by_user_id: null,
      updated_by: actor.name,
      updated_by_email: actor.email,
      updated_by_user_id: actor.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("money_saving_targets")
      .update(restoreData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return apiError(error, "Failed to restore saving target.");
    }

    await createAuditLog({
      actorName: actor.name,
      actorEmail: actor.email,
      action: "saving_target_restore",
      targetId: id,
      targetName: data?.target_name || existingTarget.target_name,
      beforeData: existingTarget,
      afterData: data,
      changedFields: getChangedFields(existingTarget, data),
      metadata: {
        year: data?.year || existingTarget.year,
        target_name: data?.target_name || existingTarget.target_name,
        restored: true,
      },
    });

    return NextResponse.json({
      target: data,
      restored: true,
    });
  }

  if (existingTarget.deleted_at) {
    return NextResponse.json(
      {
        error: "This saving target is deleted.",
        details:
          "Restore this saving target before editing it, or create a new saving target.",
      },
      { status: 409 },
    );
  }

  const updateData: Record<string, any> = {
    updated_by: actor.name,
    updated_by_email: actor.email,
    updated_by_user_id: actor.userId,
    updated_at: new Date().toISOString(),
  };

  if (payload.year !== undefined) {
    updateData.year = cleanText(payload.year);
  }

  if (payload.target_name !== undefined) {
    updateData.target_name = cleanText(payload.target_name);
  }

  if (payload.target_amount_pence !== undefined) {
    updateData.target_amount_pence = cleanMoneyPence(
      payload.target_amount_pence,
    );
  }

  if (payload.saved_amount_pence !== undefined) {
    updateData.saved_amount_pence = cleanMoneyPence(
      payload.saved_amount_pence,
    );
  }

  if (payload.months_to_save !== undefined) {
    updateData.months_to_save = cleanMonths(payload.months_to_save);
  }

  if (payload.notes !== undefined) {
    updateData.notes = cleanOptionalText(payload.notes);
  }

  if (!updateData.year && existingTarget.year) {
    updateData.year = existingTarget.year;
  }

  if (!updateData.target_name && existingTarget.target_name) {
    updateData.target_name = existingTarget.target_name;
  }

  if (!updateData.year) {
    return NextResponse.json({ error: "Year is required." }, { status: 400 });
  }

  if (!updateData.target_name) {
    return NextResponse.json(
      { error: "Saving target name is required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("money_saving_targets")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return apiError(error, "Failed to update saving target.");
  }

  await createAuditLog({
    actorName: actor.name,
    actorEmail: actor.email,
    action: "saving_target_update",
    targetId: id,
    targetName: data?.target_name || existingTarget.target_name,
    beforeData: existingTarget,
    afterData: data,
    changedFields: getChangedFields(existingTarget, data),
    metadata: {
      year: data?.year || existingTarget.year,
      target_name: data?.target_name || existingTarget.target_name,
    },
  });

  return NextResponse.json({
    target: data,
  });
}

export async function DELETE(request: Request) {
  const actor = await getActor();

  if (!actor.ok) {
    return actor.response;
  }

  const { searchParams } = new URL(request.url);
  const idFromQuery = cleanText(searchParams.get("id"));

  const body = await readJsonBody(request);
  const idFromBody = cleanText(body?.id);

  const id = idFromQuery || idFromBody;

  if (!id) {
    return NextResponse.json(
      {
        error: "Saving target ID is required.",
        details:
          "The delete request did not include ?id=TARGET_ID or a JSON body with id.",
      },
      { status: 400 },
    );
  }

  const { data: existingTarget, error: existingError } =
    await findSavingTargetById(id);

  if (existingError) {
    return apiError(existingError, "Failed to find saving target.");
  }

  /**
   * Important fix:
   * If a target is already gone/not found, return success instead of throwing
   * Supabase's “Cannot coerce the result to a single JSON object”.
   * The UI can then remove it from screen and carry on.
   */
  if (!existingTarget) {
    return NextResponse.json({
      target: null,
      deleted: true,
      softDeleted: false,
      notFound: true,
      id,
      message:
        "Saving target was not found in the database. It has been removed from the page state.",
    });
  }

  if (existingTarget.deleted_at) {
    return NextResponse.json({
      target: existingTarget,
      deleted: true,
      softDeleted: true,
      alreadyDeleted: true,
      id,
      message: "This saving target was already soft deleted.",
    });
  }

  const deleteData = {
    deleted_at: new Date().toISOString(),
    deleted_by: actor.name,
    deleted_by_email: actor.email,
    deleted_by_user_id: actor.userId,
    updated_by: actor.name,
    updated_by_email: actor.email,
    updated_by_user_id: actor.userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("money_saving_targets")
    .update(deleteData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return apiError(error, "Failed to soft delete saving target.");
  }

  await createAuditLog({
    actorName: actor.name,
    actorEmail: actor.email,
    action: "saving_target_soft_delete",
    targetId: id,
    targetName: existingTarget.target_name,
    beforeData: existingTarget,
    afterData: data,
    changedFields: getChangedFields(existingTarget, data),
    metadata: {
      year: existingTarget.year,
      target_name: existingTarget.target_name,
      soft_delete: true,
    },
  });

  return NextResponse.json({
    target: data,
    deleted: true,
    softDeleted: true,
    id,
  });
}
