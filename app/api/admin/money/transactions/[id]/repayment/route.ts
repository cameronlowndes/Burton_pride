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

function safeFileName(name: string) {
  return String(name || "repayment-proof")
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

async function uploadRepaymentProofFiles({
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
      .slice(2)}-repayment-proof-${cleanName || `proof.${fileExt}`}`;

    const filePath = `transactions/${transactionId}/repayment-proof/${fileName}`;

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
      file_name: `Repayment proof - ${file.name || fileName}`,
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

async function readRepaymentRequest(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const repaidValue = String(formData.get("repaid") || "").trim();
    const repaid =
      repaidValue === "true" || repaidValue === "1" || repaidValue === "yes";

    const proofFiles = formData
      .getAll("repaymentProofFiles")
      .filter((file): file is File => file instanceof File && file.size > 0);

    return {
      repaid,
      proofFiles,
    };
  }

  const body = await req.json().catch(() => ({}));

  return {
    repaid: Boolean(body.repaid),
    proofFiles: [] as File[],
  };
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

    const { repaid, proofFiles } = await readRepaymentRequest(req);

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

    if (!beforeData) {
      return NextResponse.json(
        {
          ok: false,
          error: "Transaction not found.",
        },
        { status: 404 }
      );
    }

    if (beforeData.deleted_at) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This transaction is in the deleted area. Restore it before changing repayment status.",
        },
        { status: 400 }
      );
    }

    const isPersonalFunds =
      beforeData.type === "expense" &&
      (beforeData.is_personal_funds === true ||
        String(beforeData.payment_method || "").toLowerCase() ===
          "personal funds");

    if (!isPersonalFunds) {
      return NextResponse.json(
        {
          ok: false,
          error: "Only personal funds transactions can be marked paid back.",
        },
        { status: 400 }
      );
    }

    const existingAttachments = await loadAttachmentsForTransaction(id);
    const isCurrentlyRepaid = beforeData.personal_funds_repaid === true;
    const isMarkingPaidBack = repaid === true && !isCurrentlyRepaid;

    if (isMarkingPaidBack && proofFiles.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please upload proof before marking this personal funds payment as paid back. Upload a receipt, bank screenshot, or payment confirmation.",
        },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const actor = await getActorLabel();

    let newProofAttachments: any[] = [];

    if (proofFiles.length > 0) {
      try {
        newProofAttachments = await uploadRepaymentProofFiles({
          transactionId: id,
          files: proofFiles,
        });
      } catch (attachmentError: any) {
        return NextResponse.json(
          {
            ok: false,
            error:
              attachmentError?.message ||
              "Failed to upload repayment proof file.",
            details: attachmentError,
          },
          { status: 500 }
        );
      }
    }

    const firstAttachmentUrl =
      beforeData.invoice_image_url ||
      existingAttachments?.[0]?.file_url ||
      newProofAttachments?.[0]?.file_url ||
      null;

    const updatePayload: Record<string, any> = {
      personal_funds_repaid: repaid,
      personal_funds_repaid_at: repaid ? updatedAt : null,
      updated_at: updatedAt,
    };

    if (firstAttachmentUrl && !beforeData.invoice_image_url) {
      updatePayload.invoice_image_url = firstAttachmentUrl;
    }

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
        },
        { status: 500 }
      );
    }

    const allAttachments = await loadAttachmentsForTransaction(id);

    const transactionWithAttachments = {
      ...data,
      attachments: allAttachments,
    };

    await createMoneyAuditLog({
      action: repaid ? "mark_paid_back" : "mark_not_paid_back",
      transactionId: id,
      transactionTitle: data?.title || beforeData?.title || null,
      beforeData: {
        ...beforeData,
        attachments: existingAttachments,
      },
      afterData: transactionWithAttachments,
      changedFields: {
        personal_funds_repaid: {
          before: beforeData.personal_funds_repaid,
          after: repaid,
        },
        personal_funds_repaid_at: {
          before: beforeData.personal_funds_repaid_at,
          after: repaid ? updatedAt : null,
        },
      },
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]/repayment",
        personal_funds_repaid: repaid,
        repayment_updated_by: actor,
        repayment_proof_required: isMarkingPaidBack,
        repayment_proof_uploaded_count: newProofAttachments.length,
        transaction_reference:
          data?.transaction_reference || beforeData?.transaction_reference,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: transactionWithAttachments,
      message: repaid
        ? "Personal funds marked as paid back and proof uploaded."
        : "Personal funds marked as not paid back.",
    });
  } catch (err) {
    console.error("Money repayment PATCH error:", err);

    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Server error",
      },
      { status: 500 }
    );
  }
}