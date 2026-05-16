import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createMoneyAuditLog } from "@/lib/money/adminMoneyAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function toPence(amount: string) {
  const value = Number(amount || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100);
}

function safeFileName(name: string) {
  return String(name || "attachment")
    .trim()
    .replace(/[^a-zA-Z0-9.\-_ ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
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

async function loadAttachmentsForTransaction(transactionId: string) {
  const { data, error } = await supabaseAdmin
    .from("money_transaction_attachments")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load transaction attachments:", error);
    return [];
  }

  return data || [];
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing transaction ID",
        },
        { status: 400 }
      );
    }

    const { data: beforeData, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .single();

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

    if (beforeData?.deleted_at) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This transaction is in the deleted area. Restore it before editing.",
        },
        { status: 400 }
      );
    }

    const beforeAttachments = await loadAttachmentsForTransaction(id);

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

    const amountPence = toPence(amount);
    const isSponsorLinked = Boolean(sponsorId || sponsorName);

    if (!title || !type || !amountPence) {
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
            isPersonalFunds,
            personalFundsName,
            sponsorId,
            sponsorName,
            sponsorshipNote,
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

    if (isPersonalFunds && !personalFundsName && !isSponsorLinked) {
      return NextResponse.json(
        {
          ok: false,
          error: "Personal funds name is required.",
        },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      title,
      description: cleanOrNull(description),
      type: isSponsorLinked ? "expense" : type,
      category: isSponsorLinked ? "Sponsorship" : cleanOrNull(category),
      amount_pence: amountPence,
      payment_method: isSponsorLinked
        ? "Sponsorship Money"
        : cleanOrNull(paymentMethod),
      transaction_date:
        transactionDate || new Date().toISOString().slice(0, 10),

      source: isSponsorLinked ? "sponsorship" : source || "manual",

      is_personal_funds: isSponsorLinked ? false : isPersonalFunds,
      personal_funds_name:
        isSponsorLinked || !isPersonalFunds
          ? null
          : cleanOrNull(personalFundsName),

      sponsor_id: sponsorId || null,
      sponsor_name: sponsorName || null,
      sponsorship_note: cleanOrNull(sponsorshipNote),

      updated_at: updatedAt,
    };

    /*
      Important:
      Do not update transaction_reference here.
      The reference is created once in the main transactions POST route.
      Editing a transaction should keep the original reference, for example BP-2026-001.
    */

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update(updatePayload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error,
          sent: updatePayload,
        },
        { status: 500 }
      );
    }

    let newAttachments: any[] = [];

    if (invoiceFiles.length > 0) {
      try {
        newAttachments = await uploadTransactionAttachments({
          transactionId: id,
          files: invoiceFiles,
        });

        const firstAttachmentUrl =
          beforeData?.invoice_image_url ||
          beforeAttachments?.[0]?.file_url ||
          newAttachments?.[0]?.file_url ||
          null;

        if (firstAttachmentUrl && firstAttachmentUrl !== data.invoice_image_url) {
          await supabaseAdmin
            .from("money_transactions")
            .update({
              invoice_image_url: firstAttachmentUrl,
              updated_at: updatedAt,
            })
            .eq("id", id);

          data.invoice_image_url = firstAttachmentUrl;
        }
      } catch (attachmentError: any) {
        return NextResponse.json(
          {
            ok: false,
            error:
              attachmentError?.message ||
              "Transaction was updated but one or more attachments failed to upload.",
            details: attachmentError,
            transaction: data,
          },
          { status: 500 }
        );
      }
    }

    const allAttachments = await loadAttachmentsForTransaction(id);

    const transactionWithAttachments = {
      ...data,
      attachments: allAttachments,
    };

    await createMoneyAuditLog({
      action: "edit",
      transactionId: id,
      transactionTitle: data?.title || beforeData?.title || null,
      beforeData: {
        ...beforeData,
        attachments: beforeAttachments,
      },
      afterData: transactionWithAttachments,
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]",
        transaction_reference:
          data?.transaction_reference ||
          beforeData?.transaction_reference ||
          null,
        attachment_count: allAttachments.length,
        new_attachment_count: newAttachments.length,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: transactionWithAttachments,
      message: "Transaction updated successfully",
    });
  } catch (err) {
    console.error("Money transaction PATCH error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing transaction ID",
        },
        { status: 400 }
      );
    }

    const { data: beforeData, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .single();

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

    if (beforeData?.deleted_at) {
      return NextResponse.json({
        ok: true,
        transaction: beforeData,
        message: "Transaction is already in the deleted area.",
      });
    }

    const beforeAttachments = await loadAttachmentsForTransaction(id);

    const deletedAt = new Date().toISOString();
    const deletedBy = await getActorLabel();

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update({
        deleted_at: deletedAt,
        deleted_by: deletedBy,
        updated_at: deletedAt,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

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

    const transactionWithAttachments = {
      ...data,
      attachments: beforeAttachments,
    };

    await createMoneyAuditLog({
      action: "delete",
      transactionId: id,
      transactionTitle: beforeData?.title || data?.title || null,
      beforeData: {
        ...beforeData,
        attachments: beforeAttachments,
      },
      afterData: transactionWithAttachments,
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]",
        delete_type: "soft_delete",
        deleted_at: deletedAt,
        deleted_by: deletedBy,
        transaction_reference:
          beforeData?.transaction_reference ||
          data?.transaction_reference ||
          null,
        attachment_count: beforeAttachments.length,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: transactionWithAttachments,
      message: "Transaction moved to deleted area successfully",
    });
  } catch (err) {
    console.error("Money transaction DELETE error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}