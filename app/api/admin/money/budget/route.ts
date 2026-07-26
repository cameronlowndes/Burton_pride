import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUDGET_TABLE = "money_budget_items";

const DEFAULT_BUDGET_CATEGORIES = [
  { key: "venue", label: "Venue" },
  { key: "insurance", label: "Insurance" },
  { key: "printing", label: "Printing" },
  { key: "security", label: "Security" },
  { key: "performers", label: "Performers" },
  { key: "equipment", label: "Equipment" },
  { key: "accessibility", label: "Accessibility" },
  { key: "other", label: "Other costs" },
] as const;

type ActorDetails = {
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
};

type BudgetInputItem = {
  id?: unknown;
  year?: unknown;
  category_key?: unknown;
  categoryKey?: unknown;
  category_label?: unknown;
  categoryLabel?: unknown;
  planned_amount_pence?: unknown;
  plannedAmountPence?: unknown;
  plannedAmount?: unknown;
  manual_actual_pence?: unknown;
  actual_amount_pence?: unknown;
  actual_override_pence?: unknown;
  notes?: unknown;
};

type BudgetDatabaseRow = {
  id: string;
  year: string;
  category_key: string;
  category_label: string;
  planned_amount_pence: number | string | null;
  manual_actual_pence?: number | string | null;
  actual_amount_pence?: number | string | null;
  actual_override_pence?: number | string | null;
  notes?: string | null;
  updated_by?: string | null;
  updated_by_email?: string | null;
  updated_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type ExistingBudgetIdentity = {
  id: string;
  year: string;
  category_key: string;
};

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function cleanText(
  value: unknown,
  maxLength = 5000,
) {
  const text = String(value ?? "").trim();
  return text.slice(0, maxLength);
}

function isRealId(value: unknown) {
  const text = cleanText(value, 150);

  return Boolean(
    text &&
      text !== "null" &&
      text !== "undefined",
  );
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    cleanText(value, 150),
  );
}

function integerPence(value: unknown) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed);
}

function poundsToPence(value: unknown) {
  const amount = Number(
    String(value ?? "0").replace(/,/g, ""),
  );

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return Math.round(amount * 100);
}

function resolvePlannedPence(
  item: BudgetInputItem,
) {
  if (
    item.planned_amount_pence !== undefined &&
    item.planned_amount_pence !== null &&
    item.planned_amount_pence !== ""
  ) {
    return Math.max(
      0,
      integerPence(item.planned_amount_pence),
    );
  }

  if (
    item.plannedAmountPence !== undefined &&
    item.plannedAmountPence !== null &&
    item.plannedAmountPence !== ""
  ) {
    return Math.max(
      0,
      integerPence(item.plannedAmountPence),
    );
  }

  return Math.max(
    0,
    poundsToPence(item.plannedAmount),
  );
}

function resolveActualPence(
  row: BudgetDatabaseRow,
) {
  return integerPence(
    row.manual_actual_pence ??
      row.actual_override_pence ??
      row.actual_amount_pence ??
      0,
  );
}

function nameFromEmail(
  email: string | null | undefined,
) {
  if (!email) return null;

  const username = email.split("@")[0] || "";

  const cleaned = username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    )
    .trim();

  return cleaned || null;
}

function getAdminName(admin: any) {
  return (
    cleanText(admin?.name, 250) ||
    cleanText(admin?.full_name, 250) ||
    cleanText(admin?.display_name, 250) ||
    nameFromEmail(admin?.email) ||
    cleanText(admin?.id, 250) ||
    "Unknown administrator"
  );
}

function getAdminEmail(admin: any) {
  return (
    cleanText(admin?.email, 320) ||
    cleanText(admin?.admin_email, 320) ||
    null
  );
}

async function getActorDetails(): Promise<ActorDetails> {
  const admin = await getCurrentAdmin();

  if (!admin?.id) {
    throw Object.assign(
      new Error("You must be signed in."),
      { status: 401 },
    );
  }

  return {
    actor_id: admin.id,
    actor_name: getAdminName(admin),
    actor_email: getAdminEmail(admin),
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

function tableMissing(error: any) {
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
    error?.code === "PGRST205" ||
    text.includes("could not find the table") ||
    text.includes("relation") &&
      text.includes("does not exist")
  );
}

function normaliseYear(value: unknown) {
  const year = cleanText(value, 4);

  if (!/^\d{4}$/.test(year)) {
    return null;
  }

  return year;
}

function buildMergedBudgetItems(
  existing: BudgetDatabaseRow[],
  year: string,
) {
  const activeRows = existing.filter(
    (item) => !item.deleted_at,
  );

  const defaultKeys = new Set<string>(
    DEFAULT_BUDGET_CATEGORIES.map(
      (category) => category.key,
    ),
  );

  const defaultRows =
    DEFAULT_BUDGET_CATEGORIES.map(
      (category) => {
        const saved = activeRows.find(
          (item) =>
            item.category_key === category.key,
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
      },
    );

  const customRows = activeRows.filter(
    (item) =>
      item.category_key &&
      !defaultKeys.has(
        item.category_key as
          | (typeof DEFAULT_BUDGET_CATEGORIES)[number]["key"]
          | string,
      ),
  );

  const otherRow = defaultRows.find(
    (item) => item.category_key === "other",
  );

  const rowsBeforeOther = defaultRows.filter(
    (item) => item.category_key !== "other",
  );

  return [
    ...rowsBeforeOther,
    ...customRows,
    ...(otherRow ? [otherRow] : []),
  ];
}

function mapBudgetOption(
  row: BudgetDatabaseRow,
) {
  const plannedAmountPence = integerPence(
    row.planned_amount_pence,
  );
  const actualAmountPence =
    resolveActualPence(row);

  return {
    id: row.id,
    year: String(row.year || ""),
    categoryKey: row.category_key,
    categoryLabel: row.category_label,
    plannedAmountPence,
    actualAmountPence,
    remainingAmountPence:
      plannedAmountPence -
      actualAmountPence,
    notes: cleanText(row.notes) || null,
    updatedAt: row.updated_at || null,
    updatedBy:
      cleanText(row.updated_by, 250) || null,
    updatedByEmail:
      cleanText(
        row.updated_by_email,
        320,
      ) || null,
  };
}

async function loadExistingIdentities(
  year: string,
) {
  const { data, error } = await supabaseAdmin
    .from(BUDGET_TABLE)
    .select("id,year,category_key")
    .eq("year", year);

  return {
    data:
      (data ||
        []) as ExistingBudgetIdentity[],
    error,
  };
}

function buildBudgetRows(
  items: BudgetInputItem[],
  year: string,
  actor: ActorDetails,
  existingRows: ExistingBudgetIdentity[],
  includeActorColumns: boolean,
) {
  const existingByKey = new Map(
    existingRows.map((item) => [
      item.category_key,
      item,
    ]),
  );

  return items
    .map((item) => {
      const categoryKey = cleanText(
        item.category_key ||
          item.categoryKey,
        150,
      );

      const categoryLabel = cleanText(
        item.category_label ||
          item.categoryLabel,
        250,
      );

      const existing =
        existingByKey.get(categoryKey);

      /*
       * Never replace the primary key of an existing
       * year/category row during an upsert.
       */
      const id =
        existing?.id ||
        (isRealId(item.id) &&
        isUuid(item.id)
          ? cleanText(item.id, 150)
          : randomUUID());

      const row: Record<string, unknown> = {
        id,
        year,
        category_key: categoryKey,
        category_label: categoryLabel,
        planned_amount_pence:
          resolvePlannedPence(item),
        notes: cleanText(item.notes),
        updated_at:
          new Date().toISOString(),
      };

      if (includeActorColumns) {
        row.updated_by =
          actor.actor_name;
        row.updated_by_email =
          actor.actor_email;
        row.updated_by_user_id =
          actor.actor_id;
      }

      return row;
    })
    .filter(
      (item) =>
        Boolean(item.category_key) &&
        Boolean(item.category_label),
    );
}

async function upsertBudgetRows(
  rows: Record<string, unknown>[],
  retryRows: Record<string, unknown>[],
) {
  const result = await supabaseAdmin
    .from(BUDGET_TABLE)
    .upsert(rows, {
      onConflict: "year,category_key",
    })
    .select("*");

  if (!result.error) {
    return {
      data:
        (result.data ||
          []) as BudgetDatabaseRow[],
      error: null,
      userTrackingSaved: true,
      warning: null,
    };
  }

  if (columnMissing(result.error)) {
    const retryResult =
      await supabaseAdmin
        .from(BUDGET_TABLE)
        .upsert(retryRows, {
          onConflict:
            "year,category_key",
        })
        .select("*");

    return {
      data:
        (retryResult.data ||
          []) as BudgetDatabaseRow[],
      error:
        retryResult.error || null,
      userTrackingSaved: false,
      warning: retryResult.error
        ? null
        : "Budget saved, but the budget table does not have all administrator tracking columns.",
    };
  }

  return {
    data: [] as BudgetDatabaseRow[],
    error: result.error,
    userTrackingSaved: false,
    warning: null,
  };
}

function errorStatus(error: any) {
  if (
    typeof error?.status === "number"
  ) {
    return error.status;
  }

  return 500;
}

/*
 * GET modes:
 *
 * /api/.../budget?year=2027
 *   Returns the Budget Planning rows for one year,
 *   including unsaved default rows.
 *
 * /api/.../budget?mode=options
 * /api/.../budget?all=true
 *   Returns every saved budget as dropdown options
 *   for Stock Orders.
 *
 * /api/.../budget?mode=options&year=2027
 *   Returns only saved 2027 budget options.
 */
export async function GET(req: Request) {
  try {
    const actor =
      await getActorDetails();

    const { searchParams } = new URL(
      req.url,
    );

    const mode = cleanText(
      searchParams.get("mode"),
      50,
    ).toLowerCase();

    const allRequested =
      cleanText(
        searchParams.get("all"),
        20,
      ).toLowerCase() === "true";

    const optionsMode =
      mode === "options" ||
      mode === "dropdown" ||
      allRequested;

    const requestedYear =
      normaliseYear(
        searchParams.get("year"),
      );

    if (optionsMode) {
      let query = supabaseAdmin
        .from(BUDGET_TABLE)
        .select("*")
        .order("year", {
          ascending: false,
        })
        .order("category_label", {
          ascending: true,
        });

      if (requestedYear) {
        query = query.eq(
          "year",
          requestedYear,
        );
      }

      const { data, error } =
        await query;

      if (error) {
        return json(
          {
            ok: false,
            error:
              "Failed to load Money Management budget options.",
            code: error.code,
            details: error.details,
            hint: error.hint,
            table: BUDGET_TABLE,
            actor,
          },
          tableMissing(error)
            ? 500
            : 500,
        );
      }

      const budgets = (
        (data ||
          []) as BudgetDatabaseRow[]
      )
        .filter(
          (row) =>
            !row.deleted_at &&
            Boolean(row.id),
        )
        .map(mapBudgetOption);

      return json({
        ok: true,
        actor,
        table: BUDGET_TABLE,
        budgets,
        budgetOptions: budgets,
        count: budgets.length,
        year: requestedYear,
      });
    }

    const year =
      requestedYear ||
      new Date()
        .getFullYear()
        .toString();

    const { data, error } =
      await supabaseAdmin
        .from(BUDGET_TABLE)
        .select("*")
        .eq("year", year)
        .order("category_label", {
          ascending: true,
        });

    if (error) {
      return json(
        {
          ok: false,
          error:
            "Failed to load budget planning.",
          code: error.code,
          details: error.details,
          hint: error.hint,
          table: BUDGET_TABLE,
          actor,
        },
        500,
      );
    }

    const merged =
      buildMergedBudgetItems(
        (data ||
          []) as BudgetDatabaseRow[],
        year,
      );

    return json({
      ok: true,
      actor,
      table: BUDGET_TABLE,
      year,
      budgetItems: merged,
      budgets: merged
        .filter(
          (item) =>
            Boolean(item.id),
        )
        .map((item) =>
          mapBudgetOption(
            item as BudgetDatabaseRow,
          ),
        ),
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to load budget planning.",
      },
      errorStatus(error),
    );
  }
}

export async function POST(req: Request) {
  try {
    const actor =
      await getActorDetails();

    const body = await req
      .json()
      .catch(() => null);

    if (!body) {
      return json(
        {
          ok: false,
          error:
            "Missing request body.",
          actor,
        },
        400,
      );
    }

    const year =
      normaliseYear(body.year);

    const items = Array.isArray(
      body.items,
    )
      ? (body.items as BudgetInputItem[])
      : [];

    if (!year) {
      return json(
        {
          ok: false,
          error:
            "A valid four-digit budget year is required.",
          actor,
        },
        400,
      );
    }

    if (items.length === 0) {
      return json(
        {
          ok: false,
          error:
            "No budget items were provided.",
          actor,
        },
        400,
      );
    }

    const {
      data: existingRows,
      error: existingError,
    } = await loadExistingIdentities(
      year,
    );

    if (existingError) {
      return json(
        {
          ok: false,
          error:
            "Failed to check existing budget rows.",
          code: existingError.code,
          details:
            existingError.details,
          hint: existingError.hint,
          actor,
        },
        500,
      );
    }

    const rowsWithActor =
      buildBudgetRows(
        items,
        year,
        actor,
        existingRows,
        true,
      );

    const rowsWithoutActor =
      buildBudgetRows(
        items,
        year,
        actor,
        existingRows,
        false,
      );

    if (
      rowsWithoutActor.length === 0
    ) {
      return json(
        {
          ok: false,
          error:
            "No valid budget items were provided.",
          actor,
        },
        400,
      );
    }

    const incomingKeys =
      rowsWithoutActor.map(
        (item) =>
          String(
            item.category_key || "",
          ),
      );

    const defaultKeys = new Set<string>(
      DEFAULT_BUDGET_CATEGORIES.map(
        (category) => category.key,
      ),
    );

    const removedCustomKeys =
      existingRows
        .map(
          (item) =>
            item.category_key,
        )
        .filter(
          (key): key is string =>
            Boolean(key) &&
            !defaultKeys.has(key),
        )
        .filter(
          (key) =>
            !incomingKeys.includes(key),
        );

    if (
      removedCustomKeys.length > 0
    ) {
      const { error: deleteError } =
        await supabaseAdmin
          .from(BUDGET_TABLE)
          .delete()
          .eq("year", year)
          .in(
            "category_key",
            removedCustomKeys,
          );

      if (deleteError) {
        return json(
          {
            ok: false,
            error:
              "Failed to remove deleted custom budget areas.",
            code: deleteError.code,
            details:
              deleteError.details,
            hint: deleteError.hint,
            actor,
          },
          500,
        );
      }
    }

    const saveResult =
      await upsertBudgetRows(
        rowsWithActor,
        rowsWithoutActor,
      );

    if (saveResult.error) {
      return json(
        {
          ok: false,
          error:
            "Failed to save budget planning.",
          code:
            saveResult.error.code,
          details:
            saveResult.error.details,
          hint:
            saveResult.error.hint,
          rows: rowsWithoutActor,
          actor,
        },
        500,
      );
    }

    const {
      data: reloadedRows,
      error: reloadError,
    } = await supabaseAdmin
      .from(BUDGET_TABLE)
      .select("*")
      .eq("year", year)
      .order("category_label", {
        ascending: true,
      });

    if (reloadError) {
      return json(
        {
          ok: false,
          error:
            "Budget saved, but failed to reload budget planning.",
          code: reloadError.code,
          details:
            reloadError.details,
          hint: reloadError.hint,
          actor,
          userTrackingSaved:
            saveResult.userTrackingSaved,
          warning:
            saveResult.warning,
        },
        500,
      );
    }

    const savedRows =
      (reloadedRows ||
        saveResult.data ||
        []) as BudgetDatabaseRow[];

    const merged =
      buildMergedBudgetItems(
        savedRows,
        year,
      );

    const budgetOptions =
      savedRows
        .filter(
          (row) =>
            !row.deleted_at &&
            Boolean(row.id),
        )
        .map(mapBudgetOption);

    return json({
      ok: true,
      actor,
      table: BUDGET_TABLE,
      year,
      editedBy:
        actor.actor_name,
      editedByEmail:
        actor.actor_email,
      userTrackingSaved:
        saveResult.userTrackingSaved,
      warning:
        saveResult.warning,
      budgetItems: merged,
      budgets: budgetOptions,
      budgetOptions,
    });
  } catch (error: any) {
    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to save budget planning.",
      },
      errorStatus(error),
    );
  }
}
