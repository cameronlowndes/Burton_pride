import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLICATIONS_TABLE = "event_vendor_applications";
const MONEY_TABLE = "money_transactions";
const RECEIPTS_BUCKET = "money-receipts";

const allowedStatuses = new Set([
  "not_required",
  "awaiting_payment",
  "paid",
  "refunded",
]);

const allowedMethods = new Set([
  "bank_transfer",
  "card",
  "cash",
  "online",
  "other",
]);

type JsonRecord = Record<string, unknown>;

type ExistingMoneyTransaction = {
  id: string;
  receipt_url: string | null;
  transaction_reference: string | null;
};

function json(body: JsonRecord, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function integer(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "receipt"
  );
}

function moneyStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "refunded":
      return "Refunded";
    case "awaiting_payment":
      return "Awaiting payment";
    default:
      return "Not required";
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const formData = await request.formData();

    const applicationId = text(formData, "applicationId");
    const paymentStatus = text(formData, "paymentStatus");
    const paymentMethod = text(formData, "paymentMethod");
    const paymentDate = text(formData, "paymentDate");
    const paymentReference = text(formData, "paymentReference");
    const notes = text(formData, "notes");
    const allowPossibleDuplicate =
      text(formData, "allowPossibleDuplicate").toLowerCase() === "true";
    const duplicateWarning =
      text(formData, "duplicateWarning") ||
      "This payment could be a duplicate and must be checked in Money Management.";

    const originalAmountPence = Math.max(
      0,
      integer(formData, "originalAmountPence"),
    );
    const discountAmountPence = Math.max(
      0,
      integer(formData, "discountAmountPence"),
    );
    const finalAmountPence = Math.max(
      0,
      integer(formData, "finalAmountPence"),
    );
    const discountPercent = Math.min(
      100,
      Math.max(0, Number(text(formData, "discountPercent")) || 0),
    );

    if (!applicationId) {
      return json({ ok: false, error: "Application ID is required." }, 400);
    }

    if (!allowedStatuses.has(paymentStatus)) {
      return json({ ok: false, error: "Select a valid payment status." }, 400);
    }

    if (!allowedMethods.has(paymentMethod)) {
      return json({ ok: false, error: "Select a valid payment method." }, 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      return json({ ok: false, error: "Enter a valid payment date." }, 400);
    }

    if (discountAmountPence > originalAmountPence) {
      return json(
        { ok: false, error: "The discount cannot exceed the original cost." },
        400,
      );
    }

    if (finalAmountPence !== originalAmountPence - discountAmountPence) {
      return json(
        { ok: false, error: "The calculated payment total is invalid." },
        400,
      );
    }

    // Select the complete application without naming optional columns that may
    // not exist in every Event Hub database version.
    const { data: application, error: applicationError } = await supabaseAdmin
      .from(APPLICATIONS_TABLE)
      .select("*")
      .eq("id", applicationId)
      .maybeSingle<JsonRecord>();

    if (applicationError) {
      throw applicationError;
    }

    if (!application) {
      return json({ ok: false, error: "Application could not be found." }, 404);
    }

    const applicationReference =
      optionalText(application.application_reference) ?? applicationId;
    const organisationName =
      optionalText(application.organisation_name) ??
      optionalText(application.trading_name) ??
      "Event Hub applicant";
    const eventId = optionalText(application.event_id);

    const {
      data: existingTransactions,
      error: existingTransactionError,
      count: existingTransactionCount,
    } = await supabaseAdmin
      .from(MONEY_TABLE)
      .select("id,receipt_url,transaction_reference", {
        count: "exact",
      })
      .eq("event_hub_application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingTransactionError) {
      throw existingTransactionError;
    }

    const existingTransaction =
      (existingTransactions?.[0] as ExistingMoneyTransaction | undefined) ??
      null;
    const previousPaymentCount = existingTransactionCount ?? 0;
    const isPossibleDuplicate = previousPaymentCount > 0;

    if (isPossibleDuplicate && !allowPossibleDuplicate) {
      return json(
        {
          ok: false,
          code: "PAYMENT_ALREADY_SENT",
          error:
            "A payment has already been sent to Money Management. Confirm that you want to send another possible duplicate payment.",
          previousPaymentCount,
        },
        409,
      );
    }

    let receiptUrl = existingTransaction?.receipt_url ?? null;
    const receiptValue = formData.get("receipt");

    if (receiptValue instanceof File && receiptValue.size > 0) {
      const allowedReceiptTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ]);

      if (!allowedReceiptTypes.has(receiptValue.type)) {
        return json(
          { ok: false, error: "Receipt must be a JPG, PNG, WEBP or PDF file." },
          400,
        );
      }

      if (receiptValue.size > 10 * 1024 * 1024) {
        return json(
          { ok: false, error: "Receipt must be no larger than 10MB." },
          400,
        );
      }

      const extension = receiptValue.name.includes(".")
        ? receiptValue.name.split(".").pop()
        : "bin";
      const objectPath = [
        "event-hub",
        eventId ?? "no-event",
        applicationId,
        `${Date.now()}-${safeFileName(applicationReference)}.${extension}`,
      ].join("/");

      const receiptBuffer = Buffer.from(await receiptValue.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from(RECEIPTS_BUCKET)
        .upload(objectPath, receiptBuffer, {
          contentType: receiptValue.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from(RECEIPTS_BUCKET)
        .getPublicUrl(objectPath);

      receiptUrl = publicUrlData.publicUrl;
    }

    const now = new Date().toISOString();
    const paymentReferenceValue = paymentReference || applicationReference;
    const transactionReference = isPossibleDuplicate
      ? `${paymentReferenceValue}-DUP-${String(previousPaymentCount + 1).padStart(2, "0")}`
      : paymentReferenceValue;
    const duplicateComment = isPossibleDuplicate
      ? duplicateWarning
      : null;
    const combinedNotes = [duplicateComment, notes || null]
      .filter(Boolean)
      .join("\n\n") || null;
    const finalAmount = finalAmountPence / 100;
    const originalAmount = originalAmountPence / 100;
    const discountAmount = discountAmountPence / 100;

    // Every Event Hub and payment field is retained in this JSON snapshot.
    // Explicit columns below make the most important fields easy to filter and
    // display in Money Management without reading the JSON object.
    const eventHubPaymentData = {
      application,
      payment: {
        status: paymentStatus,
        status_label: moneyStatusLabel(paymentStatus),
        method: paymentMethod,
        date: paymentDate,
        reference: paymentReferenceValue,
        original_amount_pence: originalAmountPence,
        original_amount: originalAmount,
        discount_percent: discountPercent,
        discount_amount_pence: discountAmountPence,
        discount_amount: discountAmount,
        final_amount_pence: finalAmountPence,
        final_amount: finalAmount,
        receipt_url: receiptUrl,
        notes: combinedNotes,
        possible_duplicate: isPossibleDuplicate,
        previous_payment_count: previousPaymentCount,
        duplicate_warning: duplicateComment,
      },
      synced_by: {
        admin_id: admin.id,
        admin_email: admin.email,
        synced_at: now,
      },
    };

    const transactionPayload = {
      event_hub_application_id: applicationId,
      event_id: eventId,

      // Core Money Management values.
      type: "income",
      transaction_type: "income",
      amount: finalAmount,
      amount_pence: finalAmountPence,
      transaction_date: paymentDate,
      date: paymentDate,
      title: isPossibleDuplicate
        ? `Vendor application payment - ${organisationName} (possible duplicate)`
        : `Vendor application payment - ${organisationName}`,
      transaction_reference: transactionReference,
      description: [
        `Vendor application payment - ${organisationName}`,
        `Application reference: ${applicationReference}`,
        `Payment reference: ${paymentReferenceValue}`,
        duplicateComment,
      ]
        .filter(Boolean)
        .join("\n"),
      name: `Vendor application payment - ${organisationName}`,
      source: "event_hub_vendor_application",

      // Event Hub application details.
      event_hub_application_reference: applicationReference,
      event_hub_organisation_name: organisationName,
      event_hub_application_type: optionalText(application.application_type),
      event_hub_contact_name: optionalText(application.contact_name),
      event_hub_contact_email: optionalText(application.contact_email),
      event_hub_contact_phone: optionalText(application.contact_phone),
      event_hub_payment_data: eventHubPaymentData,

      // Payment breakdown.
      original_amount_pence: originalAmountPence,
      original_amount: originalAmount,
      discount_percent: discountPercent,
      discount_amount_pence: discountAmountPence,
      discount_amount: discountAmount,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      payment_reference: paymentReferenceValue,
      receipt_url: receiptUrl,
      notes: combinedNotes,

      // Duplicate review information.
      possible_duplicate: isPossibleDuplicate,
      duplicate_warning: duplicateComment,
      duplicate_of_transaction_id: existingTransaction?.id ?? null,

      // Money tracker defaults.
      checked: false,
      bank_reconciliation_status: isPossibleDuplicate
        ? "needs_review"
        : "unmatched",
      finance_note_status: isPossibleDuplicate ? "bank_query" : "none",
      finance_note: duplicateComment,
      budget_name: "Event Hub application fees",
      category: "Event Hub application fees",
      stock_control_connected: false,

      updated_at: now,
      updated_by_admin_id: admin.id,
      updated_by_admin_email: admin.email,
    };

    // Each confirmed submission creates its own Money Management transaction.
    // Existing transactions are never overwritten.
    const { data: insertedTransaction, error: moneyInsertError } =
      await supabaseAdmin
        .from(MONEY_TABLE)
        .insert(transactionPayload)
        .select("id,title,transaction_reference")
        .single();

    if (moneyInsertError) {
      throw moneyInsertError;
    }

    const applicationUpdate: JsonRecord = {
      payment_status: paymentStatus,
      fee_pence: finalAmountPence,
    };

    // Only send updated_at when the Event Hub table actually has that column.
    if (Object.prototype.hasOwnProperty.call(application, "updated_at")) {
      applicationUpdate.updated_at = now;
    }

    const { data: updatedApplication, error: updateError } = await supabaseAdmin
      .from(APPLICATIONS_TABLE)
      .update(applicationUpdate)
      .eq("id", applicationId)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return json({
      ok: true,
      application: updatedApplication,
      moneyTrackerUpdated: true,
      moneyTransaction: insertedTransaction,
      possibleDuplicate: isPossibleDuplicate,
      previousPaymentCount,
      syncedFields: {
        applicationReference,
        organisationName,
        paymentStatus,
        paymentMethod,
        paymentDate,
        paymentReference: paymentReferenceValue,
        transactionReference,
        possibleDuplicate: isPossibleDuplicate,
        duplicateComment,
        originalAmountPence,
        discountPercent,
        discountAmountPence,
        finalAmountPence,
        receiptUrl,
        notes: notes || null,
      },
    });
  } catch (error) {
    console.error("Event Hub payment sync failed", error);

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Payment details could not be saved.",
      },
      500,
    );
  }
}
