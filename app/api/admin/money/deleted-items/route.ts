import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAVING_TARGET_TABLE = "money_saving_targets";

/**
 * Put your real budget tracker table name first.
 * If your budget planning table is called something else, add it here.
 */
const POSSIBLE_BUDGET_TABLES = [
  "money_budget_items",
  "money_budget_planning",
  "money_budget_categories",
  "money_budget_tracker",
  "money_budget_rows",
];

type DeletedItemType = "saving_target" | "budget_item";

function cleanText(value: unknown) {
  return String(value || "").trim();
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
        {
          error: "You must be signed in.",
          details: "Clerk did not return a userId for this request.",
        },
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
  itemId?: string | null;
  itemTitle?: string | null;
  beforeData?: any;
  afterData?: any;
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
        transactionId: payload.itemId || null,
        transaction_id: payload.itemId || null,
        transactionTitle: payload.itemTitle || "Deleted item",
        transaction_title: payload.itemTitle || "Deleted item",
        createdBy: payload.actorName,
        created_by: payload.actorName,
        createdByEmail: payload.actorEmail,
        created_by_email: payload.actorEmail,
        beforeData: payload.beforeData || null,
        before_data: payload.beforeData || null,
        afterData: payload.afterData || null,
        after_data: payload.afterData || null,
        metadata: {
          area: "deleted_items",
          source: "money_deleted_items_page",
          actor_name: payload.actorName,
          actor_email: payload.actorEmail,
          ...(payload.metadata || {}),
        },
      }),
    }).catch(() => null);
  } catch {
    // Do not block restore if audit logging fails.
  }
}

function serverError(message: string, details: string, status = 500, extra?: any) {
  return NextResponse.json(
    {
      error: message,
      details,
      hint:
        "Check app/api/admin/money/deleted-items/route.ts exists and your Supabase tables have soft-delete columns.",
      ...(extra || {}),
    },
    { status },
  );
}

async function findWorkingBudgetTable() {
  const errors: string[] = [];

  for (const table of POSSIBLE_BUDGET_TABLES) {
    const { error } = await supabaseAdmin.from(table).select("id").limit(1);

    if (!error) {
      return {
        table,
        errors,
      };
    }

    errors.push(`${table}: ${error.message}`);
  }

  return {
    table: null,
    errors,
  };
}

async function loadDeletedBudgetItems(year: string) {
  const tableResult = await findWorkingBudgetTable();

  if (!tableResult.table) {
    return {
      table: null,
      items: [],
      warning:
        "No budget tracker table was found. Add your real Supabase budget table name to POSSIBLE_BUDGET_TABLES in app/api/admin/money/deleted-items/route.ts.",
      tableLookupErrors: tableResult.errors,
    };
  }

  let query = supabaseAdmin
    .from(tableResult.table)
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (year) {
    query = query.eq("year", year);
  }

  const { data, error } = await query;

  if (error) {
    return {
      table: tableResult.table,
      items: [],
      warning: error.message,
      tableLookupErrors: tableResult.errors,
    };
  }

  return {
    table: tableResult.table,
    items: data || [],
    warning: null,
    tableLookupErrors: tableResult.errors,
  };
}

export async function GET(request: Request) {
  const actor = await getActor();

  if (!actor.ok) {
    return actor.response;
  }

  const { searchParams } = new URL(request.url);
  const year = cleanText(searchParams.get("year"));

  let savingTargetQuery = supabaseAdmin
    .from(SAVING_TARGET_TABLE)
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (year) {
    savingTargetQuery = savingTargetQuery.eq("year", year);
  }

  const { data: savingTargets, error: savingTargetError } =
    await savingTargetQuery;

  if (savingTargetError) {
    return serverError(
      "Failed to load deleted saving targets.",
      savingTargetError.message,
      500,
      {
        table: SAVING_TARGET_TABLE,
        whatToCheck: [
          "Make sure money_saving_targets exists.",
          "Make sure money_saving_targets has deleted_at, deleted_by, deleted_by_email and deleted_by_user_id.",
        ],
      },
    );
  }

  const budgetResult = await loadDeletedBudgetItems(year);

  return NextResponse.json({
    ok: true,
    year: year || null,
    savingTargets: savingTargets || [],
    budgetItems: budgetResult.items,
    budgetTable: budgetResult.table,
    budgetWarning: budgetResult.warning,
    budgetTableLookupErrors: budgetResult.tableLookupErrors,
  });
}

export async function PATCH(request: Request) {
  const actor = await getActor();

  if (!actor.ok) {
    return actor.response;
  }

  const body = await request.json().catch(() => null);
  const type = cleanText(body?.type) as DeletedItemType;
  const id = cleanText(body?.id);
  const tableFromBody = cleanText(body?.table);

  if (!id) {
    return serverError(
      "Item ID is required.",
      "The restore request did not include an item ID.",
      400,
    );
  }

  if (type !== "saving_target" && type !== "budget_item") {
    return serverError(
      "Type must be saving_target or budget_item.",
      `Received type: ${type || "empty"}`,
      400,
    );
  }

  const budgetTableResult =
    type === "budget_item" && !tableFromBody
      ? await findWorkingBudgetTable()
      : null;

  const table =
    type === "saving_target"
      ? SAVING_TARGET_TABLE
      : tableFromBody || budgetTableResult?.table;

  if (!table) {
    return serverError(
      "Could not find budget tracker table.",
      "Update POSSIBLE_BUDGET_TABLES in app/api/admin/money/deleted-items/route.ts to match your Supabase budget table name.",
      500,
      {
        tableLookupErrors: budgetTableResult?.errors || [],
      },
    );
  }

  const { data: beforeItem, error: beforeError } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (beforeError) {
    return serverError("Failed to find deleted item.", beforeError.message);
  }

  if (!beforeItem) {
    return serverError(
      "Deleted item not found.",
      "The row may already have been restored or permanently removed.",
      404,
      { id, table, type },
    );
  }

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

  const { data: restoredItem, error: restoreError } = await supabaseAdmin
    .from(table)
    .update(restoreData)
    .eq("id", id)
    .select("*")
    .single();

  if (restoreError) {
    return serverError("Failed to restore deleted item.", restoreError.message);
  }

  await createAuditLog({
    actorName: actor.name,
    actorEmail: actor.email,
    action:
      type === "saving_target"
        ? "saving_target_restore"
        : "budget_item_restore",
    itemId: id,
    itemTitle:
      beforeItem.target_name ||
      beforeItem.category_label ||
      beforeItem.title ||
      "Deleted item",
    beforeData: beforeItem,
    afterData: restoredItem,
    metadata: {
      type,
      table,
      restored: true,
      year: beforeItem.year || null,
    },
  });

  return NextResponse.json({
    ok: true,
    restored: true,
    type,
    table,
    item: restoredItem,
  });
}

export async function DELETE(request: Request) {
  const actor = await getActor();

  if (!actor.ok) {
    return actor.response;
  }

  const body = await request.json().catch(() => null);
  const type = cleanText(body?.type) as DeletedItemType;
  const id = cleanText(body?.id);
  const tableFromBody = cleanText(body?.table);

  if (!id) {
    return serverError(
      "Item ID is required.",
      "The soft delete request did not include an item ID.",
      400,
    );
  }

  if (type !== "saving_target" && type !== "budget_item") {
    return serverError(
      "Type must be saving_target or budget_item.",
      `Received type: ${type || "empty"}`,
      400,
    );
  }

  const budgetTableResult =
    type === "budget_item" && !tableFromBody
      ? await findWorkingBudgetTable()
      : null;

  const table =
    type === "saving_target"
      ? SAVING_TARGET_TABLE
      : tableFromBody || budgetTableResult?.table;

  if (!table) {
    return serverError(
      "Could not find budget tracker table.",
      "Update POSSIBLE_BUDGET_TABLES in app/api/admin/money/deleted-items/route.ts to match your Supabase budget table name.",
      500,
      {
        tableLookupErrors: budgetTableResult?.errors || [],
      },
    );
  }

  const { data: beforeItem, error: beforeError } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (beforeError) {
    return serverError("Failed to find item for soft delete.", beforeError.message);
  }

  if (!beforeItem) {
    return serverError(
      "Item not found.",
      "The row may already have been deleted, restored, or removed.",
      404,
      { id, table, type },
    );
  }

  if (beforeItem.deleted_at) {
    return NextResponse.json({
      ok: true,
      deleted: true,
      alreadyDeleted: true,
      type,
      table,
      item: beforeItem,
    });
  }

  const softDeleteData = {
    deleted_at: new Date().toISOString(),
    deleted_by: actor.name,
    deleted_by_email: actor.email,
    deleted_by_user_id: actor.userId,
    updated_by: actor.name,
    updated_by_email: actor.email,
    updated_by_user_id: actor.userId,
    updated_at: new Date().toISOString(),
  };

  const { data: deletedItem, error: deleteError } = await supabaseAdmin
    .from(table)
    .update(softDeleteData)
    .eq("id", id)
    .select("*")
    .single();

  if (deleteError) {
    return serverError("Failed to soft delete item.", deleteError.message);
  }

  await createAuditLog({
    actorName: actor.name,
    actorEmail: actor.email,
    action:
      type === "saving_target"
        ? "saving_target_soft_delete"
        : "budget_item_soft_delete",
    itemId: id,
    itemTitle:
      beforeItem.target_name ||
      beforeItem.category_label ||
      beforeItem.title ||
      "Deleted item",
    beforeData: beforeItem,
    afterData: deletedItem,
    metadata: {
      type,
      table,
      soft_delete: true,
      year: beforeItem.year || null,
    },
  });

  return NextResponse.json({
    ok: true,
    deleted: true,
    softDeleted: true,
    type,
    table,
    item: deletedItem,
  });
}

