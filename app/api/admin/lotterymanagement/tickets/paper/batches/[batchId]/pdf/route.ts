import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { lotteryAdminDb, requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { buildPaperTicketPdf, PaperPdfError, PAPER_PDF_BUCKET, PAPER_DESIGN_BUCKET,
  type PaperBatch, type PaperLottery, type PaperPdfTicket } from "@/lib/lottery/paper-ticket-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ batchId: string }> };
type Database = ReturnType<typeof lotteryAdminDb>;
const BATCH_COLUMNS = "id,lottery_id,batch_reference,quantity,page_size,tickets_per_sheet,duplex_flip,code_format,front_design_path,back_design_path,status,cancelled_at,pdf_path,pdf_sha256,pdf_bytes,pdf_page_count,pdf_generated_at";
const LOTTERY_COLUMNS = "id,title,draw_at,timezone,currency,ticket_price,ticket_price_pence,minimum_age,promoting_society_legal_name,registration_licence_number,licensing_authority,responsible_promoter_name,responsible_promoter_address,required_ticket_wording";

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
function errorResponse(error: unknown) {
  if (error instanceof PaperPdfError) return json({ ok: false, error: error.message, code: error.code }, error.status);
  // Do not log database payloads or errors that might contain a barcode token.
  console.error("Paper-ticket PDF request failed", { name: error instanceof Error ? error.name : "Unknown" });
  return json({ ok: false, error: "The paper-ticket PDF request could not be completed. Please try again.", code: "PAPER_PDF_FAILED" }, 500);
}
function rpcError(error: { code?: string; message?: string }) {
  const messages: Record<string, [string, number]> = {
    PAPER_BATCH_NOT_FOUND: ["Paper-ticket batch not found.", 404],
    PDF_GENERATION_IN_PROGRESS: ["This batch's PDF is already being generated. Wait before trying again.", 409],
    PAPER_BATCH_CANCELLED: ["This paper-ticket batch has been cancelled.", 409],
    PAPER_BATCH_STATUS_BLOCKED: ["This batch cannot generate a PDF in its current status.", 409],
    LOTTERY_STATUS_BLOCKED: ["This lottery's status prevents PDF generation.", 409],
    PAPER_PDF_NOT_READY: ["Generate the PDF before downloading it.", 409],
    PAPER_REPRINT_REASON_REQUIRED: ["Enter a reprint reason of at least 8 characters.", 400],
    PDF_TICKET_SET_CHANGED: ["The batch's tickets changed during PDF generation. Check the batch before trying again.", 409],
    PDF_JOB_NO_LONGER_ACTIVE: ["This PDF job expired or the batch changed. Please try again.", 409],
    INVALID_OR_INACTIVE_ADMIN: ["Your administrator account is inactive or could not be verified.", 403],
  };
  const key = Object.keys(messages).find((key) => error.message?.includes(key));
  if (key) return new PaperPdfError(messages[key][0], key, messages[key][1]);
  return new PaperPdfError(error.code === "PGRST202" ? "Install the paper-ticket PDF SQL before using this API." : "The database could not complete the PDF action.", "PAPER_PDF_DATABASE_FAILED", 500);
}
async function control(db: Database, batchId: string, adminId: string, action: string, jobId: string | null = null, details: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc("lottery_paper_pdf_control", {
    p_batch_id: batchId, p_admin_id: adminId, p_action: action, p_job_id: jobId, p_details: details,
  });
  if (error) throw rpcError(error);
  const value = data as { ok?: boolean; reused?: boolean; status?: string; pdf_path?: string } | null;
  if (!value || typeof value !== "object") throw new PaperPdfError("The database returned an unexpected PDF response.", "PAPER_PDF_INVALID_RESPONSE", 500);
  return value;
}
async function loadBatch(db: Database, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new PaperPdfError("Invalid paper-ticket batch ID.", "INVALID_BATCH_ID", 400);
  const { data, error } = await db.from("lottery_paper_ticket_batches").select(BATCH_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new PaperPdfError("The batch could not be loaded. Check that the PDF SQL has been installed.", "PAPER_BATCH_LOOKUP_FAILED", 500);
  if (!data) throw new PaperPdfError("Paper-ticket batch not found.", "PAPER_BATCH_NOT_FOUND", 404);
  return data as unknown as PaperBatch;
}
function metadata(batch: PaperBatch) {
  return { ok: true, batch_id: batch.id, batch_reference: batch.batch_reference, status: batch.status,
    quantity: batch.quantity, pdf_ready: !!batch.pdf_path && ["ready_to_print", "printed"].includes(batch.status) && !batch.cancelled_at,
    pdf_page_count: batch.pdf_page_count, pdf_bytes: batch.pdf_bytes, pdf_sha256: batch.pdf_sha256,
    pdf_generated_at: batch.pdf_generated_at, page_size: batch.page_size, orientation: "landscape",
    tickets_per_sheet: batch.tickets_per_sheet, duplex_flip: batch.duplex_flip,
    ready_to_print_url: `/Admin/LotteryManagement/PaperTickets/ReadyToPrint?batch=${encodeURIComponent(batch.id)}` };
}
async function loadTickets(db: Database, batch: PaperBatch) {
  const tickets: PaperPdfTicket[] = [];
  // Supabase commonly limits a response to 1,000 rows. Never print a partial batch.
  for (let from = 0; from <= 5000; from += 500) {
    const { data, error } = await db.from("lottery_tickets")
      .select("id,lottery_id,ticket_number,status,ticket_source,barcode_token_hash,secret:lottery_paper_ticket_secrets(barcode_token,barcode_value)")
      .eq("paper_batch_id", batch.id).order("ticket_number").order("id").range(from, from + 499);
    if (error) throw new PaperPdfError("The original paper-ticket barcode records could not be loaded.", "PAPER_TICKET_LOOKUP_FAILED", 500);
    for (const value of data || []) {
      const row = value as unknown as { id: string; lottery_id: string; ticket_number: string; status: string;
        ticket_source: string; barcode_token_hash: string | null;
        secret: { barcode_token: string; barcode_value: string } | { barcode_token: string; barcode_value: string }[] | null };
      const secret = Array.isArray(row.secret) ? (row.secret.length === 1 ? row.secret[0] : null) : row.secret;
      if (row.lottery_id !== batch.lottery_id || row.ticket_source !== "paper" || row.status !== "reserved" || !row.barcode_token_hash || !secret) {
        throw new PaperPdfError("Every ticket must be an unsold reserved paper ticket with its original barcode record.", "INVALID_PDF_TICKET_STATE");
      }
      tickets.push({ id: row.id, ticket_number: row.ticket_number, barcode_token_hash: row.barcode_token_hash, ...secret });
    }
    if ((data?.length || 0) < 500) break;
  }
  if (tickets.length !== batch.quantity) throw new PaperPdfError("The stored batch quantity does not match its tickets.", "PDF_TICKET_COUNT_MISMATCH");
  return tickets;
}
async function artwork(db: Database, batchId: string, path: string) {
  if (!path.startsWith(`${batchId}/`) || path.includes("..")) throw new PaperPdfError("The artwork does not belong to this batch.", "INVALID_ARTWORK_PATH");
  const { data, error } = await db.storage.from(PAPER_DESIGN_BUCKET).download(path);
  if (error || !data) throw new PaperPdfError("The original artwork could not be downloaded.", "PAPER_ARTWORK_DOWNLOAD_FAILED", 500);
  return Buffer.from(await data.arrayBuffer());
}

// GET is a metadata view. It neither generates PDFs nor writes an audit event.
export async function GET(_request: NextRequest, context: Context) {
  await requireLotteryPermission("lottery:manage");
  try { const { batchId } = await context.params; return json(metadata(await loadBatch(lotteryAdminDb(), batchId))); }
  catch (error) { return errorResponse(error); }
}

// POST {action:"generate"} creates the artifact once. POST {action:"download"}
// audits the export and returns a private, five-minute signed download URL.
export async function POST(request: NextRequest, context: Context) {
  const access = await requireLotteryPermission("lottery:manage");
  const db = lotteryAdminDb();
  let jobId: string | null = null, batchId: string | null = null;
  let uploadPath: string | null = null, finalizationAttempted = false;
  try {
    batchId = (await context.params).batchId;
    const batch = await loadBatch(db, batchId);
    const raw = await request.text();
    if (raw.length > 4096) throw new PaperPdfError("The PDF request is too large.", "INVALID_PDF_REQUEST", 400);
    let body: { action?: unknown; reason?: unknown };
    try { body = raw.trim() ? JSON.parse(raw) : {}; }
    catch { throw new PaperPdfError("Send a JSON PDF request.", "INVALID_PDF_REQUEST", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new PaperPdfError("Send a JSON object.", "INVALID_PDF_REQUEST", 400);
    const action = body.action ?? "generate";
    if (action === "download") {
      if (!batch.pdf_path || !["ready_to_print", "printed"].includes(batch.status) || batch.cancelled_at) {
        throw new PaperPdfError("The batch has no PDF available to download.", "PAPER_PDF_NOT_READY");
      }
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      const fileName = `${batch.batch_reference.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
      const { data, error } = await db.storage.from(PAPER_PDF_BUCKET).createSignedUrl(batch.pdf_path, 300, { download: fileName });
      if (error || !data) throw new PaperPdfError("The PDF download could not be prepared.", "PAPER_PDF_DOWNLOAD_FAILED", 500);
      // Recheck cancellation/status and require a reason for printed-batch reprints.
      // The URL is not returned unless the audit write succeeds.
      await control(db, batchId, access.id, "download", null, { reason });
      return json({ ok: true, download_url: data.signedUrl, expires_in: 300, file_name: fileName });
    }
    if (action !== "generate") throw new PaperPdfError("Select generate or download.", "INVALID_PDF_ACTION", 400);
    jobId = randomUUID();
    const claim = await control(db, batchId, access.id, "claim", jobId);
    if (claim.reused) { jobId = null; return json({ ...metadata(await loadBatch(db, batchId)), reused: true }); }
    const currentBatch = await loadBatch(db, batchId);
    const [lotteryResult, tickets, frontArtwork, backArtwork] = await Promise.all([
      db.from("lotteries").select(LOTTERY_COLUMNS).eq("id", batch.lottery_id).single(),
      loadTickets(db, currentBatch), artwork(db, batchId, currentBatch.front_design_path),
      currentBatch.back_design_path ? artwork(db, batchId, currentBatch.back_design_path) : Promise.resolve(null),
    ]);
    if (lotteryResult.error || !lotteryResult.data) throw new PaperPdfError("The lottery print details could not be loaded.", "PAPER_LOTTERY_LOOKUP_FAILED", 500);
    const result = await buildPaperTicketPdf({ batch: currentBatch, lottery: lotteryResult.data as unknown as PaperLottery,
      tickets, frontArtwork, backArtwork });
    uploadPath = `${batchId}/${jobId}.pdf`;
    const { error: uploadError } = await db.storage.from(PAPER_PDF_BUCKET).upload(uploadPath, result.bytes,
      { contentType: "application/pdf", upsert: false, cacheControl: "0" });
    if (uploadError) throw new PaperPdfError("The generated PDF could not be saved.", "PAPER_PDF_UPLOAD_FAILED", 500);
    finalizationAttempted = true;
    await control(db, batchId, access.id, "finalize", jobId, { pdf_path: uploadPath, pdf_sha256: result.sha256,
      pdf_bytes: result.bytes.length, pdf_page_count: result.pageCount, manifest: result.manifest, snapshot: result.snapshot });
    jobId = null;
    return json({ ...metadata(await loadBatch(db, batchId)), reused: false }, 201);
  } catch (error) {
    // A timeout can occur after the database commits. Preserve uploaded PDFs
    // after any finalization attempt rather than deleting a possibly-live file.
    if (uploadPath && !finalizationAttempted) {
      try { await db.storage.from(PAPER_PDF_BUCKET).remove([uploadPath]); } catch { /* best effort */ }
    }
    if (jobId && batchId) {
      try { await control(db, batchId, access.id, "release", jobId); } catch { /* lease expires automatically */ }
    }
    return errorResponse(error);
  }
}
