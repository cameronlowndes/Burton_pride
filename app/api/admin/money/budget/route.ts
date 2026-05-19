import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

function poundsToPence(value: unknown) {
  const amount = Number(String(value || "0").replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    const { data, error } = await supabaseAdmin
      .from("money_budget_items")
      .select("*")
      .eq("year", year)
      .order("category_key", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to load budget planning.",
          details: error,
        },
        { status: 500 }
      );
    }

    const existing = data || [];

    const merged = DEFAULT_BUDGET_CATEGORIES.map((category) => {
      const saved = existing.find((item) => item.category_key === category.key);

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

    return NextResponse.json({
      ok: true,
      budgetItems: merged,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to load budget planning.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "You must be signed in." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const year = String(body.year || "").trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!year) {
      return NextResponse.json(
        { ok: false, error: "Missing year." },
        { status: 400 }
      );
    }

    const rows = items.map((item: any) => ({
      year,
      category_key: String(item.category_key || item.categoryKey || "").trim(),
      category_label: String(
        item.category_label || item.categoryLabel || ""
      ).trim(),
      planned_amount_pence:
        typeof item.planned_amount_pence === "number"
          ? item.planned_amount_pence
          : poundsToPence(item.plannedAmount),
      notes: String(item.notes || "").trim(),
      updated_at: new Date().toISOString(),
    }));

    const cleanRows = rows.filter(
      (item: any) => item.category_key && item.category_label
    );

    if (cleanRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No budget items were provided." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_budget_items")
      .upsert(cleanRows, {
        onConflict: "year,category_key",
      })
      .select("*");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to save budget planning.",
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      budgetItems: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to save budget planning.",
      },
      { status: 500 }
    );
  }
}