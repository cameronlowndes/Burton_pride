import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  lotteryAdminDb,
  requireLotteryPermission,
} from "@/lib/lottery/adminAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const REQUIRED_PERMISSION = "lottery:manage";
const STORAGE_BUCKET = "lottery-paper-ticket-designs";
const CREATE_BATCH_RPC = "create_lottery_paper_ticket_batch";

const MAX_BATCH_SIZE = 5_000;
const MAX_DESIGN_BYTES = 15 * 1024 * 1024;
const ALLOWED_TICKETS_PER_SHEET = new Set([2, 4, 6]);
const ALLOWED_DUPLEX_FLIPS = new Set(["long_edge", "short_edge"]);
const ALLOWED_CODE_FORMATS = new Set(["qr", "qr_and_code128"]);
const ALLOWED_DESIGN_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

type LotteryRow = {
  id: string;
  title: string;
  slug: string;
  status: string | null;
  max_tickets: number | null;
  paper_tickets_enabled: boolean | null;
};

type GeneratedTicket = {
  ticket_uuid: string;
  ticket_number: string;
  barcode_token: string;
  barcode_token_hash: string;
  barcode_value: string;
};

type RpcBatchResult = {
  batch_id?: string;
  batch_reference?: string;
  created_count?: number;
  status?: string;
};

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(code ? { code } : {}),
    },
    { status },
  );
}

function cleanFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getDesignFile(formData: FormData, name: string) {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

function validateDesignFileMetadata(file: File, label: string) {
  if (!ALLOWED_DESIGN_TYPES.has(file.type)) {
    return `${label} artwork must be a PNG, JPEG or WebP image.`;
  }
  if (file.size > MAX_DESIGN_BYTES) {
    return `${label} artwork must be 15 MB or smaller.`;
  }
  return null;
}

async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  if (file.type === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every((value, index) => bytes[index] === value);
  }

  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (file.type === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
}

function randomCode(length: number) {
  // Ambiguous characters are omitted so printed numbers are easier to read.
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const output: string[] = [];

  while (output.length < length) {
    for (const byte of randomBytes(Math.max(16, length))) {
      // Rejection sampling avoids modulo bias.
      const limit = 256 - (256 % alphabet.length);
      if (byte >= limit) continue;
      output.push(alphabet[byte % alphabet.length]);
      if (output.length === length) break;
    }
  }

  return output.join("");
}

function ticketPrefix(lottery: LotteryRow) {
  const source = lottery.slug || lottery.title || "BP";
  const cleaned = source.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (cleaned.slice(0, 3) || "BP").padEnd(3, "X");
}

function createTickets(
  lottery: LotteryRow,
  quantity: number,
  verificationBaseUrl: string,
) {
  const prefix = ticketPrefix(lottery);
  const numbers = new Set<string>();
  const tickets: GeneratedTicket[] = [];

  while (tickets.length < quantity) {
    const ticketNumber = `${prefix}-${randomCode(4)}-${randomCode(4)}`;
    if (numbers.has(ticketNumber)) continue;
    numbers.add(ticketNumber);

    const barcodeToken = randomBytes(32).toString("base64url");
    tickets.push({
      ticket_uuid: randomUUID(),
      ticket_number: ticketNumber,
      barcode_token: barcodeToken,
      barcode_token_hash: createHash("sha256")
        .update(barcodeToken)
        .digest("hex"),
      barcode_value: new URL(
        `/Lottery/Ticket/${barcodeToken}`,
        verificationBaseUrl,
      ).toString(),
    });
  }

  return tickets;
}

function storageExtension(file: File) {
  return ALLOWED_DESIGN_TYPES.get(file.type) || "bin";
}

async function uploadDesign(
  database: ReturnType<typeof lotteryAdminDb>,
  batchId: string,
  side: "front" | "back",
  file: File,
) {
  const path = `${batchId}/${side}.${storageExtension(file)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await database.storage.from(STORAGE_BUCKET).upload(
    path,
    bytes,
    {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    },
  );

  if (error) {
    console.error("Paper ticket artwork upload failed", {
      side,
      batchId,
      error,
    });
    throw new Error(`The ${side} artwork could not be stored.`);
  }

  return path;
}

async function removeUploadedDesigns(
  database: ReturnType<typeof lotteryAdminDb>,
  paths: string[],
) {
  if (!paths.length) return;

  const { error } = await database.storage
    .from(STORAGE_BUCKET)
    .remove(paths);

  if (error) {
    console.error("Paper ticket artwork cleanup failed", { paths, error });
  }
}

function normaliseRpcResult(data: unknown): RpcBatchResult | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object"
      ? (first as RpcBatchResult)
      : null;
  }

  return data && typeof data === "object"
    ? (data as RpcBatchResult)
    : null;
}

function databaseErrorResponse(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) {
  const combined = `${error.message || ""} ${error.details || ""}`;

  if (
    error.code === "P0001" &&
    combined.includes("PAPER_TICKET_LIMIT_EXCEEDED")
  ) {
    return jsonError(
      "This batch would exceed the lottery's maximum total entries.",
      409,
      "PAPER_TICKET_LIMIT_EXCEEDED",
    );
  }

  if (
    error.code === "P0001" &&
    combined.includes("PAPER_TICKETS_NOT_ENABLED")
  ) {
    return jsonError(
      "Paper ticketing is not enabled for this lottery.",
      409,
      "PAPER_TICKETS_NOT_ENABLED",
    );
  }

  if (error.code === "23505") {
    return jsonError(
      "A generated ticket conflicted with an existing ticket. Please try again.",
      409,
      "PAPER_TICKET_DUPLICATE",
    );
  }

  if (error.code === "PGRST202") {
    return jsonError(
      `The database function ${CREATE_BATCH_RPC} has not been installed.`,
      500,
      "PAPER_TICKET_RPC_MISSING",
    );
  }

  return jsonError(
    "The paper-ticket batch could not be created.",
    500,
    "PAPER_TICKET_BATCH_CREATE_FAILED",
  );
}

export async function POST(request: NextRequest) {
  const access = await requireLotteryPermission(REQUIRED_PERMISSION);

  const database = lotteryAdminDb();
  const verificationBaseUrl =
    process.env.PAPER_TICKET_VERIFY_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (!verificationBaseUrl) {
    console.error(
      "Set PAPER_TICKET_VERIFY_BASE_URL or NEXT_PUBLIC_SITE_URL before generating paper tickets.",
    );
    return jsonError(
      "The paper-ticket verification URL has not been configured.",
      500,
      "PAPER_TICKET_VERIFY_URL_MISSING",
    );
  }

  try {
    const parsedVerificationUrl = new URL(verificationBaseUrl);
    if (!["http:", "https:"].includes(parsedVerificationUrl.protocol)) {
      throw new Error("Unsupported verification URL protocol");
    }
  } catch {
    return jsonError(
      "The paper-ticket verification URL is invalid.",
      500,
      "PAPER_TICKET_VERIFY_URL_INVALID",
    );
  }
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonError(
      "Send this request as multipart form data.",
      400,
      "INVALID_FORM_DATA",
    );
  }

  const lotteryId = cleanFormString(formData, "lottery_id");
  const quantity = positiveInteger(cleanFormString(formData, "quantity"));
  const pageSize = cleanFormString(formData, "page_size") || "A4";
  const ticketsPerSheet = positiveInteger(
    cleanFormString(formData, "tickets_per_sheet"),
  );
  const duplexFlip = cleanFormString(formData, "duplex_flip");
  const codeFormat = cleanFormString(formData, "code_format");
  const frontDesign = getDesignFile(formData, "front_design");
  const backDesign = getDesignFile(formData, "back_design");

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      lotteryId,
    )
  ) {
    return jsonError("Select a valid lottery.", 400, "INVALID_LOTTERY_ID");
  }
  if (!quantity || quantity > MAX_BATCH_SIZE) {
    return jsonError(
      `Enter between 1 and ${MAX_BATCH_SIZE} paper tickets.`,
      400,
      "INVALID_QUANTITY",
    );
  }
  if (pageSize !== "A4") {
    return jsonError(
      "Only A4 paper is currently supported.",
      400,
      "INVALID_PAGE_SIZE",
    );
  }
  if (!ticketsPerSheet || !ALLOWED_TICKETS_PER_SHEET.has(ticketsPerSheet)) {
    return jsonError(
      "Tickets per sheet must be 2, 4 or 6.",
      400,
      "INVALID_TICKETS_PER_SHEET",
    );
  }
  if (!ALLOWED_DUPLEX_FLIPS.has(duplexFlip)) {
    return jsonError(
      "Select a supported duplex printing option.",
      400,
      "INVALID_DUPLEX_FLIP",
    );
  }
  if (!ALLOWED_CODE_FORMATS.has(codeFormat)) {
    return jsonError(
      "Select a supported barcode format.",
      400,
      "INVALID_CODE_FORMAT",
    );
  }
  if (!frontDesign) {
    return jsonError(
      "Upload the approved front ticket artwork.",
      400,
      "FRONT_DESIGN_REQUIRED",
    );
  }

  const frontError = validateDesignFileMetadata(frontDesign, "Front");
  if (frontError) return jsonError(frontError, 400, "INVALID_FRONT_DESIGN");
  if (!(await hasValidImageSignature(frontDesign))) {
    return jsonError(
      "The front artwork content does not match its file type.",
      400,
      "INVALID_FRONT_DESIGN_CONTENT",
    );
  }
  if (backDesign) {
    const backError = validateDesignFileMetadata(backDesign, "Back");
    if (backError) return jsonError(backError, 400, "INVALID_BACK_DESIGN");
    if (!(await hasValidImageSignature(backDesign))) {
      return jsonError(
        "The back artwork content does not match its file type.",
        400,
        "INVALID_BACK_DESIGN_CONTENT",
      );
    }
  }

  const { data: lotteryData, error: lotteryError } = await database
    .from("lotteries")
    .select("id,title,slug,status,max_tickets,paper_tickets_enabled")
    .eq("id", lotteryId)
    .maybeSingle();

  const lottery = lotteryData as LotteryRow | null;

  if (lotteryError) {
    console.error("Paper ticket lottery lookup failed", {
      lotteryId,
      error: lotteryError,
    });
    return jsonError(
      "The lottery could not be checked.",
      500,
      "LOTTERY_LOOKUP_FAILED",
    );
  }
  if (!lottery) {
    return jsonError("Lottery not found.", 404, "LOTTERY_NOT_FOUND");
  }
  if (!lottery.paper_tickets_enabled) {
    return jsonError(
      "Paper ticketing is not enabled for this lottery.",
      409,
      "PAPER_TICKETS_NOT_ENABLED",
    );
  }
  if (["completed", "cancelled", "archived"].includes(lottery.status || "")) {
    return jsonError(
      "Paper tickets cannot be generated for this lottery status.",
      409,
      "LOTTERY_STATUS_BLOCKED",
    );
  }

  const batchId = randomUUID();
  const batchReference = `PB-${new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "")}-${randomCode(6)}`;
  const uploadedPaths: string[] = [];

  try {
    const frontDesignPath = await uploadDesign(
      database,
      batchId,
      "front",
      frontDesign,
    );
    uploadedPaths.push(frontDesignPath);

    let backDesignPath: string | null = null;
    if (backDesign) {
      backDesignPath = await uploadDesign(
        database,
        batchId,
        "back",
        backDesign,
      );
      uploadedPaths.push(backDesignPath);
    }

    // The RPC must create the batch, every ticket and its audit record inside
    // one Postgres transaction. supabase-js cannot group separate writes into
    // one transaction.
    const tickets = createTickets(lottery, quantity, verificationBaseUrl);
    const { data, error } = await database.rpc(CREATE_BATCH_RPC, {
      p_lottery_id: lottery.id,
      p_batch_id: batchId,
      p_batch_reference: batchReference,
      p_quantity: quantity,
      p_page_size: pageSize,
      p_tickets_per_sheet: ticketsPerSheet,
      p_duplex_flip: duplexFlip,
      p_code_format: codeFormat,
      p_front_design_path: frontDesignPath,
      p_back_design_path: backDesignPath,
      p_created_by: access.id,
      p_tickets: tickets,
    });

    if (error) {
      console.error("Paper ticket batch RPC failed", {
        lotteryId,
        batchId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      await removeUploadedDesigns(database, uploadedPaths);
      return databaseErrorResponse(error);
    }

    const result = normaliseRpcResult(data);
    if (!result?.batch_id) {
      await removeUploadedDesigns(database, uploadedPaths);
      return jsonError(
        "The database did not return the generated batch.",
        500,
        "INVALID_BATCH_RESPONSE",
      );
    }

    return NextResponse.json(
      {
        ok: true,
        batch_id: result.batch_id,
        batch_reference: result.batch_reference || batchReference,
        created_count: result.created_count || quantity,
        status: result.status || "generated",
        ready_to_print_url: `/Admin/LotteryManagement/PaperTickets/ReadyToPrint?batch=${encodeURIComponent(result.batch_id)}`,
      },
      { status: 201 },
    );
  } catch (caught) {
    await removeUploadedDesigns(database, uploadedPaths);
    console.error("Paper ticket batch creation failed", {
      lotteryId,
      batchId,
      error: caught,
    });
    return jsonError(
      caught instanceof Error
        ? caught.message
        : "The paper-ticket batch could not be created.",
      500,
      "PAPER_TICKET_BATCH_CREATE_FAILED",
    );
  }
}
