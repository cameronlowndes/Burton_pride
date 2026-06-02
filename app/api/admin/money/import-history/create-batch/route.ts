import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FailedRowInput = {
  row_number: number;
  error_message: string;
  row_data?: any;
};

function getUserEmail(user: any) {
  return (
    user?.emailAddresses?.find(
      (email: any) => email.id === user.primaryEmailAddressId
    )?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null
  );
}

function getUserName(user: any) {
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) return fullName;

  const email = getUserEmail(user);

  if (!email) return "Admin";

  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
    .trim();
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    await requireMainAdmin();

    const user = await currentUser();

    const body = await request.json();

    const fileName = body.fileName || "Unknown CSV file";
    const importType = body.importType || "money_transactions";

    const totalRows = Number(body.totalRows || 0);
    const importedRows = Number(body.importedRows || 0);
    const failedRowsCount = Number(body.failedRows || 0);

    const totalMoneyInPence = Number(body.totalMoneyInPence || 0);
    const totalMoneyOutPence = Number(body.totalMoneyOutPence || 0);
    const netTotalPence =
      body.netTotalPence !== undefined
        ? Number(body.netTotalPence || 0)
        : totalMoneyInPence - totalMoneyOutPence;

    const failedRows: FailedRowInput[] = Array.isArray(body.failedRowDetails)
      ? body.failedRowDetails
      : [];

    const status =
      body.status ||
      (failedRowsCount > 0 || failedRows.length > 0
        ? "completed_with_errors"
        : "completed");

    const importedByEmail = getUserEmail(user);
    const importedByName = getUserName(user);

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("money_import_batches")
      .insert({
        imported_by_user_id: userId,
        imported_by_name: importedByName,
        imported_by_email: importedByEmail,

        file_name: fileName,
        import_type: importType,

        total_rows: totalRows,
        imported_rows: importedRows,
        failed_rows: failedRowsCount || failedRows.length,

        total_money_in_pence: totalMoneyInPence,
        total_money_out_pence: totalMoneyOutPence,
        net_total_pence: netTotalPence,

        status,
      })
      .select("*")
      .single();

    if (batchError) {
      console.error("Create import batch error:", batchError);
      return NextResponse.json(
        { error: "Failed to create import history batch." },
        { status: 500 }
      );
    }

    if (failedRows.length > 0) {
      const failedRowsToInsert = failedRows.map((row) => ({
        import_batch_id: batch.id,
        row_number: Number(row.row_number || 0),
        error_message: row.error_message || "Unknown import error",
        row_data: row.row_data || {},
      }));

      const { error: failedRowsError } = await supabaseAdmin
        .from("money_import_failed_rows")
        .insert(failedRowsToInsert);

      if (failedRowsError) {
        console.error("Create failed rows error:", failedRowsError);
        return NextResponse.json(
          {
            error:
              "Import batch was created, but failed rows could not be saved.",
            batch,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      batch,
    });
  } catch (error) {
    console.error("Create import history batch API error:", error);
    return NextResponse.json(
      { error: "Failed to save import history." },
      { status: 500 }
    );
  }
}