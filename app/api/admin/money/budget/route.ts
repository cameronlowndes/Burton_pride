import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_BUDGET_CATEGORIES = [
  { key: "venue", label: "Venue" },
  { key: "insurance", label: "Insurance" },
  { key: "printing", label: "Printing" },
  { key: "security", label: "Security" },
  { key: "performers", label: "Performers" },
  { key: "equipment", label: "Equipment" },
  { key: "accessibility", label: "Accessibility" },
  { key: "other", label: "Other costs" },
];

type ActorDetails = {
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
};

function poundsToPence(value: unknown) {
  const amount = Number(String(value || "0").replace(/,/g, ""));

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100);
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function isRealId(value: unknown) {
  const text = cleanText(value);

  return Boolean(text && text !== "null" && text !== "undefined");
}

function nameFromEmail(email: string | null | undefined) {
  if (!email) return null;

  const username = email.split("@")[0] || "";

  const cleaned = username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

  return cleaned || null;
}

function getClaimValue(claims: any, keys: string[]) {
  for (const key of keys) {
    const value = claims?.[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function getActorDetails(): Promise<ActorDetails> {
  const authData = await auth();
  const user = await currentUser();
  const claims: any = authData.sessionClaims || {};

  const email =
    user?.emailAddresses?.[0]?.emailAddress ||
    getClaimValue(claims, ["email", "email_address"]) ||
    null;

  const firstName =
    user?.firstName ||
    getClaimValue(claims, ["first_name", "given_name"]) ||
    "";

  const lastName =
    user?.lastName ||
    getClaimValue(claims, ["last_name", "family_name"]) ||
    "";

  const fullName = `${firstName || ""} ${lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();

  const claimName =
    getClaimValue(claims, ["name", "full_name", "username"]) || null;

  const actorName =
    fullName ||
    claimName ||
    nameFromEmail(email) ||
    authData.userId ||
    "Unknown user";

  return {
    actor_id: authData.userId || user?.id || null,
    actor_name: actorName,
    actor_email: email,
  };
}

function columnMissing(error: any) {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error?.code === "PGRST204" ||
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("column")
  );
}

function buildBudgetRows(
  items: any[],
  year: string,
  actor: ActorDetails,
  includeActorColumns: boolean,
) {
  return items
    .map((item: any) => {
      const categoryKey = cleanText(item.category_key || item.categoryKey);
      const categoryLabel = cleanText(
        item.category_label || item.categoryLabel,
      );

      const row: Record<string, any> = {
        // Important fix:
        // Your money_budget_items.id column is NOT NULL and may not have a database default.
        // So the API creates an id for every new row before Supabase inserts it.
        id: isRealId(item.id) ? cleanText(item.id) : randomUUID(),
        year,
        category_key: categoryKey,
        category_label: categoryLabel,
        planned_amount_pence:
          typeof item.planned_amount_pence === "number"
            ? item.planned_amount_pence
            : poundsToPence(item.plannedAmount),
        notes: cleanText(item.notes),
        updated_at: new Date().toISOString(),
      };

      // Optional user tracking on the budget item itself.
      // If your money_budget_items table does not have these columns, the route
      // automatically retries without them so saving will not break.
      if (includeActorColumns) {
        row.updated_by = actor.actor_name;
        row.updated_by_email = actor.actor_email;
        row.updated_by_user_id = actor.actor_id;
      }

      return row;
    })
    .filter((item: any) => item.category_key && item.category_label);
}

function buildMergedBudgetItems(existing: any[], year: string) {
  const defaultKeys = new Set(
    DEFAULT_BUDGET_CATEGORIES.map((category) => category.key),
  );

  const defaultRows = DEFAULT_BUDGET_CATEGORIES.map((category) => {
    const saved = existing.find(
      (item) => item.category_key === category.key,
    );

    return (
      saved || {
        id: null,
        year,
        category_key: category.key,
        category_label: category.label,
        planned_amount_pence: 0,
        notes: "",
      }
    );
  });

  const customRows = existing.filter(
    (item) => item.category_key && !defaultKeys.has(item.category_key),
  );

  const otherRow = defaultRows.find((item) => item.category_key === "other");
  const rowsBeforeOther = defaultRows.filter(
    (item) => item.category_key !== "other",
  );

  return [
    ...rowsBeforeOther,
    ...customRows,
    ...(otherRow ? [otherRow] : []),
  ];
}

async function upsertBudgetRows(
  rows: Record<string, any>[],
  retryRows: Record<string, any>[],
) {
  const result = await supabaseAdmin
    .from("money_budget_items")
    .upsert(rows, {
      onConflict: "year,category_key",
    })
    .select("*");

  if (!result.error) {
    return {
      data: result.data || [],
      error: null,
      userTrackingSaved: true,
      warning: null,
    };
  }

  // If the only issue is missing optional user-tracking columns,
  // retry without those columns.
  if (columnMissing(result.error)) {
    const retryResult = await supabaseAdmin
      .from("money_budget_items")
      .upsert(retryRows, {
        onConflict: "year,category_key",
      })
      .select("*");

    return {
      data: retryResult.data || [],
      error: retryResult.error || null,
      userTrackingSaved: false,
      warning: retryResult.error
        ? null
        : "Budget saved, but money_budget_items does not have updated_by / updated_by_email / updated_by_user_id columns, so user tracking was only returned in the API response and audit log metadata.",
    };
  }

  return {
    data: [],
    error: result.error,
    userTrackingSaved: false,
    warning: null,
  };
}

export async function GET(req: Request) {
  try {
    const authData = await auth();

    if (!authData.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must be signed in.",
        },
        { status: 401 },
      );
    }

    const actor = await getActorDetails();

    const { searchParams } = new URL(req.url);
    const year =
      searchParams.get("year") || new Date().getFullYear().toString();

    const { data, error } = await supabaseAdmin
      .from("money_budget_items")
      .select("*")
      .eq("year", year);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load budget planning.",
          details: error,
          actor,
        },
        { status: 500 },
      );
    }

    const merged = buildMergedBudgetItems(data || [], year);

    return NextResponse.json({
      ok: true,
      actor,
      budgetItems: merged,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load budget planning.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const authData = await auth();

    if (!authData.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must be signed in.",
        },
        { status: 401 },
      );
    }

    const actor = await getActorDetails();

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing request body.",
          actor,
        },
        { status: 400 },
      );
    }

    const year = cleanText(body.year);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!year) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing year.",
          actor,
        },
        { status: 400 },
      );
    }

    const rowsWithActor = buildBudgetRows(items, year, actor, true);
    const rowsWithoutActor = buildBudgetRows(items, year, actor, false);

    if (rowsWithoutActor.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No budget items were provided.",
          actor,
        },
        { status: 400 },
      );
    }

    const incomingKeys = rowsWithoutActor.map((item: any) => item.category_key);

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("money_budget_items")
      .select("id, category_key")
      .eq("year", year);

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to check existing budget rows.",
          details: existingError,
          actor,
        },
        { status: 500 },
      );
    }

    const defaultKeys = new Set(
      DEFAULT_BUDGET_CATEGORIES.map((category) => category.key),
    );

    const removedCustomKeys = (existingRows || [])
      .map((item: any) => item.category_key)
      .filter((key: string) => key && !defaultKeys.has(key))
      .filter((key: string) => !incomingKeys.includes(key));

    if (removedCustomKeys.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("money_budget_items")
        .delete()
        .eq("year", year)
        .in("category_key", removedCustomKeys);

      if (deleteError) {
        return NextResponse.json(
          {
            ok: false,
            error: "Failed to remove deleted custom budget areas.",
            details: deleteError,
            actor,
          },
          { status: 500 },
        );
      }
    }

    const saveResult = await upsertBudgetRows(rowsWithActor, rowsWithoutActor);

    if (saveResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to save budget planning.",
          details: saveResult.error,
          rows: rowsWithoutActor,
          actor,
        },
        { status: 500 },
      );
    }

    const { data: reloadedRows, error: reloadError } = await supabaseAdmin
      .from("money_budget_items")
      .select("*")
      .eq("year", year);

    if (reloadError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Budget saved, but failed to reload budget planning.",
          details: reloadError,
          actor,
          userTrackingSaved: saveResult.userTrackingSaved,
          warning: saveResult.warning,
        },
        { status: 500 },
      );
    }

    const merged = buildMergedBudgetItems(
      reloadedRows || saveResult.data || [],
      year,
    );

    return NextResponse.json({
      ok: true,
      actor,
      editedBy: actor.actor_name,
      editedByEmail: actor.actor_email,
      userTrackingSaved: saveResult.userTrackingSaved,
      warning: saveResult.warning,
      budgetItems: merged,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save budget planning.",
      },
      { status: 500 },
    );
  }
}
