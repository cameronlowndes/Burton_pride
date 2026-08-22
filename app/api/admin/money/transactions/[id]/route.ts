import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { createMoneyAuditLog } from "@/lib/money/adminMoneyAudit";
import { requireAdmin } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY_INVOICES_BUCKET =
  process.env.MONEY_INVOICES_BUCKET?.trim() || "money-invoices";

const PRIVATE_STORAGE_REFERENCE_PREFIX =
  `storage://${MONEY_INVOICES_BUCKET}/`;

/*
 * Receipt/document types supported by the Money Management app.
 *
 * Supabase Storage enforces allowed MIME types at the bucket level, so the
 * route makes sure the private money-invoices bucket includes these before
 * uploading a receipt.
 */
const MONEY_INVOICE_ALLOWED_MIME_TYPES = [
  // PDF
  "application/pdf",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // Microsoft Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Microsoft Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  // CSV / plain text
  "text/csv",
  "text/plain",

  // Email files accepted by the transaction form
  "message/rfc822",
  "application/vnd.ms-outlook",
] as const;

const MAX_RECEIPT_FILE_SIZE = 15 * 1024 * 1024;
const MAX_RECEIPT_TOTAL_SIZE = 50 * 1024 * 1024;
const MAX_RECEIPT_FILES = 10;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const allowedBankReconciliationStatuses = [
  "unmatched",
  "matched",
  "needs_review",
  "ignored",
];

const allowedFinanceNoteStatuses = [
  "none",
  "waiting_for_receipt",
  "ask_sponsor",
  "bank_query",
  "resolved",
];

function clean(value: FormDataEntryValue | string | null | undefined) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : "";
}

function cleanOrNull(value: string) {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
}

function toBoolean(value: string) {
  const text = String(value || "").toLowerCase().trim();
  return text === "true" || text === "1" || text === "yes";
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

function cleanBankReconciliationStatus(value: unknown) {
  const status = String(value || "unmatched").trim();

  if (allowedBankReconciliationStatuses.includes(status)) {
    return status;
  }

  return "unmatched";
}

function cleanFinanceNoteStatus(value: unknown) {
  const status = String(value || "none").trim();

  if (allowedFinanceNoteStatuses.includes(status)) {
    return status;
  }

  return "none";
}

async function getActorLabel() {
  try {
    const admin = await requireAdmin();
    const safeAdmin = admin as any;

    const actorName =
      safeAdmin?.name ||
      safeAdmin?.full_name ||
      safeAdmin?.fullName ||
      safeAdmin?.username ||
      safeAdmin?.display_name ||
      null;

    const actorEmail = safeAdmin?.email || null;

    if (actorName && actorEmail) return `${actorName} (${actorEmail})`;
    if (actorName) return actorName;
    if (actorEmail) return actorEmail;

    return "Unknown admin";
  } catch {
    return "Unknown admin";
  }
}

function privateStorageReference(storagePath: string) {
  return `${PRIVATE_STORAGE_REFERENCE_PREFIX}${storagePath}`;
}

async function requireMoneyInvoicesBucket() {
  const { data: bucket, error } =
    await supabaseAdmin.storage.getBucket(MONEY_INVOICES_BUCKET);

  if (error || !bucket) {
    console.error("Money invoice bucket check failed:", {
      bucket: MONEY_INVOICES_BUCKET,
      message: error?.message || "Bucket not found",
      statusCode: (error as any)?.statusCode || null,
      error,
    });

    throw Object.assign(
      new Error(
        error?.message ||
          `Supabase Storage bucket "${MONEY_INVOICES_BUCKET}" was not found.`,
      ),
      {
        code:
          (error as any)?.statusCode ||
          "MONEY_INVOICE_BUCKET_NOT_FOUND",
        details: error || null,
        hint:
          `Confirm the Storage bucket ID is exactly "${MONEY_INVOICES_BUCKET}" and that SUPABASE_SERVICE_ROLE_KEY belongs to the same Supabase project.`,
      },
    );
  }

  /*
   * Supabase may expose bucket properties using snake_case depending on the
   * Storage client/version. Read both forms so this remains compatible.
   */
  const rawBucket = bucket as any;

  const existingAllowedMimeTypes = Array.isArray(
    rawBucket.allowed_mime_types,
  )
    ? rawBucket.allowed_mime_types
    : Array.isArray(rawBucket.allowedMimeTypes)
      ? rawBucket.allowedMimeTypes
      : [];

  const mergedAllowedMimeTypes = Array.from(
    new Set([
      ...existingAllowedMimeTypes
        .map((value: unknown) => String(value || "").trim())
        .filter(Boolean),
      ...MONEY_INVOICE_ALLOWED_MIME_TYPES,
    ]),
  );

  const existingNormalised = new Set(
    existingAllowedMimeTypes
      .map((value: unknown) => String(value || "").trim())
      .filter(Boolean),
  );

  const missingRequiredMimeTypes =
    MONEY_INVOICE_ALLOWED_MIME_TYPES.filter(
      (mimeType) => !existingNormalised.has(mimeType),
    );

  /*
   * Automatically repair the bucket configuration when DOCX or any other
   * supported Money Management document type is missing.
   *
   * Keep the bucket private because receipts and invoices are financial
   * documents. The app serves them using signed URLs.
   */
  if (
    missingRequiredMimeTypes.length > 0 ||
    rawBucket.public === true
  ) {
    const { data: updatedBucket, error: updateError } =
      await supabaseAdmin.storage.updateBucket(
        MONEY_INVOICES_BUCKET,
        {
          public: false,
          allowedMimeTypes: mergedAllowedMimeTypes,
          fileSizeLimit: MAX_RECEIPT_FILE_SIZE,
        },
      );

    if (updateError) {
      console.error(
        "Money invoice bucket MIME configuration update failed:",
        {
          bucket: MONEY_INVOICES_BUCKET,
          missingRequiredMimeTypes,
          mergedAllowedMimeTypes,
          message: updateError.message,
          statusCode: (updateError as any)?.statusCode || null,
          error: updateError,
        },
      );

      throw Object.assign(
        new Error(
          updateError.message ||
            `Could not update the "${MONEY_INVOICES_BUCKET}" bucket to allow Money Management receipt files.`,
        ),
        {
          code:
            (updateError as any)?.statusCode ||
            "MONEY_INVOICE_BUCKET_UPDATE_FAILED",
          details: {
            bucket: MONEY_INVOICES_BUCKET,
            missingRequiredMimeTypes,
            allowedMimeTypes: mergedAllowedMimeTypes,
            updateError,
          },
          hint:
            "Make sure the Supabase service-role key can update Storage bucket settings.",
        },
      );
    }

    console.info("Money invoice bucket configuration updated:", {
      bucket: MONEY_INVOICES_BUCKET,
      addedMimeTypes: missingRequiredMimeTypes,
      private: true,
    });

    return updatedBucket || bucket;
  }

  return bucket;
}

function validateReceiptMimeType(file: File) {
  const mimeType = String(
    file.type || "application/octet-stream",
  )
    .trim()
    .toLowerCase();

  if (
    !MONEY_INVOICE_ALLOWED_MIME_TYPES.includes(
      mimeType as (typeof MONEY_INVOICE_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw Object.assign(
      new Error(
        `"${file.name}" has an unsupported file type (${mimeType}).`,
      ),
      {
        code: "UNSUPPORTED_RECEIPT_MIME_TYPE",
        details: {
          fileName: file.name,
          mimeType,
        },
        hint:
          "Upload a PDF, image, Word document, Excel spreadsheet, CSV, text file or supported email file.",
      },
    );
  }

  return mimeType;
}

function dedupeReceiptFiles(files: File[]) {
  const seen = new Set<string>();

  return files.filter((file) => {
    if (!(file instanceof File) || file.size <= 0) {
      return false;
    }

    const key = [
      file.name,
      file.size,
      file.type,
      file.lastModified,
    ].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getReceiptFilesFromFormData(formData: FormData) {
  const possibleFiles = [
    ...formData.getAll("invoiceFiles"),
    ...formData.getAll("receipt_files"),
    ...formData.getAll("receiptFiles"),
    ...formData.getAll("attachments"),
  ].filter(
    (value): value is File =>
      value instanceof File && value.size > 0,
  );

  const legacySingleFiles = [
    formData.get("invoiceFile"),
    formData.get("receipt_file"),
    formData.get("receiptFile"),
  ].filter(
    (value): value is File =>
      value instanceof File && value.size > 0,
  );

  const files = dedupeReceiptFiles([
    ...possibleFiles,
    ...legacySingleFiles,
  ]);

  if (files.length > MAX_RECEIPT_FILES) {
    throw new Error(
      `Choose no more than ${MAX_RECEIPT_FILES} receipt files.`,
    );
  }

  for (const file of files) {
    validateReceiptMimeType(file);
  }

  const oversized = files.find(
    (file) => file.size > MAX_RECEIPT_FILE_SIZE,
  );

  if (oversized) {
    throw new Error(
      `"${oversized.name}" is larger than 15 MB.`,
    );
  }

  const totalSize = files.reduce(
    (sum, file) => sum + file.size,
    0,
  );

  if (totalSize > MAX_RECEIPT_TOTAL_SIZE) {
    throw new Error(
      "The selected receipt files are larger than 50 MB in total.",
    );
  }

  return files;
}

async function safeCreateMoneyAuditLog(
  input: Parameters<typeof createMoneyAuditLog>[0],
) {
  try {
    await createMoneyAuditLog(input);
  } catch (auditError) {
    /*
     * Audit logging must never turn a transaction that was successfully
     * updated in money_transactions into a 500 response.
     *
     * The failure is still logged for the server/Vercel logs so it can be
     * investigated independently.
     */
    console.error(
      "Money transaction audit log failed after successful database action:",
      auditError,
    );
  }
}

async function uploadTransactionAttachments({
  transactionId,
  files,
}: {
  transactionId: string;
  files: File[];
}) {
  await requireMoneyInvoicesBucket();

  const uploadedAttachments: any[] = [];

  for (const file of files) {
    if (!file || file.size <= 0) continue;

    const fileExt = file.name.split(".").pop() || "file";
    const cleanName = safeFileName(file.name);
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}-${cleanName || `attachment.${fileExt}`}`;

    const filePath = `transactions/${transactionId}/${fileName}`;

    const mimeType = validateReceiptMimeType(file);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(MONEY_INVOICES_BUCKET)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      const storageError = uploadError as any;

      console.error("Money transaction receipt storage upload failed:", {
        transactionId,
        bucket: MONEY_INVOICES_BUCKET,
        filePath,
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
        storageMessage: storageError?.message || null,
        storageStatusCode: storageError?.statusCode || null,
        storageError: storageError?.error || null,
        fullError: uploadError,
      });

      throw Object.assign(
        new Error(
          storageError?.message ||
            `Failed to upload receipt "${file.name}".`,
        ),
        {
          code:
            storageError?.statusCode ||
            storageError?.error ||
            "MONEY_RECEIPT_STORAGE_UPLOAD_FAILED",
          details: {
            bucket: MONEY_INVOICES_BUCKET,
            filePath,
            fileName: file.name,
            fileType: mimeType,
            fileSize: file.size,
            storageMessage: storageError?.message || null,
            storageStatusCode: storageError?.statusCode || null,
            storageError: storageError?.error || null,
          },
          hint:
            "Check the money-invoices Storage bucket exists, the service-role key belongs to the same Supabase project, and the bucket file-size/MIME restrictions allow this receipt.",
        },
      );
    }

    /*
     * Store a permanent private-storage reference in the database.
     *
     * Do not use getPublicUrl() for finance receipts. The main transactions
     * GET route can turn this reference into a short-lived signed URL.
     */
    const attachmentInsert = {
      transaction_id: transactionId,
      file_name: file.name || fileName,
      file_url: privateStorageReference(filePath),
      file_type: mimeType,
      file_size: file.size || null,
    };

    const { data: attachment, error: attachmentError } = await supabaseAdmin
      .from("money_transaction_attachments")
      .insert(attachmentInsert)
      .select("*")
      .single();

    if (attachmentError) {
      console.error("Money transaction attachment row insert failed:", {
        transactionId,
        filePath,
        attachmentInsert,
        error: attachmentError,
      });

      /*
       * Remove the object again if the database attachment row could not be
       * created, otherwise Storage would contain an orphaned receipt.
       */
      const { error: cleanupError } = await supabaseAdmin.storage
        .from(MONEY_INVOICES_BUCKET)
        .remove([filePath]);

      if (cleanupError) {
        console.error(
          "Failed to clean up orphaned money receipt after attachment insert failure:",
          {
            transactionId,
            filePath,
            cleanupError,
          },
        );
      }

      throw new Error(
        attachmentError.message ||
          "The receipt uploaded, but its attachment record could not be created.",
      );
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
    await requireAdmin();

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing transaction ID" },
        { status: 400 }
      );
    }

    const { data: beforeData, error: loadError } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError) {
      console.error("Money transaction PATCH load failed:", {
        transactionId: id,
        error: loadError,
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            loadError.code === "PGRST116"
              ? "Transaction not found."
              : loadError.message,
          code:
            loadError.code ||
            "MONEY_TRANSACTION_LOAD_FAILED",
          details: loadError.details || null,
          hint: loadError.hint || null,
        },
        {
          status:
            loadError.code === "PGRST116"
              ? 404
              : 500,
        },
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

    const bankReconciliationStatus = cleanBankReconciliationStatus(
      clean(formData.get("bankReconciliationStatus")) ||
        clean(formData.get("bank_reconciliation_status")) ||
        beforeData?.bank_reconciliation_status ||
        "unmatched"
    );

    const bankReconciliationNote =
      clean(formData.get("bankReconciliationNote")) ||
      clean(formData.get("bank_reconciliation_note"));

    const financeNoteStatus = cleanFinanceNoteStatus(
      clean(formData.get("financeNoteStatus")) ||
        clean(formData.get("finance_note_status")) ||
        beforeData?.finance_note_status ||
        "none"
    );

    const financeNote =
      clean(formData.get("financeNote")) ||
      clean(formData.get("finance_note"));

    /*
     * Accept every receipt field name currently used by the Money Tracker.
     *
     * New form:
     *   receipt_files
     *
     * Existing/legacy forms:
     *   invoiceFiles
     *   invoiceFile
     *   receiptFiles
     *   receiptFile
     */
    let invoiceFiles: File[] = [];

    try {
      invoiceFiles = getReceiptFilesFromFormData(formData);
    } catch (fileError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            fileError instanceof Error
              ? fileError.message
              : "The selected receipt files are invalid.",
          code: "INVALID_RECEIPT_FILES",
        },
        { status: 400 },
      );
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
            bankReconciliationStatus,
            bankReconciliationNote,
            financeNoteStatus,
            financeNote,
          },
        },
        { status: 400 }
      );
    }

    if (type !== "income" && type !== "expense") {
      return NextResponse.json(
        { ok: false, error: "Type must be income or expense", received: type },
        { status: 400 }
      );
    }

    if (!paymentMethod && !isSponsorLinked) {
      return NextResponse.json(
        { ok: false, error: "Please choose a payment method." },
        { status: 400 }
      );
    }

    if (isPersonalFunds && !personalFundsName && !isSponsorLinked) {
      return NextResponse.json(
        { ok: false, error: "Personal funds name is required." },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const actorLabel = await getActorLabel();

    const wasBankMatched = beforeData?.bank_reconciliation_status === "matched";
    const isBankMatched = bankReconciliationStatus === "matched";

    const bankReconciledAt =
      isBankMatched && !wasBankMatched
        ? updatedAt
        : isBankMatched
          ? beforeData?.bank_reconciled_at || updatedAt
          : null;

    const bankReconciledBy =
      isBankMatched && !wasBankMatched
        ? actorLabel
        : isBankMatched
          ? beforeData?.bank_reconciled_by || actorLabel
          : null;

    const beforeFinanceStatus = beforeData?.finance_note_status || "none";
    const beforeFinanceNote = beforeData?.finance_note || "";

    const financeNoteChanged =
      financeNoteStatus !== beforeFinanceStatus ||
      financeNote !== beforeFinanceNote;

    const hasFinanceQuery =
      financeNoteStatus !== "none" || financeNote.trim().length > 0;

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

      bank_reconciliation_status: bankReconciliationStatus,
      bank_reconciled_at: bankReconciledAt,
      bank_reconciled_by: bankReconciledBy,
      bank_reconciliation_note: cleanOrNull(bankReconciliationNote),

      finance_note_status: financeNoteStatus,
      finance_note: cleanOrNull(financeNote),
      finance_note_updated_at: financeNoteChanged
        ? hasFinanceQuery
          ? updatedAt
          : null
        : beforeData?.finance_note_updated_at || null,
      finance_note_updated_by: financeNoteChanged
        ? hasFinanceQuery
          ? actorLabel
          : null
        : beforeData?.finance_note_updated_by || null,

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

    const { data, error } = await supabaseAdmin
      .from("money_transactions")
      .update(updatePayload)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      console.error("Money transaction PATCH database update failed:", {
        transactionId: id,
        code: error.code || null,
        message: error.message,
        details: error.details || null,
        hint: error.hint || null,
        sent: updatePayload,
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            error.message ||
            "The transaction could not be updated.",
          code:
            error.code ||
            "MONEY_TRANSACTION_UPDATE_FAILED",
          details: error.details || null,
          hint: error.hint || null,
          sent: updatePayload,
        },
        { status: 500 },
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
        console.error(
          "Money transaction PATCH receipt upload failed after transaction update:",
          {
            transactionId: id,
            receiptCount: invoiceFiles.length,
            receiptNames: invoiceFiles.map((file) => file.name),
            error: attachmentError,
          },
        );

        /*
         * The transaction row itself has already been updated successfully.
         * Return 502 for the attachment/storage failure instead of reporting a
         * misleading generic transaction-update 500.
         */
        return NextResponse.json(
          {
            ok: false,
            partialSuccess: true,
            transactionUpdated: true,
            receiptUploaded: false,
            error:
              attachmentError?.message ||
              "The transaction was updated, but one or more receipts could not be uploaded.",
            code:
              attachmentError?.code ||
              "MONEY_RECEIPT_UPLOAD_FAILED",
            details:
              attachmentError?.details ||
              (attachmentError instanceof Error
                ? attachmentError.message
                : attachmentError),
            hint:
              attachmentError?.hint ||
              "Check the Supabase Storage bucket and receipt upload settings.",
            transaction: data,
          },
          { status: 502 },
        );
      }
    }

    const allAttachments = await loadAttachmentsForTransaction(id);

    const transactionWithAttachments = {
      ...data,
      attachments: allAttachments,
    };

    await safeCreateMoneyAuditLog({
      action: "edit",
      transactionId: id,
      transactionTitle: data?.title || beforeData?.title || null,
      beforeData: {
        ...beforeData,
        attachments: beforeAttachments,
      },
      afterData: transactionWithAttachments,
      changedFields: {
        bank_reconciliation_status: {
          before: beforeData?.bank_reconciliation_status || "unmatched",
          after: data?.bank_reconciliation_status || "unmatched",
        },
        bank_reconciliation_note: {
          before: beforeData?.bank_reconciliation_note || null,
          after: data?.bank_reconciliation_note || null,
        },
        finance_note_status: {
          before: beforeData?.finance_note_status || "none",
          after: data?.finance_note_status || "none",
        },
        finance_note: {
          before: beforeData?.finance_note || null,
          after: data?.finance_note || null,
        },
      },
      metadata: {
        source: "money_tracker",
        route: "/api/admin/money/transactions/[id]",
        transaction_reference:
          data?.transaction_reference ||
          beforeData?.transaction_reference ||
          null,
        attachment_count: allAttachments.length,
        new_attachment_count: newAttachments.length,
        bank_reconciliation_status: data?.bank_reconciliation_status || null,
        finance_note_status: data?.finance_note_status || null,
        finance_note_changed: financeNoteChanged,
      },
    });

    return NextResponse.json({
      ok: true,
      transaction: transactionWithAttachments,
      receiptUpload: {
        requested: invoiceFiles.length,
        uploaded: newAttachments.length,
        totalAttachments: allAttachments.length,
      },
      message:
        newAttachments.length > 0
          ? `Transaction updated successfully with ${newAttachments.length} new receipt file${newAttachments.length === 1 ? "" : "s"}.`
          : "Transaction updated successfully",
    });
  } catch (err: any) {
    console.error("Money transaction PATCH unexpected error:", {
      message:
        err instanceof Error
          ? err.message
          : String(err || "Unknown error"),
      code: err?.code || null,
      details: err?.details || null,
      hint: err?.hint || null,
      stack:
        err instanceof Error
          ? err.stack
          : null,
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Unexpected server error while updating transaction.",
        code:
          err?.code ||
          "MONEY_TRANSACTION_PATCH_FAILED",
        details:
          err?.details ||
          null,
        hint:
          err?.hint ||
          null,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing transaction ID" },
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
        { ok: false, error: loadError.message, details: loadError },
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
        { ok: false, error: error.message, details: error },
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
        finance_note_status: beforeData?.finance_note_status || "none",
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