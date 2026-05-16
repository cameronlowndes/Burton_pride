import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMainAdmin } from "@/lib/isMainAdmin";
import {
  createMoneyAuditLog,
  createBulkMoneyAuditLogs,
} from "@/lib/money/adminMoneyAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-08-16" as any,
});

function isStripeKeyLive() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;
}

function isStripeKeyTest() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true;
}

function sessionMatchesCurrentStripeMode(sessionId: string) {
  if (isStripeKeyLive()) return sessionId.startsWith("cs_live_");
  if (isStripeKeyTest()) return sessionId.startsWith("cs_test_");
  return false;
}

function clean(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : "";
}

function cleanOrNull(value: string) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

function toBoolean(value: string) {
  return value === "true" || value === "1" || value === "yes";
}

function getTransactionYearFromDate(dateValue: string | null | undefined) {
  if (!dateValue) {
    return new Date().getFullYear().toString();
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return new Date().getFullYear().toString();
  }

  return date.getFullYear().toString();
}

function safeFileName(name: string) {
  return String(name || "attachment")
    .trim()
    .replace(/[^a-zA-Z0-9.\-_ ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

async function createTransactionReference(year: string) {
  const cleanYear = String(year || new Date().getFullYear()).trim();
  const prefix = `BP-${cleanYear}-`;

  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("transaction_reference")
    .like("transaction_reference", `${prefix}%`)
    .order("transaction_reference", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const latestReference = data?.[0]?.transaction_reference || "";
  const latestNumber = Number(latestReference.replace(prefix, "")) || 0;
  const nextNumber = latestNumber + 1;

  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

async function insertTransactionWithReference(insertData: Record<string, any>) {
  const transactionDate =
    insertData.transaction_date || new Date().toISOString().slice(0, 10);

  const transactionYear = getTransactionYearFromDate(transactionDate);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const transactionReference =
      insertData.transaction_reference ||
      (await createTransactionReference(transactionYear));

    const dataWithReference = {
      ...insertData,
      transaction_reference: transactionReference,
    };

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .insert(dataWithReference)
      .select("*")
      .single();

    if (!error) {
      return {
        data,
        error: null,
        sent: dataWithReference,
      };
    }

    const errorMessage = String(error.message || "").toLowerCase();
    const isDuplicateReference =
      error.code === "23505" ||
      errorMessage.includes("duplicate") ||
      errorMessage.includes("transaction_reference");

    if (!isDuplicateReference || attempt === 4) {
      return {
        data: null,
        error,
        sent: dataWithReference,
      };
    }

    insertData.transaction_reference = null;
  }

  return {
    data: null,
    error: {
      message: "Failed to create a unique transaction reference.",
    },
    sent: insertData,
  };
}

async function uploadTransactionAttachments({
  transactionId,
  files,
}: {
  transactionId: string;
  files: File[];
}) {
  const uploadedAttachments: any[] = [];

  for (const file of files) {
    if (!file || file.size <= 0) continue;

    const fileExt = file.name.split(".").pop() || "file";
    const cleanName = safeFileName(file.name);
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}-${cleanName || `attachment.${fileExt}`}`;

    const filePath = `transactions/${transactionId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("money-invoices")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("money-invoices")
      .getPublicUrl(filePath);

    const attachmentInsert = {
      transaction_id: transactionId,
      file_name: file.name || fileName,
      file_url: publicUrlData.publicUrl,
      file_type: file.type || null,
      file_size: file.size || null,
    };

    const { data: attachment, error: attachmentError } = await supabaseAdmin
      .from("money_transaction_attachments")
      .insert(attachmentInsert)
      .select("*")
      .single();

    if (attachmentError) {
      throw attachmentError;
    }

    uploadedAttachments.push(attachment);
  }

  return uploadedAttachments;
}

async function loadAttachmentsForTransactions(transactionIds: string[]) {
  if (transactionIds.length === 0) return new Map<string, any[]>();

  const { data, error } = await supabaseAdmin
    .from("money_transaction_attachments")
    .select("*")
    .in("transaction_id", transactionIds)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load money transaction attachments:", error);
    return new Map<string, any[]>();
  }

  const map = new Map<string, any[]>();

  for (const attachment of data || []) {
    const transactionId = attachment.transaction_id;

    if (!map.has(transactionId)) {
      map.set(transactionId, []);
    }

    map.get(transactionId)?.push(attachment);
  }

  return map;
}

async function getActorLabel() {
  try {
    const user = await currentUser();

    const actorName =
      user?.fullName ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      null;

    const actorEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;

    if (actorName && actorEmail) return `${actorName} (${actorEmail})`;
    if (actorName) return actorName;
    if (actorEmail) return actorEmail;

    return "Unknown admin";
  } catch {
    return "Unknown admin";
  }
}

async function checkDeletePasswordThroughSettingsApi(
  req: NextRequest,
  password: string
) {
  const passwordCheck = await fetch(
    `${req.nextUrl.origin}/api/admin/settings/delete-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        password,
      }),
    }
  );

  const passwordData = await passwordCheck.json().catch(() => ({}));

  if (!passwordCheck.ok || !passwordData.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: passwordData.error || "Main admin password check failed.",
          details: passwordData,
        },
        { status: passwordCheck.status || 500 }
      ),
    };
  }

  return {
    ok: true,
    response: null,
  };
}

async function syncPaidDonationsToMoneyTracker() {
  try {
    const { data: donations, error: donationError } = await supabaseAdmin
      .from("donations")
      .select(
        "id, full_name, email, message, donation_type, amount_pence, currency, stripe_checkout_session_id, status, created_at"
      )
      .not("stripe_checkout_session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (donationError) {
      console.error("Failed to load donations for money sync:", donationError);
      return;
    }

    if (!donations?.length) return;

    for (const donation of donations) {
      const sessionId = donation.stripe_checkout_session_id;

      if (!sessionId) continue;

      if (!sessionMatchesCurrentStripeMode(sessionId)) {
        continue;
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("money_transactions")
        .select("id, deleted_at")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (existingError) {
        console.error("Failed to check existing money transaction:", {
          error: existingError,
          sessionId,
        });
        continue;
      }

      if (existing) continue;

      let session: Stripe.Checkout.Session | null = null;

      try {
        session = await stripe.checkout.sessions.retrieve(sessionId);
      } catch (err) {
        console.error("Failed to retrieve Stripe session:", sessionId, err);
        continue;
      }

      const isPaid =
        session.payment_status === "paid" || session.status === "complete";

      if (!isPaid) continue;

      const amountPence = session.amount_total || donation.amount_pence || 0;

      if (!amountPence || amountPence <= 0) continue;

      const donorName =
        session.metadata?.fullName ||
        session.customer_details?.name ||
        donation.full_name ||
        "Supporter";

      const donorEmail =
        session.customer_details?.email ||
        session.metadata?.email ||
        donation.email ||
        "";

      const donorMessage = session.metadata?.message || donation.message || "";

      const donationType =
        session.mode === "subscription" || donation.donation_type === "monthly"
          ? "Monthly donation"
          : "One-time donation";

      const stripeInvoiceId =
        typeof session.invoice === "string" ? session.invoice : null;

      const stripeCustomerId =
        typeof session.customer === "string" ? session.customer : null;

      const stripePaymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null;

      const transactionDate = session.created
        ? new Date(session.created * 1000).toISOString().slice(0, 10)
        : new Date(donation.created_at || Date.now())
            .toISOString()
            .slice(0, 10);

      const descriptionParts = [
        donorEmail ? `Email: ${donorEmail}` : "",
        donorMessage ? `Message: ${donorMessage}` : "",
        session.payment_status
          ? `Payment status: ${session.payment_status}`
          : "",
        session.mode ? `Stripe mode: ${session.mode}` : "",
        sessionId ? `Stripe session: ${sessionId}` : "",
      ].filter(Boolean);

      const insertData = {
        title: `${donationType} - ${donorName}`,
        description: descriptionParts.join("\n") || null,
        type: "income",
        category: "Donation",
        amount_pence: amountPence,
        payment_method: "Stripe",
        transaction_date: transactionDate,

        is_personal_funds: false,
        personal_funds_name: null,
        personal_funds_repaid: false,
        personal_funds_repaid_at: null,

        sponsor_id: null,
        sponsor_name: null,
        sponsorship_note: null,

        invoice_image_url: null,

        stripe_session_id: sessionId,
        stripe_invoice_id: stripeInvoiceId,
        stripe_customer_id: stripeCustomerId,
        stripe_payment_intent_id: stripePaymentIntentId,

        source:
          donation.donation_type === "monthly"
            ? "website_monthly_donation"
            : "website_donation",

        deleted_at: null,
        deleted_by: null,
      };

      const {
        data: inserted,
        error: insertError,
        sent,
      } = await insertTransactionWithReference(insertData);

      if (insertError) {
        console.error("Failed to sync donation into money tracker:", {
          error: insertError,
          sessionId,
          donationId: donation.id,
          sent,
        });
        continue;
      }

      await createMoneyAuditLog({
        action: "create",
        transactionId: inserted?.id || null,
        transactionTitle: inserted?.title || insertData.title,
        beforeData: null,
        afterData: inserted,
        metadata: {
          source: "stripe_donation_sync",
          route: "/api/admin/money/transactions",
          stripe_session_id: sessionId,
          donation_id: donation.id,
          transaction_reference:
            inserted?.transaction_reference || sent?.transaction_reference,
        },
      });
    }
  } catch (err) {
    console.error("Money tracker donation sync failed:", err);
  }
}

export async function GET() {
  try {
    await syncPaidDonationsToMoneyTracker();

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .order("deleted_at", { ascending: true, nullsFirst: true })
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    const rows = data || [];
    const attachmentMap = await loadAttachmentsForTransactions(
      rows.map((item) => item.id)
    );

    const transactionsWithAttachments = rows.map((item) => ({
      ...item,
      attachments: attachmentMap.get(item.id) || [],
    }));

    return NextResponse.json(
      {
        ok: true,
        transactions: transactionsWithAttachments,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("Money transactions GET error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const title = clean(formData.get("title"));
    const description = clean(formData.get("description"));
    const type = clean(formData.get("type"));
    const category = clean(formData.get("category"));
    const amount = clean(formData.get("amount"));
    const paymentMethod = clean(formData.get("paymentMethod"));
    const transactionDate = clean(formData.get("transactionDate"));
    const source = clean(formData.get("source")) || "manual";

    const isPersonalFunds = toBoolean(clean(formData.get("isPersonalFunds")));
    const personalFundsName = clean(formData.get("personalFundsName"));

    const sponsorId = clean(formData.get("sponsorId"));
    const sponsorName = clean(formData.get("sponsorName"));
    const sponsorshipNote = clean(formData.get("sponsorshipNote"));

    const invoiceFiles = formData
      .getAll("invoiceFiles")
      .filter((file): file is File => file instanceof File && file.size > 0);

    const oldSingleInvoiceFile = formData.get("invoiceFile");

    if (
      oldSingleInvoiceFile instanceof File &&
      oldSingleInvoiceFile.size > 0 &&
      invoiceFiles.length === 0
    ) {
      invoiceFiles.push(oldSingleInvoiceFile);
    }

    const amountPounds = Number(amount || 0);
    const isSponsorLinked = Boolean(sponsorId || sponsorName);

    if (!title || !type || amountPounds <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Title, type and amount are required",
          received: {
            title,
            type,
            amount,
            category,
            paymentMethod,
            transactionDate,
            source,
            sponsorId,
            sponsorName,
          },
        },
        { status: 400 }
      );
    }

    if (type !== "income" && type !== "expense") {
      return NextResponse.json(
        {
          ok: false,
          error: "Type must be income or expense",
          received: type,
        },
        { status: 400 }
      );
    }

    if (!paymentMethod && !isSponsorLinked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please choose a payment method.",
        },
        { status: 400 }
      );
    }

    if (isPersonalFunds && !personalFundsName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please enter the name of the person who paid with personal funds.",
        },
        { status: 400 }
      );
    }

    const finalTransactionDate =
      transactionDate || new Date().toISOString().slice(0, 10);

    const insertData = {
      title,
      description: cleanOrNull(description),
      type,
      category: isSponsorLinked ? "Sponsorship" : cleanOrNull(category),
      amount_pence: Math.round(amountPounds * 100),
      payment_method: isSponsorLinked
        ? "Sponsorship Money"
        : cleanOrNull(paymentMethod),
      transaction_date: finalTransactionDate,

      invoice_image_url: null,

      is_personal_funds: isSponsorLinked ? false : isPersonalFunds,
      personal_funds_name:
        isSponsorLinked || !isPersonalFunds
          ? null
          : cleanOrNull(personalFundsName),
      personal_funds_repaid: false,
      personal_funds_repaid_at: null,

      sponsor_id: sponsorId || null,
      sponsor_name: sponsorName || null,
      sponsorship_note: sponsorshipNote || null,

      source: isSponsorLinked ? "sponsorship" : source || "manual",

      stripe_session_id: null,
      stripe_invoice_id: null,
      stripe_customer_id: null,
      stripe_payment_intent_id: null,

      deleted_at: null,
      deleted_by: null,
    };

    const { data, error, sent } = await insertTransactionWithReference(
      insertData
    );

    if (error || !data?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: error?.message || "Failed to create transaction.",
          details: error,
          sent,
        },
        { status: 500 }
      );
    }

    let attachments: any[] = [];

    if (invoiceFiles.length > 0) {
      try {
        attachments = await uploadTransactionAttachments({
          transactionId: data.id,
          files: invoiceFiles,
        });

        if (attachments[0]?.file_url) {
          await supabaseAdmin
            .from("money_transactions")
            .update({
              invoice_image_url: attachments[0].file_url,
            })
            .eq("id", data.id);

          data.invoice_image_url = attachments[0].file_url;
        }
      } catch (attachmentError: any) {
        return NextResponse.json(
          {
            ok: false,
            error:
              attachmentError?.message ||
              "Transaction was created but one or more attachments failed to upload.",
            details: attachmentError,
            transaction: data,
          },
          { status: 500 }
        );
      }
    }

    const transactionWithAttachments = {
      ...data,
      attachments,
    };

    await createMoneyAuditLog({
      action: "create",
      transactionId: data?.id || null,
      transactionTitle: data?.title || title,
      beforeData: null,
      afterData: transactionWithAttachments,
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions",
        transaction_reference:
          data?.transaction_reference || sent?.transaction_reference,
        attachment_count: attachments.length,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: transactionWithAttachments,
    });
  } catch (err) {
    console.error("Money transactions POST error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireMainAdmin();

    const body = await req.json().catch(() => ({}));
    const password = String(body.password || "").trim();

    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Main admin password is required.",
        },
        { status: 400 }
      );
    }

    const passwordCheck = await checkDeletePasswordThroughSettingsApi(
      req,
      password
    );

    if (!passwordCheck.ok && passwordCheck.response) {
      return passwordCheck.response;
    }

    const { data: transactions, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .is("deleted_at", null);

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,
          error: loadError.message,
          details: loadError,
        },
        { status: 500 }
      );
    }

    const rows = transactions || [];
    const ids = rows.map((item) => item.id);

    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        deletedCount: 0,
        message: "No active transactions to move to deleted area",
      });
    }

    const deletedAt = new Date().toISOString();
    const deletedBy = await getActorLabel();

    const { data: deletedRows, error: deleteError } = await supabaseAdmin
      .from("money_transactions")
      .update({
        deleted_at: deletedAt,
        deleted_by: deletedBy,
        updated_at: deletedAt,
      })
      .in("id", ids)
      .is("deleted_at", null)
      .select("*");

    if (deleteError) {
      console.error("Soft delete all money transactions error:", deleteError);

      return NextResponse.json(
        {
          ok: false,
          error: deleteError.message,
          details: deleteError,
        },
        { status: 500 }
      );
    }

    await createMoneyAuditLog({
      action: "delete_all",
      transactionId: null,
      transactionTitle: "Delete all transactions",
      beforeData: null,
      afterData: null,
      changedFields: {
        deleted_at: {
          before: null,
          after: deletedAt,
        },
        deleted_by: {
          before: null,
          after: deletedBy,
        },
      },
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions",
        delete_type: "soft_delete_all",
        deleted_count: ids.length,
        deleted_ids: ids,
      },
    });

    await createBulkMoneyAuditLogs(
      rows.map((beforeRow) => {
        const afterRow =
          deletedRows?.find((item) => item.id === beforeRow.id) || null;

        return {
          action: "delete",
          transactionId: beforeRow.id,
          transactionTitle: beforeRow.title || null,
          beforeData: beforeRow,
          afterData: afterRow,
          metadata: {
            source: "money_tracker",
            route: "/api/admin/money/transactions",
            delete_type: "soft_delete_from_delete_all",
            parent_action: "delete_all",
            deleted_at: deletedAt,
            deleted_by: deletedBy,
          },
        };
      })
    );

    return NextResponse.json({
      ok: true,
      deletedCount: ids.length,
      message: "All active transactions moved to deleted area successfully",
    });
  } catch (err) {
    console.error("Unexpected soft delete all transactions error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}