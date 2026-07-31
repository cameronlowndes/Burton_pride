import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLANS_TABLE = "money_direct_debit_plans";
const OCCURRENCES_TABLE = "money_direct_debit_occurrences";
const TRANSACTIONS_TABLE = "money_transactions";
const ATTACHMENTS_TABLE = "money_transaction_attachments";
const AUDIT_LOGS_TABLE = "admin_audit_logs";

const STORAGE_BUCKET =
  process.env.MONEY_INVOICES_BUCKET?.trim() || "money-invoices";

const MAX_RECEIPT_FILE_SIZE = 10 * 1024 * 1024;
const RECEIPT_SIGNED_URL_SECONDS = 60 * 60;

const ALLOWED_RECEIPT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type RouteContext = {
  params: Promise<{
    planId: string;
    occurrenceId: string;
  }>;
};

type JsonRecord = Record<string, unknown>;

type AdminIdentity = {
  id: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
};

type InvoiceDetails = {
  invoiceNumber: string;
  planName: string;
  supplierName: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  paymentDate: string | null;
  paymentStatus: string;
  paymentMethod: string;
  accountName: string;
  bankName: string;
  reference: string;
  notes: string;
  createdAt: string | null;
};

function json(
  body: JsonRecord,
  status = 200,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ...headers,
    },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(value: unknown): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function textValue(
  row: JsonRecord,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function numberValue(
  row: JsonRecord,
  keys: string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(
        value.replace(/[^0-9.-]/g, ""),
      );

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function nullableDateValue(
  row: JsonRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      const date = new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return value;
      }
    }
  }

  return null;
}

function normaliseStatus(value: string): string {
  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (!normalised) {
    return "Scheduled";
  }

  return normalised.replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatMoney(
  amount: number,
  currency: string,
): string {
  const safeCurrency = /^[A-Z]{3}$/.test(
    currency.toUpperCase(),
  )
    ? currency.toUpperCase()
    : "GBP";

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toFixed(2)}`;
  }
}

function safeFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "direct-debit-invoice";
}


function safeUploadedFileName(value: string): string {
  return (
    String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "receipt"
  );
}

function privateStorageReference(storagePath: string): string {
  return `storage://${STORAGE_BUCKET}/${storagePath}`;
}

function storagePathFromReference(value: unknown): string {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const privatePrefix = `storage://${STORAGE_BUCKET}/`;

  if (text.startsWith(privatePrefix)) {
    return text.slice(privatePrefix.length);
  }

  try {
    const url = new URL(text);

    const markers = [
      `/storage/v1/object/public/${STORAGE_BUCKET}/`,
      `/storage/v1/object/sign/${STORAGE_BUCKET}/`,
      `/storage/v1/object/authenticated/${STORAGE_BUCKET}/`,
    ];

    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);

      if (index >= 0) {
        const encodedPath = url.pathname.slice(index + marker.length);

        try {
          return decodeURIComponent(encodedPath);
        } catch {
          return encodedPath;
        }
      }
    }
  } catch {
    return "";
  }

  return "";
}

async function createReceiptSignedUrl(
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(
      storagePath,
      RECEIPT_SIGNED_URL_SECONDS,
    );

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

async function uploadReceiptResponse(
  request: NextRequest,
  context: RouteContext,
) {
  const { planId, occurrenceId } =
    await context.params;

  if (!isUuid(planId)) {
    return json(
      {
        success: false,
        error: "INVALID_PLAN_ID",
        message:
          "The direct debit plan ID is not a valid UUID.",
      },
      400,
    );
  }

  if (!isUuid(occurrenceId)) {
    return json(
      {
        success: false,
        error: "INVALID_OCCURRENCE_ID",
        message:
          "The direct debit occurrence ID is not a valid UUID.",
      },
      400,
    );
  }

  const [
    {
      data: plan,
      error: planError,
    },
    {
      data: occurrence,
      error: occurrenceError,
    },
  ] = await Promise.all([
    supabaseAdmin
      .from(PLANS_TABLE)
      .select("id,title")
      .eq("id", planId)
      .maybeSingle(),

    supabaseAdmin
      .from(OCCURRENCES_TABLE)
      .select("*")
      .eq("id", occurrenceId)
      .eq("plan_id", planId)
      .maybeSingle(),
  ]);

  if (planError) {
    return json(
      {
        success: false,
        error: "PLAN_LOOKUP_FAILED",
        message:
          "The direct debit plan could not be loaded.",
        code: planError.code,
        details: planError.details,
        hint: planError.hint,
      },
      500,
    );
  }

  if (!plan) {
    return json(
      {
        success: false,
        error: "PLAN_NOT_FOUND",
        message:
          "The requested direct debit plan was not found.",
      },
      404,
    );
  }

  if (occurrenceError) {
    return json(
      {
        success: false,
        error: "OCCURRENCE_LOOKUP_FAILED",
        message:
          "The direct debit occurrence could not be loaded.",
        code: occurrenceError.code,
        details: occurrenceError.details,
        hint: occurrenceError.hint,
      },
      500,
    );
  }

  if (!occurrence) {
    return json(
      {
        success: false,
        error: "OCCURRENCE_NOT_FOUND",
        message:
          "The direct debit occurrence could not be found.",
      },
      404,
    );
  }

  const transactionId = String(
    occurrence.transaction_id || "",
  ).trim();

  if (!transactionId || !isUuid(transactionId)) {
    return json(
      {
        success: false,
        error: "MONEY_TRANSACTION_NOT_LINKED",
        message:
          "Make the Direct Debit payment first. The receipt can only be added after its Money Transaction has been created.",
        plan_id: planId,
        occurrence_id: occurrenceId,
      },
      409,
    );
  }

  const formData = await request.formData();

  const fileEntry =
    formData.get("file") ??
    formData.get("receipt") ??
    formData.get("invoice");

  if (!(fileEntry instanceof File)) {
    return json(
      {
        success: false,
        error: "RECEIPT_REQUIRED",
        message:
          "Choose a receipt or invoice before uploading.",
        field: "file",
      },
      400,
    );
  }

  const file = fileEntry;

  if (file.size <= 0) {
    return json(
      {
        success: false,
        error: "EMPTY_RECEIPT",
        message:
          "The selected receipt or invoice is empty.",
      },
      400,
    );
  }

  if (file.size > MAX_RECEIPT_FILE_SIZE) {
    return json(
      {
        success: false,
        error: "RECEIPT_TOO_LARGE",
        message:
          "The receipt or invoice must be 10 MB or smaller.",
        maximum_bytes: MAX_RECEIPT_FILE_SIZE,
        received_bytes: file.size,
      },
      413,
    );
  }

  const mimeType =
    file.type || "application/octet-stream";

  if (!ALLOWED_RECEIPT_TYPES.has(mimeType)) {
    return json(
      {
        success: false,
        error: "INVALID_RECEIPT_TYPE",
        message:
          "Upload a PDF, JPG, PNG or WebP receipt.",
        received_type: mimeType,
      },
      415,
    );
  }

  const uploadedName =
    `${Date.now()}-${crypto.randomUUID()}-${safeUploadedFileName(
      file.name,
    )}`;

  const storagePath =
    `transactions/${transactionId}/${uploadedName}`;

  const bytes = Buffer.from(
    await file.arrayBuffer(),
  );

  const {
    data: uploadedFile,
    error: uploadError,
  } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return json(
      {
        success: false,
        error: "RECEIPT_UPLOAD_FAILED",
        message:
          uploadError.message ||
          "The receipt could not be uploaded.",
      },
      500,
    );
  }

  const storedPath =
    uploadedFile?.path || storagePath;

  const {
    data: attachment,
    error: attachmentError,
  } = await supabaseAdmin
    .from(ATTACHMENTS_TABLE)
    .insert({
      transaction_id: transactionId,
      file_name: file.name || uploadedName,
      file_url:
        privateStorageReference(storedPath),
      file_type: mimeType,
      file_size: file.size,
    })
    .select("*")
    .single();

  if (attachmentError) {
    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([storedPath]);

    return json(
      {
        success: false,
        error: "ATTACHMENT_INSERT_FAILED",
        message:
          "The receipt uploaded, but it could not be connected to the Money Tracker receipt section.",
        code: attachmentError.code,
        details: attachmentError.details,
        hint: attachmentError.hint,
      },
      500,
    );
  }

  const now = new Date().toISOString();

  const {
    data: updatedOccurrence,
    error: occurrenceUpdateError,
  } = await supabaseAdmin
    .from(OCCURRENCES_TABLE)
    .update({
      invoice_url:
        privateStorageReference(storedPath),
      invoice_file_name:
        file.name || uploadedName,
      invoice_uploaded_at: now,
      updated_at: now,
    })
    .eq("id", occurrenceId)
    .eq("plan_id", planId)
    .select("*")
    .single();

  if (occurrenceUpdateError) {
    await supabaseAdmin
      .from(ATTACHMENTS_TABLE)
      .delete()
      .eq("id", attachment.id);

    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([storedPath]);

    return json(
      {
        success: false,
        error: "OCCURRENCE_UPDATE_FAILED",
        message:
          "The receipt was connected to Money Tracker, but the Direct Debit occurrence could not be updated.",
        code: occurrenceUpdateError.code,
        details: occurrenceUpdateError.details,
        hint: occurrenceUpdateError.hint,
      },
      500,
    );
  }

  const {
    data: updatedTransaction,
    error: transactionUpdateError,
  } = await supabaseAdmin
    .from(TRANSACTIONS_TABLE)
    .update({
      invoice_image_url:
        privateStorageReference(storedPath),
      updated_at: now,
    })
    .eq("id", transactionId)
    .select("*")
    .single();

  if (transactionUpdateError) {
    console.warn(
      "Receipt attachment saved, but the legacy invoice_image_url column was not updated.",
      {
        transactionId,
        error: transactionUpdateError,
      },
    );
  }

  const signedUrl =
    await createReceiptSignedUrl(storedPath);

  return json({
    success: true,
    message:
      "The receipt was uploaded and added to the linked Money Tracker receipt section.",
    plan_id: planId,
    occurrence_id: occurrenceId,
    transaction_id: transactionId,
    attachment: {
      ...attachment,
      file_url: signedUrl,
      signed_url: signedUrl,
      storage_path: storedPath,
      signed_url_expires_in:
        RECEIPT_SIGNED_URL_SECONDS,
    },
    occurrence: updatedOccurrence,
    transaction:
      updatedTransaction || null,
    connected_tables: {
      occurrences: OCCURRENCES_TABLE,
      transactions: TRANSACTIONS_TABLE,
      attachments: ATTACHMENTS_TABLE,
    },
  });
}

async function getReceiptResponse(
  context: RouteContext,
) {
  const { planId, occurrenceId } =
    await context.params;

  if (!isUuid(planId) || !isUuid(occurrenceId)) {
    return json(
      {
        success: false,
        error: "INVALID_ID",
        message:
          "The plan ID or occurrence ID is invalid.",
      },
      400,
    );
  }

  const {
    data: occurrence,
    error: occurrenceError,
  } = await supabaseAdmin
    .from(OCCURRENCES_TABLE)
    .select("*")
    .eq("id", occurrenceId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (occurrenceError) {
    return json(
      {
        success: false,
        error: "OCCURRENCE_LOOKUP_FAILED",
        message:
          "The Direct Debit occurrence could not be loaded.",
        code: occurrenceError.code,
        details: occurrenceError.details,
        hint: occurrenceError.hint,
      },
      500,
    );
  }

  if (!occurrence) {
    return json(
      {
        success: false,
        error: "OCCURRENCE_NOT_FOUND",
        message:
          "The Direct Debit occurrence could not be found.",
      },
      404,
    );
  }

  const transactionId = String(
    occurrence.transaction_id || "",
  ).trim();

  if (!transactionId || !isUuid(transactionId)) {
    return json({
      success: true,
      transaction_id: null,
      occurrence,
      attachments: [],
    });
  }

  const {
    data: attachmentRows,
    error: attachmentError,
  } = await supabaseAdmin
    .from(ATTACHMENTS_TABLE)
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", {
      ascending: true,
    });

  if (attachmentError) {
    return json(
      {
        success: false,
        error: "ATTACHMENT_LOOKUP_FAILED",
        message:
          "The Money Tracker receipts could not be loaded.",
        code: attachmentError.code,
        details: attachmentError.details,
        hint: attachmentError.hint,
      },
      500,
    );
  }

  const attachments = await Promise.all(
    (attachmentRows || []).map(
      async (attachment) => {
        const path = storagePathFromReference(
          attachment.file_url,
        );

        const signedUrl = path
          ? await createReceiptSignedUrl(path)
          : String(
              attachment.file_url || "",
            ).trim() || null;

        return {
          ...attachment,
          file_url: signedUrl,
          signed_url: signedUrl,
          storage_path: path || null,
          signed_url_expires_in: path
            ? RECEIPT_SIGNED_URL_SECONDS
            : null,
        };
      },
    ),
  );

  return json({
    success: true,
    plan_id: planId,
    occurrence_id: occurrenceId,
    transaction_id: transactionId,
    occurrence,
    attachments,
  });
}

function getAdminIdentity(
  request: NextRequest,
): AdminIdentity {
  return {
    id:
      request.cookies
        .get("burton_admin_id")
        ?.value?.trim() ||
      request.headers.get("x-admin-id")?.trim() ||
      null,

    name:
      request.cookies
        .get("burton_admin_name")
        ?.value?.trim() ||
      request.headers.get("x-admin-name")?.trim() ||
      null,

    email:
      request.cookies
        .get("burton_admin_email")
        ?.value?.trim() ||
      request.headers.get("x-admin-email")?.trim() ||
      null,

    role:
      request.cookies
        .get("burton_admin_role")
        ?.value?.trim() ||
      request.headers.get("x-admin-role")?.trim() ||
      null,
  };
}

function getRequestIp(
  request: NextRequest,
): string | null {
  const forwardedFor = request.headers.get(
    "x-forwarded-for",
  );

  if (forwardedFor) {
    return (
      forwardedFor.split(",")[0]?.trim() || null
    );
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers
      .get("cf-connecting-ip")
      ?.trim() ||
    null
  );
}

function resolveInvoiceAmount(
  plan: JsonRecord,
  occurrence: JsonRecord,
): number {
  const occurrenceAmountPence = numberValue(
    occurrence,
    ["amount_pence"],
    Number.NaN,
  );

  if (Number.isFinite(occurrenceAmountPence)) {
    return occurrenceAmountPence / 100;
  }

  const planAmountPence = numberValue(
    plan,
    ["amount_pence"],
    Number.NaN,
  );

  if (Number.isFinite(planAmountPence)) {
    return planAmountPence / 100;
  }

  return numberValue(
    occurrence,
    [
      "amount",
      "payment_amount",
      "actual_amount",
      "expected_amount",
      "value",
    ],
    numberValue(
      plan,
      [
        "amount",
        "payment_amount",
        "default_amount",
        "expected_amount",
        "value",
      ],
      0,
    ),
  );
}

function buildInvoiceDetails(
  plan: JsonRecord,
  occurrence: JsonRecord,
): InvoiceDetails {
  const planName = textValue(
    plan,
    [
      "title",
      "name",
      "plan_name",
      "direct_debit_name",
      "payment_name",
    ],
    "Direct Debit",
  );

  const supplierName = textValue(
    occurrence,
    [
      "supplier_name",
      "payee_name",
      "merchant_name",
    ],
    textValue(
      plan,
      [
        "supplier_name",
        "payee_name",
        "merchant_name",
        "company_name",
      ],
      planName,
    ),
  );

  const description = textValue(
    occurrence,
    [
      "description",
      "payment_description",
      "details",
    ],
    textValue(
      plan,
      [
        "description",
        "payment_description",
        "details",
      ],
      `${planName} direct debit payment`,
    ),
  );

  const amount = resolveInvoiceAmount(
    plan,
    occurrence,
  );

  const currency = textValue(
    occurrence,
    ["currency", "currency_code"],
    textValue(
      plan,
      ["currency", "currency_code"],
      "GBP",
    ),
  ).toUpperCase();

  const dueDate = nullableDateValue(occurrence, [
    "due_date",
    "scheduled_date",
    "occurrence_date",
    "payment_due_date",
    "date",
  ]);

  const paymentDate = nullableDateValue(
    occurrence,
    [
      "paid_at",
      "posted_at",
      "payment_date",
      "completed_at",
      "processed_at",
      "actual_payment_date",
    ],
  );

  const status = textValue(
    occurrence,
    ["status", "payment_status"],
    paymentDate ? "paid" : "scheduled",
  );

  const planId = textValue(
    plan,
    ["id"],
    "PLAN",
  );

  const occurrenceId = textValue(
    occurrence,
    ["id"],
    "PAYMENT",
  );

  const invoiceNumber = textValue(
    occurrence,
    [
      "invoice_number",
      "reference_number",
    ],
    `DD-${planId
      .slice(0, 8)
      .toUpperCase()}-${occurrenceId
      .slice(0, 8)
      .toUpperCase()}`,
  );

  return {
    invoiceNumber,
    planName,
    supplierName,
    description,
    amount,
    currency,
    dueDate,
    paymentDate,
    paymentStatus: normaliseStatus(status),

    paymentMethod: textValue(
      occurrence,
      [
        "payment_method",
        "reimbursement_payment_method",
        "method",
      ],
      textValue(
        plan,
        [
          "reimbursement_payment_method",
          "payment_method",
          "method",
        ],
        "Direct Debit",
      ),
    ),

    accountName: textValue(
      occurrence,
      [
        "account_name",
        "bank_account_name",
        "account_holder",
      ],
      textValue(
        plan,
        [
          "account_holder",
          "account_name",
          "bank_account_name",
        ],
        "Burton Pride",
      ),
    ),

    bankName: textValue(
      occurrence,
      ["bank_name", "bank"],
      textValue(
        plan,
        ["bank_name", "bank"],
        "Not recorded",
      ),
    ),

    reference: textValue(
      occurrence,
      [
        "payment_reference",
        "reference",
        "bank_reference",
        "transaction_reference",
        "reimbursement_transaction_id",
        "transaction_id",
      ],
      textValue(
        plan,
        [
          "payment_reference",
          "reference",
          "bank_reference",
          "mandate_reference",
        ],
        "Not recorded",
      ),
    ),

    notes: textValue(
      occurrence,
      ["notes", "payment_notes"],
      textValue(
        plan,
        ["notes", "payment_notes"],
      ),
    ),

    createdAt: nullableDateValue(occurrence, [
      "created_at",
      "inserted_at",
    ]),
  };
}

function drawText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    colour?: ReturnType<typeof rgb>;
    maxWidth?: number;
  },
): void {
  page.drawText(text, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.font,
    color:
      options.colour ??
      rgb(0.12, 0.15, 0.2),
    maxWidth: options.maxWidth,
  });
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const cleanedText = text
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanedText) {
    return [];
  }

  const words = cleanedText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (
      font.widthOfTextAtSize(candidate, size) <=
      maxWidth
    ) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (
      font.widthOfTextAtSize(word, size) <=
      maxWidth
    ) {
      currentLine = word;
      continue;
    }

    let segment = "";

    for (const character of word) {
      const candidateSegment =
        `${segment}${character}`;

      if (
        font.widthOfTextAtSize(
          candidateSegment,
          size,
        ) > maxWidth &&
        segment
      ) {
        lines.push(segment);
        segment = character;
      } else {
        segment = candidateSegment;
      }
    }

    currentLine = segment;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    lineHeight: number;
    maxWidth: number;
    font: PDFFont;
    colour?: ReturnType<typeof rgb>;
    maxLines?: number;
  },
): number {
  const lines = wrapText(
    text,
    options.font,
    options.size,
    options.maxWidth,
  );

  const visibleLines =
    typeof options.maxLines === "number"
      ? lines.slice(0, options.maxLines)
      : lines;

  visibleLines.forEach((line, index) => {
    let output = line;

    if (
      typeof options.maxLines === "number" &&
      index === options.maxLines - 1 &&
      lines.length > options.maxLines
    ) {
      output =
        `${line.replace(/[.\s]+$/g, "")}...`;
    }

    drawText(page, output, {
      x: options.x,
      y:
        options.y -
        index * options.lineHeight,
      size: options.size,
      font: options.font,
      colour: options.colour,
      maxWidth: options.maxWidth,
    });
  });

  return (
    options.y -
    visibleLines.length * options.lineHeight
  );
}

function drawDetailRow(
  page: PDFPage,
  label: string,
  value: string,
  y: number,
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  },
): number {
  drawText(page, label, {
    x: 55,
    y,
    size: 10,
    font: fonts.bold,
    colour: rgb(0.31, 0.35, 0.42),
  });

  const lines = wrapText(
    value || "Not recorded",
    fonts.regular,
    10,
    300,
  );

  const visibleLines =
    lines.length > 0
      ? lines.slice(0, 3)
      : ["Not recorded"];

  visibleLines.forEach((line, index) => {
    drawText(page, line, {
      x: 230,
      y: y - index * 14,
      size: 10,
      font: fonts.regular,
      colour: rgb(0.1, 0.12, 0.16),
      maxWidth: 300,
    });
  });

  const rowHeight = Math.max(
    28,
    visibleLines.length * 14 + 12,
  );

  page.drawLine({
    start: {
      x: 55,
      y: y - rowHeight + 9,
    },
    end: {
      x: 540,
      y: y - rowHeight + 9,
    },
    thickness: 0.6,
    color: rgb(0.88, 0.89, 0.91),
  });

  return y - rowHeight;
}

async function createInvoicePdf(
  invoice: InvoiceDetails,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();

  const regularFont = await document.embedFont(
    StandardFonts.Helvetica,
  );

  const boldFont = await document.embedFont(
    StandardFonts.HelveticaBold,
  );

  document.setTitle(
    `${invoice.planName} - ${invoice.invoiceNumber}`,
  );

  document.setAuthor("Burton Pride");
  document.setSubject(
    "Direct debit payment invoice",
  );

  document.setCreator(
    "Burton Pride Money Management",
  );

  document.setProducer(
    "Burton Pride Admin Portal",
  );

  document.setCreationDate(new Date());
  document.setModificationDate(new Date());

  const page = document.addPage([
    595.28,
    841.89,
  ]);

  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 0,
    y: height - 130,
    width,
    height: 130,
    color: rgb(0.18, 0.1, 0.32),
  });

  page.drawRectangle({
    x: 0,
    y: height - 137,
    width,
    height: 7,
    color: rgb(0.83, 0.2, 0.55),
  });

  drawText(page, "BURTON PRIDE", {
    x: 55,
    y: height - 60,
    size: 22,
    font: boldFont,
    colour: rgb(1, 1, 1),
  });

  drawText(page, "Money Management", {
    x: 55,
    y: height - 83,
    size: 11,
    font: regularFont,
    colour: rgb(0.89, 0.86, 0.94),
  });

  drawText(
    page,
    "DIRECT DEBIT INVOICE",
    {
      x: 342,
      y: height - 62,
      size: 15,
      font: boldFont,
      colour: rgb(1, 1, 1),
    },
  );

  drawText(
    page,
    invoice.invoiceNumber,
    {
      x: 342,
      y: height - 86,
      size: 10,
      font: regularFont,
      colour: rgb(0.89, 0.86, 0.94),
      maxWidth: 200,
    },
  );

  let y = height - 178;

  drawText(page, "Payment summary", {
    x: 55,
    y,
    size: 15,
    font: boldFont,
    colour: rgb(0.18, 0.1, 0.32),
  });

  y -= 26;

  page.drawRectangle({
    x: 55,
    y: y - 91,
    width: 485,
    height: 91,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: rgb(0.87, 0.85, 0.9),
    borderWidth: 1,
  });

  drawText(page, "AMOUNT", {
    x: 75,
    y: y - 24,
    size: 9,
    font: boldFont,
    colour: rgb(0.39, 0.4, 0.46),
  });

  drawText(
    page,
    formatMoney(
      invoice.amount,
      invoice.currency,
    ),
    {
      x: 75,
      y: y - 55,
      size: 22,
      font: boldFont,
      colour: rgb(0.18, 0.1, 0.32),
    },
  );

  drawText(page, "STATUS", {
    x: 340,
    y: y - 24,
    size: 9,
    font: boldFont,
    colour: rgb(0.39, 0.4, 0.46),
  });

  const paidStatuses = new Set([
    "paid",
    "completed",
    "posted",
    "reimbursed",
  ]);

  const paid = paidStatuses.has(
    invoice.paymentStatus.toLowerCase(),
  );

  page.drawRectangle({
    x: 340,
    y: y - 61,
    width: 165,
    height: 28,
    color: paid
      ? rgb(0.87, 0.96, 0.9)
      : rgb(1, 0.95, 0.82),
    borderColor: paid
      ? rgb(0.3, 0.68, 0.42)
      : rgb(0.9, 0.63, 0.16),
    borderWidth: 1,
  });

  drawText(
    page,
    invoice.paymentStatus,
    {
      x: 352,
      y: y - 52,
      size: 11,
      font: boldFont,
      colour: paid
        ? rgb(0.12, 0.42, 0.22)
        : rgb(0.56, 0.35, 0.04),
      maxWidth: 140,
    },
  );

  y -= 125;

  drawText(page, invoice.planName, {
    x: 55,
    y,
    size: 17,
    font: boldFont,
    colour: rgb(0.1, 0.12, 0.16),
    maxWidth: 485,
  });

  y -= 24;

  y = drawWrappedText(
    page,
    invoice.description,
    {
      x: 55,
      y,
      size: 10,
      lineHeight: 15,
      maxWidth: 485,
      font: regularFont,
      colour: rgb(0.35, 0.37, 0.42),
      maxLines: 4,
    },
  );

  y -= 20;

  drawText(page, "Invoice details", {
    x: 55,
    y,
    size: 15,
    font: boldFont,
    colour: rgb(0.18, 0.1, 0.32),
  });

  y -= 28;

  const fonts = {
    regular: regularFont,
    bold: boldFont,
  };

  y = drawDetailRow(
    page,
    "Payee / supplier",
    invoice.supplierName,
    y,
    fonts,
  );

  y = drawDetailRow(
    page,
    "Payment method",
    invoice.paymentMethod,
    y,
    fonts,
  );

  y = drawDetailRow(
    page,
    "Scheduled date",
    formatDate(invoice.dueDate),
    y,
    fonts,
  );

  y = drawDetailRow(
    page,
    "Payment date",
    formatDate(invoice.paymentDate),
    y,
    fonts,
  );

  y = drawDetailRow(
    page,
    "Payment account",
    invoice.accountName,
    y,
    fonts,
  );

  y = drawDetailRow(
    page,
    "Bank",
    invoice.bankName,
    y,
    fonts,
  );

  y = drawDetailRow(
    page,
    "Payment reference",
    invoice.reference,
    y,
    fonts,
  );

  if (invoice.notes && y > 150) {
    y -= 10;

    drawText(page, "Notes", {
      x: 55,
      y,
      size: 13,
      font: boldFont,
      colour: rgb(0.18, 0.1, 0.32),
    });

    drawWrappedText(
      page,
      invoice.notes,
      {
        x: 55,
        y: y - 22,
        size: 9.5,
        lineHeight: 14,
        maxWidth: 485,
        font: regularFont,
        colour: rgb(0.27, 0.29, 0.34),
        maxLines: 5,
      },
    );
  }

  page.drawLine({
    start: {
      x: 55,
      y: 78,
    },
    end: {
      x: 540,
      y: 78,
    },
    thickness: 0.8,
    color: rgb(0.82, 0.83, 0.86),
  });

  drawText(
    page,
    `Generated by Burton Pride Money Management on ${formatDateTime(
      new Date(),
    )}.`,
    {
      x: 55,
      y: 57,
      size: 8,
      font: regularFont,
      colour: rgb(0.45, 0.47, 0.52),
      maxWidth: 400,
    },
  );

  drawText(page, "Page 1 of 1", {
    x: 475,
    y: 57,
    size: 8,
    font: regularFont,
    colour: rgb(0.45, 0.47, 0.52),
  });

  return document.save();
}

async function writeAuditLog(args: {
  request: NextRequest;
  admin: AdminIdentity;
  planId: string;
  occurrenceId: string;
  invoiceNumber: string;
  fileName: string;
  status: "success" | "failed";
  errorMessage?: string;
}): Promise<void> {
  const payload = {
    action:
      args.status === "success"
        ? "money.direct_debit.invoice_downloaded"
        : "money.direct_debit.invoice_download_failed",

    action_label:
      args.status === "success"
        ? "Direct debit invoice downloaded"
        : "Direct debit invoice download failed",

    module: "money_management",
    area: "direct_debits",
    status: args.status,

    risk_level:
      args.status === "success"
        ? "low"
        : "medium",

    admin_id: args.admin.id,

    admin_name:
      args.admin.name ||
      args.admin.email ||
      "Unknown admin",

    admin_email: args.admin.email,
    admin_role: args.admin.role,

    record_type:
      "money_direct_debit_occurrence",

    record_id: args.occurrenceId,

    description:
      args.status === "success"
        ? `Downloaded invoice ${args.invoiceNumber} for direct debit occurrence ${args.occurrenceId}.`
        : `Failed to download invoice for direct debit occurrence ${args.occurrenceId}.`,

    metadata: {
      plan_id: args.planId,
      occurrence_id: args.occurrenceId,
      invoice_number: args.invoiceNumber,
      file_name: args.fileName,
      error_message:
        args.errorMessage || null,
      request_method: args.request.method,
      request_path:
        args.request.nextUrl.pathname,
    },

    ip_address: getRequestIp(args.request),

    user_agent:
      args.request.headers.get(
        "user-agent",
      ),

    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from(AUDIT_LOGS_TABLE)
    .insert(payload);

  if (error) {
    console.error(
      "Direct debit invoice audit log failed",
      {
        planId: args.planId,
        occurrenceId: args.occurrenceId,
        auditError: error,
      },
    );
  }
}

async function generateInvoiceResponse(
  request: NextRequest,
  context: RouteContext,
) {
  const { planId, occurrenceId } =
    await context.params;

  const admin = getAdminIdentity(request);

  if (!isUuid(planId)) {
    return json(
      {
        ok: false,
        success: false,
        error: "INVALID_PLAN_ID",
        message:
          "The direct debit plan ID is not a valid UUID.",
        field: "planId",
      },
      400,
    );
  }

  if (!isUuid(occurrenceId)) {
    return json(
      {
        ok: false,
        success: false,
        error: "INVALID_OCCURRENCE_ID",
        message:
          "The direct debit occurrence ID is not a valid UUID.",
        field: "occurrenceId",
      },
      400,
    );
  }

  let invoiceNumber =
    `DD-${occurrenceId
      .slice(0, 8)
      .toUpperCase()}`;

  let fileName =
    `${safeFileName(invoiceNumber)}.pdf`;

  try {
    const [
      {
        data: planData,
        error: planError,
      },
      {
        data: occurrenceData,
        error: occurrenceError,
      },
    ] = await Promise.all([
      supabaseAdmin
        .from(PLANS_TABLE)
        .select("*")
        .eq("id", planId)
        .maybeSingle(),

      supabaseAdmin
        .from(OCCURRENCES_TABLE)
        .select("*")
        .eq("id", occurrenceId)
        .eq("plan_id", planId)
        .maybeSingle(),
    ]);

    if (planError) {
      console.error(
        "Direct debit plan lookup failed",
        {
          planId,
          occurrenceId,
          error: planError,
        },
      );

      return json(
        {
          ok: false,
          success: false,
          error: "PLAN_LOOKUP_FAILED",
          message:
            "The direct debit plan could not be loaded.",
          code: planError.code,
          details: planError.details,
          hint: planError.hint,
        },
        500,
      );
    }

    if (!planData) {
      return json(
        {
          ok: false,
          success: false,
          error: "PLAN_NOT_FOUND",
          message:
            "The requested direct debit plan was not found.",
          planId,
        },
        404,
      );
    }

    if (occurrenceError) {
      console.error(
        "Direct debit occurrence lookup failed",
        {
          planId,
          occurrenceId,
          error: occurrenceError,
        },
      );

      return json(
        {
          ok: false,
          success: false,
          error:
            "OCCURRENCE_LOOKUP_FAILED",
          message:
            "The direct debit payment occurrence could not be loaded.",
          code: occurrenceError.code,
          details:
            occurrenceError.details,
          hint: occurrenceError.hint,
        },
        500,
      );
    }

    if (!occurrenceData) {
      return json(
        {
          ok: false,
          success: false,
          error: "OCCURRENCE_NOT_FOUND",
          message:
            "The requested payment occurrence was not found for this direct debit plan.",
          planId,
          occurrenceId,
        },
        404,
      );
    }

    if (
      !isRecord(planData) ||
      !isRecord(occurrenceData)
    ) {
      throw new Error(
        "The direct debit database response had an invalid format.",
      );
    }

    const invoice = buildInvoiceDetails(
      planData,
      occurrenceData,
    );

    invoiceNumber =
      invoice.invoiceNumber;

    fileName = `${safeFileName(
      `${invoice.planName}-${invoice.invoiceNumber}`,
    )}.pdf`;

    const pdfBytes =
      await createInvoicePdf(invoice);

    await writeAuditLog({
      request,
      admin,
      planId,
      occurrenceId,
      invoiceNumber,
      fileName,
      status: "success",
    });

    return new NextResponse(
      Buffer.from(pdfBytes),
      {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,

          "Content-Length": String(
            pdfBytes.byteLength,
          ),

          "Cache-Control":
            "private, no-store, no-cache, must-revalidate, max-age=0",

          Pragma: "no-cache",
          Expires: "0",

          "X-Content-Type-Options":
            "nosniff",

          "X-Invoice-Number":
            invoiceNumber,
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unknown server error occurred.";

    console.error(
      "Direct debit invoice generation failed",
      {
        planId,
        occurrenceId,
        error,
      },
    );

    await writeAuditLog({
      request,
      admin,
      planId,
      occurrenceId,
      invoiceNumber,
      fileName,
      status: "failed",
      errorMessage: message,
    });

    return json(
      {
        ok: false,
        success: false,
        error:
          "INVOICE_GENERATION_FAILED",
        message:
          "The direct debit invoice could not be generated.",
        reason: message,
        planId,
        occurrenceId,
      },
      500,
    );
  }
}

/**
 * GET normally downloads the generated PDF invoice.
 *
 * Add ?mode=receipt to return the receipts already connected to the linked
 * Money Tracker transaction.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const mode =
    request.nextUrl.searchParams
      .get("mode")
      ?.trim()
      .toLowerCase();

  if (
    mode === "receipt" ||
    mode === "receipts" ||
    mode === "attachments"
  ) {
    return getReceiptResponse(context);
  }

  return generateInvoiceResponse(
    request,
    context,
  );
}

/**
 * POST supports two behaviours:
 *
 * multipart/form-data:
 *   Upload a receipt and insert it into money_transaction_attachments.
 *
 * JSON or an empty request body:
 *   Generate and return the PDF invoice.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() || "";

  if (
    contentType.includes(
      "multipart/form-data",
    )
  ) {
    return uploadReceiptResponse(
      request,
      context,
    );
  }

  return generateInvoiceResponse(
    request,
    context,
  );
}

/**
 * Explicit method responses.
 */
export async function PUT() {
  return json(
    {
      ok: false,
      success: false,
      error: "METHOD_NOT_ALLOWED",
      message:
        "Use GET to download the invoice, or POST multipart/form-data to upload a receipt.",
    },
    405,
    {
      Allow: "GET, POST",
    },
  );
}

export async function PATCH() {
  return PUT();
}

export async function DELETE() {
  return PUT();
}