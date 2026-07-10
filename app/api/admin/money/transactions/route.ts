import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { getCurrentAdmin } from "@/lib/adminPermissions";
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


/**
 * Private receipt/invoice storage.
 *
 * MONEY_INVOICES_BUCKET must contain the bucket ID, not merely its display
 * label. The default keeps compatibility with the existing project.
 */
const MONEY_INVOICES_BUCKET =
  process.env.MONEY_INVOICES_BUCKET?.trim() || "money-invoices";

const MONEY_INVOICE_SIGNED_URL_SECONDS = 60 * 60;
const MAX_MONEY_INVOICE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MONEY_INVOICE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PRIVATE_STORAGE_REFERENCE_PREFIX =
  `storage://${MONEY_INVOICES_BUCKET}/`;

function isStripeKeyLive() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true;
}

function isStripeKeyTest() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true;
}

function sessionMatchesCurrentStripeMode(sessionId: string) {
  if (isStripeKeyLive()) {
    return sessionId.startsWith("cs_live_");
  }

  if (isStripeKeyTest()) {
    return sessionId.startsWith("cs_test_");
  }

  return false;
}

function clean(
  value:
    | FormDataEntryValue
    | string
    | number
    | boolean
    | null
    | undefined
) {
  const text = String(value || "").trim();

  return text.length > 0 ? text : "";
}

function cleanOrNull(value: string) {
  const text = String(value || "").trim();

  return text.length > 0 ? text : null;
}

function toBoolean(
  value: string | boolean | null | undefined
) {
  if (typeof value === "boolean") {
    return value;
  }

  const text = String(value || "")
    .toLowerCase()
    .trim();

  return (
    text === "true" ||
    text === "1" ||
    text === "yes"
  );
}

function getTransactionYearFromDate(
  dateValue: string | null | undefined
) {
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

function numberToPounds(value: unknown) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return 0;
  }

  return amount;
}

function penceToPounds(value: unknown) {
  const pence = Number(value || 0);

  if (!Number.isFinite(pence)) {
    return 0;
  }

  return pence / 100;
}

function parseBooleanQueryParam(
  value: string | null,
  fallback = false
) {
  if (value === null) {
    return fallback;
  }

  const cleaned = value.toLowerCase().trim();

  if (
    cleaned === "true" ||
    cleaned === "1" ||
    cleaned === "yes"
  ) {
    return true;
  }

  if (
    cleaned === "false" ||
    cleaned === "0" ||
    cleaned === "no"
  ) {
    return false;
  }

  return fallback;
}

function parseSafeLimit(value: string | null) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(Math.floor(parsed), 1000);
}

function isValidYear(value: string) {
  if (!/^\d{4}$/.test(value)) {
    return false;
  }

  const year = Number(value);

  return year >= 2000 && year <= 2200;
}

async function createTransactionReference(year: string) {
  const cleanYear = String(
    year || new Date().getFullYear()
  ).trim();

  const prefix = `BP-${cleanYear}-`;

  const { data, error } = await supabaseAdmin
    .from("money_transactions")
    .select("transaction_reference")
    .like("transaction_reference", `${prefix}%`)
    .order("transaction_reference", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const latestReference =
    data?.[0]?.transaction_reference || "";

  const latestNumber =
    Number(latestReference.replace(prefix, "")) || 0;

  const nextNumber = latestNumber + 1;

  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

async function insertTransactionWithReference(
  insertData: Record<string, any>
) {
  const transactionDate =
    insertData.transaction_date ||
    new Date().toISOString().slice(0, 10);

  const transactionYear =
    getTransactionYearFromDate(transactionDate);

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

    const errorMessage = String(
      error.message || ""
    ).toLowerCase();

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
      message:
        "Failed to create a unique transaction reference.",
    },
    sent: insertData,
  };
}

function privateStorageReference(storagePath: string) {
  return `${PRIVATE_STORAGE_REFERENCE_PREFIX}${storagePath}`;
}

function extractMoneyInvoiceStoragePath(value: unknown) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  if (text.startsWith(PRIVATE_STORAGE_REFERENCE_PREFIX)) {
    return text.slice(PRIVATE_STORAGE_REFERENCE_PREFIX.length);
  }

  /*
   * Support old database rows that contain a Supabase public, signed or
   * authenticated object URL. This allows older receipts to keep working
   * after the bucket is changed to private.
   */
  try {
    const url = new URL(text);

    const possibleMarkers = [
      `/storage/v1/object/public/${MONEY_INVOICES_BUCKET}/`,
      `/storage/v1/object/sign/${MONEY_INVOICES_BUCKET}/`,
      `/storage/v1/object/authenticated/${MONEY_INVOICES_BUCKET}/`,
    ];

    for (const marker of possibleMarkers) {
      const markerIndex = url.pathname.indexOf(marker);

      if (markerIndex >= 0) {
        const encodedPath = url.pathname.slice(
          markerIndex + marker.length
        );

        try {
          return decodeURIComponent(encodedPath);
        } catch {
          return encodedPath;
        }
      }
    }
  } catch {
    // It is not a URL. Continue and return an empty path.
  }

  return "";
}

async function requireMoneyInvoicesBucket() {
  const {
    data: bucket,
    error,
  } = await supabaseAdmin.storage.getBucket(
    MONEY_INVOICES_BUCKET
  );

  if (error || !bucket) {
    console.error(
      "Money invoices bucket could not be found:",
      {
        bucketId:
          MONEY_INVOICES_BUCKET,

        message:
          error?.message ||
          "Bucket was not returned.",

        supabaseProject:
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.SUPABASE_URL ||
          "Not configured",
      }
    );

    throw new Error(
      `The Supabase Storage bucket "${MONEY_INVOICES_BUCKET}" was not found. ` +
        "Check the bucket ID and make sure NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY belong to the same Supabase project."
    );
  }

  if (bucket.public) {
    console.warn(
      `The "${MONEY_INVOICES_BUCKET}" bucket is public. ` +
        "Money receipts and invoices should be stored in a private bucket."
    );
  }

  return bucket;
}

async function createMoneyInvoiceSignedUrl(
  storagePath: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin.storage
    .from(MONEY_INVOICES_BUCKET)
    .createSignedUrl(
      storagePath,
      MONEY_INVOICE_SIGNED_URL_SECONDS
    );

  if (error || !data?.signedUrl) {
    console.error(
      "Failed to create a signed money invoice URL:",
      {
        bucketId:
          MONEY_INVOICES_BUCKET,

        storagePath,

        error:
          error || null,
      }
    );

    return null;
  }

  return data.signedUrl;
}

function validateMoneyInvoiceFile(file: File) {
  if (!file || file.size <= 0) {
    throw new Error(
      "The selected receipt or invoice is empty."
    );
  }

  if (
    file.size >
    MAX_MONEY_INVOICE_SIZE_BYTES
  ) {
    throw new Error(
      `"${file.name}" is too large. ` +
        "Receipts and invoices must be 10 MB or smaller."
    );
  }

  const mimeType =
    file.type ||
    "application/octet-stream";

  if (
    !ALLOWED_MONEY_INVOICE_MIME_TYPES.has(
      mimeType
    )
  ) {
    throw new Error(
      `"${file.name}" is not an allowed receipt file. ` +
        "Please upload a PDF, JPG, PNG or WebP file."
    );
  }

  return mimeType;
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
    if (!file || file.size <= 0) {
      continue;
    }

    const mimeType =
      validateMoneyInvoiceFile(file);

    const cleanName =
      safeFileName(file.name) ||
      "receipt";

    const fileName =
      `${Date.now()}-${crypto.randomUUID()}-${cleanName}`;

    const storagePath =
      `transactions/${transactionId}/${fileName}`;

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    const {
      data: uploadData,
      error: uploadError,
    } = await supabaseAdmin.storage
      .from(MONEY_INVOICES_BUCKET)
      .upload(storagePath, buffer, {
        contentType:
          mimeType,

        cacheControl:
          "3600",

        upsert:
          false,
      });

    if (uploadError) {
      console.error(
        "Money receipt upload failed:",
        {
          bucketId:
            MONEY_INVOICES_BUCKET,

          storagePath,

          originalFileName:
            file.name,

          mimeType,

          fileSize:
            file.size,

          error:
            uploadError,
        }
      );

      throw new Error(
        uploadError.message ||
          `Failed to upload "${file.name}".`
      );
    }

    const storedPath =
      uploadData?.path ||
      storagePath;

    /*
     * file_url stores a permanent private-storage reference, not an expiring
     * signed URL. This works with the existing table and does not require a
     * new storage_path database column.
     */
    const attachmentInsert = {
      transaction_id:
        transactionId,

      file_name:
        file.name ||
        fileName,

      file_url:
        privateStorageReference(
          storedPath
        ),

      file_type:
        mimeType,

      file_size:
        file.size,
    };

    const {
      data: attachment,
      error: attachmentError,
    } = await supabaseAdmin
      .from(
        "money_transaction_attachments"
      )
      .insert(attachmentInsert)
      .select("*")
      .single();

    if (attachmentError) {
      const {
        error: cleanupError,
      } = await supabaseAdmin.storage
        .from(MONEY_INVOICES_BUCKET)
        .remove([storedPath]);

      if (cleanupError) {
        console.error(
          "Failed to remove an orphaned receipt upload:",
          {
            bucketId:
              MONEY_INVOICES_BUCKET,

            storedPath,

            cleanupError,
          }
        );
      }

      throw new Error(
        attachmentError.message ||
          "The receipt uploaded, but its attachment record could not be created."
      );
    }

    const signedUrl =
      await createMoneyInvoiceSignedUrl(
        storedPath
      );

    uploadedAttachments.push({
      ...attachment,

      storage_path:
        storedPath,

      /*
       * Keep the existing frontend contract. The browser receives a usable
       * signed URL in file_url, while the database retains the permanent
       * private-storage reference.
       */
      file_url:
        signedUrl,

      signed_url:
        signedUrl,

      signed_url_expires_in:
        MONEY_INVOICE_SIGNED_URL_SECONDS,
    });
  }

  return uploadedAttachments;
}

async function addSignedUrlToMoneyAttachment(
  attachment: any
) {
  const storagePath =
    String(
      attachment?.storage_path ||
      extractMoneyInvoiceStoragePath(
        attachment?.file_url
      )
    ).trim();

  if (!storagePath) {
    /*
     * Keep non-Supabase legacy links working. A legacy public URL remains
     * usable, but new uploads never store a public URL.
     */
    return {
      ...attachment,

      storage_path:
        null,

      file_url:
        attachment?.file_url ||
        null,

      signed_url:
        null,

      signed_url_expires_in:
        null,
    };
  }

  const signedUrl =
    await createMoneyInvoiceSignedUrl(
      storagePath
    );

  return {
    ...attachment,

    storage_path:
      storagePath,

    file_url:
      signedUrl,

    signed_url:
      signedUrl,

    signed_url_expires_in:
      signedUrl
        ? MONEY_INVOICE_SIGNED_URL_SECONDS
        : null,

    signed_url_error:
      signedUrl
        ? null
        : "The private receipt link could not be generated.",
  };
}

async function loadAttachmentsForTransactions(
  transactionIds: string[]
) {
  if (transactionIds.length === 0) {
    return new Map<string, any[]>();
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "money_transaction_attachments"
    )
    .select("*")
    .in(
      "transaction_id",
      transactionIds
    )
    .order("created_at", {
      ascending:
        true,
    });

  if (error) {
    console.error(
      "Failed to load money transaction attachments:",
      error
    );

    return new Map<string, any[]>();
  }

  const attachments =
    data || [];

  if (attachments.length === 0) {
    return new Map<string, any[]>();
  }

  /*
   * Only check the bucket when at least one attachment needs a private signed
   * URL. Legacy external/public links can still be returned without it.
   */
  const needsPrivateBucket =
    attachments.some((attachment) =>
      Boolean(
        attachment?.storage_path ||
        extractMoneyInvoiceStoragePath(
          attachment?.file_url
        )
      )
    );

  if (needsPrivateBucket) {
    await requireMoneyInvoicesBucket();
  }

  const signedAttachments =
    await Promise.all(
      attachments.map(
        addSignedUrlToMoneyAttachment
      )
    );

  const map =
    new Map<string, any[]>();

  for (
    const attachment of signedAttachments
  ) {
    const transactionId =
      String(
        attachment.transaction_id ||
        ""
      ).trim();

    if (!transactionId) {
      continue;
    }

    if (!map.has(transactionId)) {
      map.set(transactionId, []);
    }

    map
      .get(transactionId)
      ?.push(attachment);
  }

  return map;
}

async function getActorLabel() {
  try {
    const admin = await getCurrentAdmin();

    const actorEmail = admin?.email || null;

    if (actorEmail) {
      return actorEmail;
    }

    return "Unknown admin";
  } catch {
    return "Unknown admin";
  }
}

async function getActorDetails() {
  try {
    const admin = await getCurrentAdmin();

    const actorEmail = admin?.email || null;

    return {
      name: actorEmail || "Unknown admin",
      email: actorEmail,
    };
  } catch {
    return {
      name: "Unknown admin",
      email: null,
    };
  }
}

async function createSupplierLog({
  supplierId,
  supplierName,
  action,
  actionLabel,
  message,
  oldData,
  newData,
  details,
}: {
  supplierId?: string | null;
  supplierName?: string | null;
  action: string;
  actionLabel: string;
  message: string;
  oldData?: any;
  newData?: any;
  details?: any;
}) {
  if (!supplierId && !supplierName) {
    return;
  }

  try {
    const actor = await getActorDetails();

    const { error } = await supabaseAdmin
      .from("money_supplier_logs")
      .insert({
        supplier_id:
          supplierId || null,

        supplier_name:
          supplierName || null,

        action,

        action_label:
          actionLabel,

        message,

        actor_name:
          actor.name,

        actor_email:
          actor.email,

        old_data:
          oldData || null,

        new_data:
          newData || null,

        details:
          details || null,
      });

    if (error) {
      console.error(
        "Failed to create supplier log:",
        error
      );
    }
  } catch (error) {
    console.error(
      "Supplier log create failed:",
      error
    );
  }
}

function supplierChanged(before: any, after: any) {
  return (
    clean(before?.supplier_id) !==
      clean(after?.supplier_id) ||

    clean(before?.supplier_name) !==
      clean(after?.supplier_name) ||

    clean(before?.supplier_category) !==
      clean(after?.supplier_category)
  );
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

        cookie:
          req.headers.get("cookie") || "",
      },

      body: JSON.stringify({
        password,
      }),
    }
  );

  const passwordData =
    await passwordCheck
      .json()
      .catch(() => ({}));

  if (
    !passwordCheck.ok ||
    !passwordData.ok
  ) {
    return {
      ok: false,

      response: NextResponse.json(
        {
          ok: false,

          error:
            passwordData.error ||
            "Main admin password check failed.",

          details:
            passwordData,
        },
        {
          status:
            passwordCheck.status || 500,
        }
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
    const {
      data: donations,
      error: donationError,
    } = await supabaseAdmin
      .from("donations")
      .select(
        `
          id,
          full_name,
          email,
          message,
          donation_type,
          amount_pence,
          currency,
          stripe_checkout_session_id,
          status,
          created_at
        `
      )
      .not(
        "stripe_checkout_session_id",
        "is",
        null
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

    if (donationError) {
      console.error(
        "Failed to load donations for money sync:",
        donationError
      );

      return;
    }

    if (!donations?.length) {
      return;
    }

    for (const donation of donations) {
      const sessionId =
        donation.stripe_checkout_session_id;

      if (!sessionId) {
        continue;
      }

      if (
        !sessionMatchesCurrentStripeMode(
          sessionId
        )
      ) {
        continue;
      }

      const {
        data: existing,
        error: existingError,
      } = await supabaseAdmin
        .from("money_transactions")
        .select("id, deleted_at")
        .eq(
          "stripe_session_id",
          sessionId
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Failed to check existing money transaction:",
          {
            error:
              existingError,

            sessionId,
          }
        );

        continue;
      }

      if (existing) {
        continue;
      }

      let session:
        | Stripe.Checkout.Session
        | null = null;

      try {
        session =
          await stripe.checkout.sessions.retrieve(
            sessionId
          );
      } catch (err) {
        console.error(
          "Failed to retrieve Stripe session:",
          sessionId,
          err
        );

        continue;
      }

      const isPaid =
        session.payment_status === "paid" ||
        session.status === "complete";

      if (!isPaid) {
        continue;
      }

      const amountPence =
        session.amount_total ||
        donation.amount_pence ||
        0;

      if (
        !amountPence ||
        amountPence <= 0
      ) {
        continue;
      }

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

      const donorMessage =
        session.metadata?.message ||
        donation.message ||
        "";

      const donationType =
        session.mode === "subscription" ||
        donation.donation_type === "monthly"
          ? "Monthly donation"
          : "One-time donation";

      const stripeInvoiceId =
        typeof session.invoice === "string"
          ? session.invoice
          : null;

      const stripeCustomerId =
        typeof session.customer === "string"
          ? session.customer
          : null;

      const stripePaymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null;

      const transactionDate =
        session.created
          ? new Date(
              session.created * 1000
            )
              .toISOString()
              .slice(0, 10)

          : new Date(
              donation.created_at ||
                Date.now()
            )
              .toISOString()
              .slice(0, 10);

      const descriptionParts = [
        donorEmail
          ? `Email: ${donorEmail}`
          : "",

        donorMessage
          ? `Message: ${donorMessage}`
          : "",

        session.payment_status
          ? `Payment status: ${session.payment_status}`
          : "",

        session.mode
          ? `Stripe mode: ${session.mode}`
          : "",

        sessionId
          ? `Stripe session: ${sessionId}`
          : "",
      ].filter(Boolean);

      const insertData = {
        title:
          `${donationType} - ${donorName}`,

        description:
          descriptionParts.join("\n") ||
          null,

        type:
          "income",

        category:
          "Donation",

        amount_pence:
          amountPence,

        payment_method:
          "Stripe",

        transaction_date:
          transactionDate,

        bank_reconciliation_status:
          "unmatched",

        bank_reconciled_at:
          null,

        bank_reconciled_by:
          null,

        bank_reconciliation_note:
          null,

        finance_note_status:
          "none",

        finance_note:
          null,

        finance_note_updated_at:
          null,

        finance_note_updated_by:
          null,

        is_personal_funds:
          false,

        personal_funds_name:
          null,

        personal_funds_repaid:
          false,

        personal_funds_repaid_at:
          null,

        sponsor_id:
          null,

        sponsor_name:
          null,

        sponsorship_note:
          null,

        supplier_id:
          null,

        supplier_name:
          null,

        supplier_category:
          null,

        invoice_image_url:
          null,

        stripe_session_id:
          sessionId,

        stripe_invoice_id:
          stripeInvoiceId,

        stripe_customer_id:
          stripeCustomerId,

        stripe_payment_intent_id:
          stripePaymentIntentId,

        source:
          donation.donation_type === "monthly"
            ? "website_monthly_donation"
            : "website_donation",

        deleted_at:
          null,

        deleted_by:
          null,
      };

      const {
        data: inserted,
        error: insertError,
        sent,
      } =
        await insertTransactionWithReference(
          insertData
        );

      if (insertError) {
        console.error(
          "Failed to sync donation into money tracker:",
          {
            error:
              insertError,

            sessionId,

            donationId:
              donation.id,

            sent,
          }
        );

        continue;
      }

      await createMoneyAuditLog({
        action:
          "create",

        transactionId:
          inserted?.id || null,

        transactionTitle:
          inserted?.title ||
          insertData.title,

        beforeData:
          null,

        afterData:
          inserted,

        metadata: {
          source:
            "stripe_donation_sync",

          route:
            "/api/admin/money/transactions",

          stripe_session_id:
            sessionId,

          donation_id:
            donation.id,

          transaction_reference:
            inserted?.transaction_reference ||
            sent?.transaction_reference,
        },
      });
    }
  } catch (err) {
    console.error(
      "Money tracker donation sync failed:",
      err
    );
  }
}

async function createTransactionFromPayload({
  payload,
  invoiceFiles,
}: {
  payload: Record<string, any>;
  invoiceFiles: File[];
}) {
  const title =
    clean(payload.title);

  const description =
    clean(payload.description);

  const type =
    clean(payload.type);

  const category =
    clean(payload.category);

  const amountPounds =
    payload.amount_pence !== undefined
      ? penceToPounds(
          payload.amount_pence
        )
      : numberToPounds(
          payload.amount
        );

  const paymentMethod =
    clean(
      payload.paymentMethod ||
      payload.payment_method
    );

  const transactionDate =
    clean(
      payload.transactionDate ||
      payload.transaction_date
    );

  const source =
    clean(payload.source) ||
    "manual";

  const isPersonalFunds =
    toBoolean(
      payload.isPersonalFunds ??
      payload.is_personal_funds
    );

  const personalFundsName =
    clean(
      payload.personalFundsName ||
      payload.personal_funds_name
    );

  const sponsorId =
    clean(
      payload.sponsorId ||
      payload.sponsor_id
    );

  const sponsorName =
    clean(
      payload.sponsorName ||
      payload.sponsor_name
    );

  const sponsorshipNote =
    clean(
      payload.sponsorshipNote ||
      payload.sponsorship_note
    );

  const supplierId =
    clean(
      payload.supplierId ||
      payload.supplier_id
    );

  const supplierName =
    clean(
      payload.supplierName ||
      payload.supplier_name
    );

  const supplierCategory =
    clean(
      payload.supplierCategory ||
      payload.supplier_category
    );

  const bankReconciliationStatus =
    cleanBankReconciliationStatus(
      payload.bankReconciliationStatus ||
      payload.bank_reconciliation_status
    );

  const bankReconciliationNote =
    clean(
      payload.bankReconciliationNote ||
      payload.bank_reconciliation_note
    );

  const financeNoteStatus =
    cleanFinanceNoteStatus(
      payload.financeNoteStatus ||
      payload.finance_note_status
    );

  const financeNote =
    clean(
      payload.financeNote ||
      payload.finance_note
    );

  const isSponsorLinked =
    Boolean(
      sponsorId ||
      sponsorName
    );

  if (
    !title ||
    !type ||
    amountPounds <= 0
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Title, type and amount are required",

        received: {
          title,
          type,
          amount:
            amountPounds,

          category,

          paymentMethod,

          transactionDate,

          source,

          sponsorId,

          sponsorName,

          supplierId,

          supplierName,

          supplierCategory,
        },
      },
      {
        status: 400,
      }
    );
  }

  if (
    type !== "income" &&
    type !== "expense"
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Type must be income or expense",

        received:
          type,
      },
      {
        status: 400,
      }
    );
  }

  if (
    !paymentMethod &&
    !isSponsorLinked
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Please choose a payment method.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    isPersonalFunds &&
    !personalFundsName
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          "Please enter the name of the person who paid with personal funds.",
      },
      {
        status: 400,
      }
    );
  }

  const finalTransactionDate =
    transactionDate ||
    new Date()
      .toISOString()
      .slice(0, 10);

  const actorLabel =
    await getActorLabel();

  const matchedAt =
    bankReconciliationStatus === "matched"
      ? new Date().toISOString()
      : null;

  const matchedBy =
    bankReconciliationStatus === "matched"
      ? actorLabel
      : null;

  const hasFinanceQuery =
    financeNoteStatus !== "none" ||
    financeNote
      .trim()
      .length > 0;

  const insertData = {
    title,

    description:
      cleanOrNull(description),

    type,

    category:
      isSponsorLinked
        ? "Sponsorship"
        : cleanOrNull(category),

    amount_pence:
      Math.round(
        amountPounds * 100
      ),

    payment_method:
      isSponsorLinked
        ? "Sponsorship Money"
        : cleanOrNull(paymentMethod),

    transaction_date:
      finalTransactionDate,

    bank_reconciliation_status:
      bankReconciliationStatus,

    bank_reconciled_at:
      matchedAt,

    bank_reconciled_by:
      matchedBy,

    bank_reconciliation_note:
      cleanOrNull(
        bankReconciliationNote
      ),

    finance_note_status:
      financeNoteStatus,

    finance_note:
      cleanOrNull(
        financeNote
      ),

    finance_note_updated_at:
      hasFinanceQuery
        ? new Date().toISOString()
        : null,

    finance_note_updated_by:
      hasFinanceQuery
        ? actorLabel
        : null,

    invoice_image_url:
      cleanOrNull(
        payload.invoice_image_url ||
        ""
      ),

    is_personal_funds:
      isSponsorLinked
        ? false
        : isPersonalFunds,

    personal_funds_name:
      isSponsorLinked ||
      !isPersonalFunds
        ? null
        : cleanOrNull(
            personalFundsName
          ),

    personal_funds_repaid:
      toBoolean(
        payload.personalFundsRepaid ??
        payload.personal_funds_repaid
      ),

    personal_funds_repaid_at:
      cleanOrNull(
        clean(
          payload.personalFundsRepaidAt ||
          payload.personal_funds_repaid_at
        )
      ),

    sponsor_id:
      sponsorId || null,

    sponsor_name:
      sponsorName || null,

    sponsorship_note:
      sponsorshipNote || null,

    supplier_id:
      supplierId || null,

    supplier_name:
      supplierName || null,

    supplier_category:
      supplierCategory || null,

    source:
      isSponsorLinked
        ? "sponsorship"
        : source || "manual",

    stripe_session_id:
      cleanOrNull(
        clean(
          payload.stripe_session_id
        )
      ),

    stripe_invoice_id:
      cleanOrNull(
        clean(
          payload.stripe_invoice_id
        )
      ),

    stripe_customer_id:
      cleanOrNull(
        clean(
          payload.stripe_customer_id
        )
      ),

    stripe_payment_intent_id:
      cleanOrNull(
        clean(
          payload.stripe_payment_intent_id
        )
      ),

    deleted_at:
      null,

    deleted_by:
      null,
  };

  const {
    data,
    error,
    sent,
  } =
    await insertTransactionWithReference(
      insertData
    );

  if (
    error ||
    !data?.id
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          "Failed to create transaction.",

        details:
          error,

        sent,
      },
      {
        status: 500,
      }
    );
  }

  let attachments: any[] = [];

  if (invoiceFiles.length > 0) {
    try {
      attachments =
        await uploadTransactionAttachments({
          transactionId:
            data.id,

          files:
            invoiceFiles,
        });

      /*
       * Do not save an expiring signed URL in money_transactions.
       * Attachments are loaded from money_transaction_attachments and receive
       * a fresh signed URL each time GET is called.
       */
      data.invoice_image_url =
        attachments[0]?.file_url ||
        null;
    } catch (attachmentError: any) {
      return NextResponse.json(
        {
          ok: false,

          error:
            attachmentError?.message ||
            "Transaction was created but one or more attachments failed to upload.",

          details:
            attachmentError,

          transaction:
            data,
        },
        {
          status: 500,
        }
      );
    }
  }

  const transactionWithAttachments = {
    ...data,
    attachments,
  };

  await createMoneyAuditLog({
    action:
      "create",

    transactionId:
      data?.id || null,

    transactionTitle:
      data?.title || title,

    beforeData:
      null,

    afterData:
      transactionWithAttachments,

    metadata: {
      source:
        "money_tracker",

      route:
        "/api/admin/money/transactions",

      transaction_reference:
        data?.transaction_reference ||
        sent?.transaction_reference,

      attachment_count:
        attachments.length,

      bank_reconciliation_status:
        bankReconciliationStatus,

      finance_note_status:
        financeNoteStatus,

      finance_note:
        financeNote || null,

      supplier_id:
        supplierId || null,

      supplier_name:
        supplierName || null,

      supplier_category:
        supplierCategory || null,
    },
  });

  if (
    supplierId ||
    supplierName
  ) {
    await createSupplierLog({
      supplierId,

      supplierName:
        supplierName ||
        "Supplier/contact",

      action:
        "transaction_linked",

      actionLabel:
        "Transaction linked",

      message:
        `Transaction created and linked to supplier/contact: ${
          supplierName ||
          "Supplier/contact"
        }`,

      oldData:
        null,

      newData:
        transactionWithAttachments,

      details: {
        transaction_id:
          data.id,

        transaction_reference:
          data?.transaction_reference ||
          sent?.transaction_reference ||
          null,

        transaction_title:
          data.title ||
          title,

        transaction_type:
          data.type ||
          type,

        amount_pence:
          data.amount_pence ||
          Math.round(
            amountPounds * 100
          ),

        transaction_date:
          data.transaction_date ||
          finalTransactionDate,

        payment_method:
          data.payment_method ||
          null,

        supplier_category:
          supplierCategory ||
          null,

        route:
          "/api/admin/money/transactions",
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,

      transaction:
        transactionWithAttachments,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

/**
 * GET /api/admin/money/transactions
 *
 * Supported query parameters:
 *
 * ?year=2026
 * ?limit=500
 * ?includeDeleted=false
 * ?activeOnly=true
 *
 * Existing pages that do not pass query parameters keep their original
 * behaviour and continue receiving all rows, including deleted records.
 *
 * The Refund Tracker can request only active transactions from one year:
 *
 * /api/admin/money/transactions?year=2026&limit=500&includeDeleted=false
 */
export async function GET(req: NextRequest) {
  try {
    await syncPaidDonationsToMoneyTracker();

    const yearParam =
      String(
        req.nextUrl.searchParams.get(
          "year"
        ) || ""
      ).trim();

    const safeLimit =
      parseSafeLimit(
        req.nextUrl.searchParams.get(
          "limit"
        )
      );

    const includeDeleted =
      parseBooleanQueryParam(
        req.nextUrl.searchParams.get(
          "includeDeleted"
        ),
        true
      );

    const activeOnly =
      parseBooleanQueryParam(
        req.nextUrl.searchParams.get(
          "activeOnly"
        ),
        false
      );

    const shouldOnlyShowActive =
      activeOnly ||
      !includeDeleted;

    let query = supabaseAdmin
      .from("money_transactions")
      .select("*")
      .order("deleted_at", {
        ascending: true,
        nullsFirst: true,
      })
      .order("transaction_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (shouldOnlyShowActive) {
      query =
        query.is(
          "deleted_at",
          null
        );
    }

    if (
      yearParam &&
      isValidYear(yearParam)
    ) {
      query =
        query
          .gte(
            "transaction_date",
            `${yearParam}-01-01`
          )
          .lte(
            "transaction_date",
            `${yearParam}-12-31`
          );
    }

    if (safeLimit) {
      query =
        query.limit(
          safeLimit
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,

          error:
            error.message,

          details:
            error,

          likelyFix:
            "Check the public.money_transactions table and confirm that transaction_date, deleted_at and created_at exist.",
        },
        {
          status: 500,
        }
      );
    }

    const rows =
      data || [];

    const attachmentMap =
      await loadAttachmentsForTransactions(
        rows.map(
          (item) =>
            item.id
        )
      );

    const transactionsWithAttachments =
      rows.map((item) => ({
        ...item,

        bank_reconciliation_status:
          item.bank_reconciliation_status ||
          "unmatched",

        bank_reconciled_at:
          item.bank_reconciled_at ||
          null,

        bank_reconciled_by:
          item.bank_reconciled_by ||
          null,

        bank_reconciliation_note:
          item.bank_reconciliation_note ||
          null,

        finance_note_status:
          item.finance_note_status ||
          "none",

        finance_note:
          item.finance_note ||
          null,

        finance_note_updated_at:
          item.finance_note_updated_at ||
          null,

        finance_note_updated_by:
          item.finance_note_updated_by ||
          null,

        supplier_id:
          item.supplier_id ||
          null,

        supplier_name:
          item.supplier_name ||
          null,

        supplier_category:
          item.supplier_category ||
          null,

        attachments:
          attachmentMap.get(
            item.id
          ) || [],
      }));

    return NextResponse.json(
      {
        ok: true,

        transactions:
          transactionsWithAttachments,

        filters: {
          year:
            yearParam &&
            isValidYear(yearParam)
              ? yearParam
              : null,

          include_deleted:
            !shouldOnlyShowActive,

          active_only:
            shouldOnlyShowActive,

          limit:
            safeLimit,

          returned_count:
            transactionsWithAttachments.length,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (err) {
    console.error(
      "Money transactions GET error:",
      err
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          err instanceof Error
            ? err.message
            : "Server error",

        details:
          err,

        likelyFix:
          "Check the terminal or Vercel logs. Confirm that the money_transactions table and Stripe environment settings are available.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType =
      req.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      const payload =
        await req.json();

      return await createTransactionFromPayload({
        payload,

        invoiceFiles:
          [],
      });
    }

    const formData =
      await req.formData();

    const invoiceFiles =
      formData
        .getAll("invoiceFiles")
        .filter(
          (
            file
          ): file is File =>
            file instanceof File &&
            file.size > 0
        );

    const oldSingleInvoiceFile =
      formData.get(
        "invoiceFile"
      );

    if (
      oldSingleInvoiceFile instanceof File &&
      oldSingleInvoiceFile.size > 0 &&
      invoiceFiles.length === 0
    ) {
      invoiceFiles.push(
        oldSingleInvoiceFile
      );
    }

    const payload = {
      title:
        clean(
          formData.get(
            "title"
          )
        ),

      description:
        clean(
          formData.get(
            "description"
          )
        ),

      type:
        clean(
          formData.get(
            "type"
          )
        ),

      category:
        clean(
          formData.get(
            "category"
          )
        ),

      amount:
        clean(
          formData.get(
            "amount"
          )
        ),

      paymentMethod:
        clean(
          formData.get(
            "paymentMethod"
          )
        ),

      transactionDate:
        clean(
          formData.get(
            "transactionDate"
          )
        ),

      source:
        clean(
          formData.get(
            "source"
          )
        ) ||
        "manual",

      isPersonalFunds:
        clean(
          formData.get(
            "isPersonalFunds"
          )
        ),

      personalFundsName:
        clean(
          formData.get(
            "personalFundsName"
          )
        ),

      sponsorId:
        clean(
          formData.get(
            "sponsorId"
          )
        ) ||
        clean(
          formData.get(
            "sponsor_id"
          )
        ),

      sponsorName:
        clean(
          formData.get(
            "sponsorName"
          )
        ) ||
        clean(
          formData.get(
            "sponsor_name"
          )
        ),

      sponsorshipNote:
        clean(
          formData.get(
            "sponsorshipNote"
          )
        ) ||
        clean(
          formData.get(
            "sponsorship_note"
          )
        ),

      supplierId:
        clean(
          formData.get(
            "supplierId"
          )
        ) ||
        clean(
          formData.get(
            "supplier_id"
          )
        ),

      supplierName:
        clean(
          formData.get(
            "supplierName"
          )
        ) ||
        clean(
          formData.get(
            "supplier_name"
          )
        ),

      supplierCategory:
        clean(
          formData.get(
            "supplierCategory"
          )
        ) ||
        clean(
          formData.get(
            "supplier_category"
          )
        ),

      bankReconciliationStatus:
        clean(
          formData.get(
            "bankReconciliationStatus"
          )
        ) ||
        clean(
          formData.get(
            "bank_reconciliation_status"
          )
        ) ||
        "unmatched",

      bankReconciliationNote:
        clean(
          formData.get(
            "bankReconciliationNote"
          )
        ) ||
        clean(
          formData.get(
            "bank_reconciliation_note"
          )
        ) ||
        "",

      financeNoteStatus:
        clean(
          formData.get(
            "financeNoteStatus"
          )
        ) ||
        clean(
          formData.get(
            "finance_note_status"
          )
        ) ||
        "none",

      financeNote:
        clean(
          formData.get(
            "financeNote"
          )
        ) ||
        clean(
          formData.get(
            "finance_note"
          )
        ) ||
        "",
    };

    return await createTransactionFromPayload({
      payload,

      invoiceFiles,
    });
  } catch (err) {
    console.error(
      "Money transactions POST error:",
      err
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          err instanceof Error
            ? err.message
            : "Server error",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireMainAdmin();

    const body =
      await req
        .json()
        .catch(() => ({}));

    const password =
      String(
        body.password || ""
      ).trim();

    if (!password) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "Main admin password is required.",
        },
        {
          status: 400,
        }
      );
    }

    const passwordCheck =
      await checkDeletePasswordThroughSettingsApi(
        req,
        password
      );

    if (
      !passwordCheck.ok &&
      passwordCheck.response
    ) {
      return passwordCheck.response;
    }

    const {
      data: transactions,
      error: loadError,
    } = await supabaseAdmin
      .from("money_transactions")
      .select("*")
      .is(
        "deleted_at",
        null
      );

    if (loadError) {
      return NextResponse.json(
        {
          ok: false,

          error:
            loadError.message,

          details:
            loadError,
        },
        {
          status: 500,
        }
      );
    }

    const rows =
      transactions || [];

    const ids =
      rows.map(
        (item) =>
          item.id
      );

    if (
      ids.length === 0
    ) {
      return NextResponse.json({
        ok: true,

        deletedCount:
          0,

        message:
          "No active transactions to move to deleted area",
      });
    }

    const deletedAt =
      new Date()
        .toISOString();

    const deletedBy =
      await getActorLabel();

    const {
      data: deletedRows,
      error: deleteError,
    } = await supabaseAdmin
      .from("money_transactions")
      .update({
        deleted_at:
          deletedAt,

        deleted_by:
          deletedBy,

        updated_at:
          deletedAt,
      })
      .in(
        "id",
        ids
      )
      .is(
        "deleted_at",
        null
      )
      .select("*");

    if (deleteError) {
      console.error(
        "Soft delete all money transactions error:",
        deleteError
      );

      return NextResponse.json(
        {
          ok: false,

          error:
            deleteError.message,

          details:
            deleteError,
        },
        {
          status: 500,
        }
      );
    }

    await createMoneyAuditLog({
      action:
        "delete_all",

      transactionId:
        null,

      transactionTitle:
        "Delete all transactions",

      beforeData:
        null,

      afterData:
        null,

      changedFields: {
        deleted_at: {
          before:
            null,

          after:
            deletedAt,
        },

        deleted_by: {
          before:
            null,

          after:
            deletedBy,
        },
      },

      metadata: {
        source:
          "money_tracker",

        route:
          "/api/admin/money/transactions",

        delete_type:
          "soft_delete_all",

        deleted_count:
          ids.length,

        deleted_ids:
          ids,
      },
    });

    await createBulkMoneyAuditLogs(
      rows.map(
        (beforeRow) => {
          const afterRow =
            deletedRows?.find(
              (item) =>
                item.id ===
                beforeRow.id
            ) || null;

          return {
            action:
              "delete",

            transactionId:
              beforeRow.id,

            transactionTitle:
              beforeRow.title ||
              null,

            beforeData:
              beforeRow,

            afterData:
              afterRow,

            metadata: {
              source:
                "money_tracker",

              route:
                "/api/admin/money/transactions",

              delete_type:
                "soft_delete_from_delete_all",

              parent_action:
                "delete_all",

              deleted_at:
                deletedAt,

              deleted_by:
                deletedBy,
            },
          };
        }
      )
    );

    return NextResponse.json({
      ok: true,

      deletedCount:
        ids.length,

      message:
        "All active transactions moved to deleted area successfully",
    });
  } catch (err) {
    console.error(
      "Unexpected soft delete all transactions error:",
      err
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          err instanceof Error
            ? err.message
            : "Server error",
      },
      {
        status: 500,
      }
    );
  }
}