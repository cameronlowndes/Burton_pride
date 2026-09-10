"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  ExternalLink,
  FileImage,
  Loader2,
  LockKeyhole,
  Printer,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

type LotteryOption = {
  id: string;
  title: string;
  slug: string;
  status?: string | null;
};

type LotteriesApiResponse = {
  ok: boolean;
  items?: LotteryOption[];
  error?: string;
  message?: string;
};

type PaperBatchApiResponse = {
  ok: boolean;
  batch_id?: string;
  batch_reference?: string;
  created_count?: number;
  status?: string;
  ready_to_print_url?: string;
  error?: string;
  message?: string;
};

type GeneratedBatch = {
  batchId: string;
  batchReference: string;
  createdCount: number;
  status: string;
  readyToPrintUrl: string;
};

type Props = {
  // Optional during migration so existing callers do not break.
  existingTicketIds?: string[];
  existingTicketNumbers?: string[];
  onClose: () => void;
  onRegistered: () => void | Promise<void>;
};

type DesignSide = "front" | "back";
type DuplexFlip = "long_edge" | "short_edge";
type CodeFormat = "qr" | "qr_and_code128";

const LOTTERIES_API = "/api/admin/lotterymanagement/lottery";
const PAPER_BATCHES_API =
  "/api/admin/lotterymanagement/tickets/paper/batches";
const READY_TO_PRINT_ROUTE =
  "/Admin/LotteryManagement/PaperTickets/ReadyToPrint";
const REGISTER_EXISTING_ROUTE =
  "/Admin/LotteryManagement/PaperTickets/RegisterExisting";

const MAX_DESIGN_BYTES = 15 * 1024 * 1024;
const MAX_BATCH_SIZE = 5000;
const ACCEPTED_DESIGN_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function safeInternalRoute(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const route = value.trim();
  return route.startsWith("/") && !route.startsWith("//")
    ? route
    : fallback;
}

function validateDesignFile(file: File, side: DesignSide) {
  const label = side === "front" ? "Front" : "Back";

  if (!ACCEPTED_DESIGN_TYPES.has(file.type)) {
    return `${label} artwork must be a PNG, JPEG or WebP image.`;
  }
  if (file.size > MAX_DESIGN_BYTES) {
    return `${label} artwork must be 15 MB or smaller.`;
  }
  return null;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return { ok: false } as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    const endpoint = response.url
      ? new URL(response.url).pathname
      : "the requested API route";
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        `${endpoint} returned a web page instead of JSON. Check that the API route exists and is deployed.`,
      );
    }
    throw new Error(`${endpoint} returned an invalid response.`);
  }
}

function DesignUpload({
  side,
  file,
  previewUrl,
  disabled,
  required,
  onChange,
  onRemove,
}: {
  side: DesignSide;
  file: File | null;
  previewUrl: string | null;
  disabled: boolean;
  required: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const label = side === "front" ? "Front artwork" : "Back artwork";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 font-extrabold text-white">
            <FileImage className="h-4 w-4 text-purple-200" />
            {label}
            {required ? <span className="text-red-300">*</span> : null}
          </h4>
          <p className="mt-1 text-xs leading-5 text-white/45">
            {side === "front"
              ? "Upload the approved ticket picture. The system adds the unique ticket number."
              : "Optional. Without one, the system creates a clean back for the secure codes and required wording."}
          </p>
        </div>

        {file ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="rounded-lg border border-red-300/20 p-2 text-red-200 hover:bg-red-500/10 disabled:opacity-40"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {previewUrl ? (
        <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <Image
            src={previewUrl}
            alt={`${label} preview`}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 45vw"
            className="object-contain"
          />
        </div>
      ) : (
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.03] p-5 text-center hover:bg-white/[0.06]">
          <Upload className="h-6 w-6 text-purple-200" />
          <span className="mt-3 text-sm font-bold text-white">
            Choose {side} artwork
          </span>
          <span className="mt-1 text-xs text-white/40">
            PNG, JPEG or WebP, up to 15 MB
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onChange}
            disabled={disabled}
            className="sr-only"
          />
        </label>
      )}

      {file ? (
        <p className="mt-2 truncate text-xs text-white/45" title={file.name}>
          {file.name}
        </p>
      ) : null}
    </div>
  );
}

export default function PaperTicketRegistrationModal({
  onClose,
  onRegistered,
}: Props) {
  const [lotteries, setLotteries] = useState<LotteryOption[]>([]);
  const [lotteriesLoading, setLotteriesLoading] = useState(true);
  const [lotteryId, setLotteryId] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [ticketsPerSheet, setTicketsPerSheet] = useState("4");
  const [duplexFlip, setDuplexFlip] = useState<DuplexFlip>("long_edge");
  const [codeFormat, setCodeFormat] =
    useState<CodeFormat>("qr_and_code128");
  const [frontDesign, setFrontDesign] = useState<File | null>(null);
  const [backDesign, setBackDesign] = useState<File | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedBatch, setGeneratedBatch] =
    useState<GeneratedBatch | null>(null);

  const frontPreviewUrl = useMemo(
    () => (frontDesign ? URL.createObjectURL(frontDesign) : null),
    [frontDesign],
  );
  const backPreviewUrl = useMemo(
    () => (backDesign ? URL.createObjectURL(backDesign) : null),
    [backDesign],
  );

  useEffect(() => {
    return () => {
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl);
    };
  }, [frontPreviewUrl]);

  useEffect(() => {
    return () => {
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl);
    };
  }, [backPreviewUrl]);

  useEffect(() => {
    let active = true;

    async function loadLotteries() {
      setLotteriesLoading(true);
      setError(null);
      try {
        const response = await fetch(LOTTERIES_API, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await readJson<LotteriesApiResponse>(response);
        if (!response.ok || !data.ok) {
          throw new Error(
            data.error || data.message || "Unable to load lotteries.",
          );
        }
        if (!active) return;
        const options = data.items || [];
        setLotteries(options);
        setLotteryId((current) => current || options[0]?.id || "");
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load lotteries.",
        );
      } finally {
        if (active) setLotteriesLoading(false);
      }
    }

    void loadLotteries();
    return () => {
      active = false;
    };
  }, []);

  function selectDesign(
    side: DesignSide,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setError(null);
    if (!file) return;

    const validationError = validateDesignFile(file, side);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (side === "front") setFrontDesign(file);
    else setBackDesign(file);
  }

  async function generateBatch() {
    const parsedQuantity = Number.parseInt(quantity, 10);
    setError(null);
    setGeneratedBatch(null);

    if (!lotteryId) {
      setError("Select the lottery for this paper-ticket batch.");
      return;
    }
    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > MAX_BATCH_SIZE
    ) {
      setError(`Enter between 1 and ${MAX_BATCH_SIZE} paper tickets.`);
      return;
    }
    if (!frontDesign) {
      setError("Upload the approved front ticket artwork.");
      return;
    }
    if (!confirmed) {
      setError("Confirm the artwork and quantity before generating the batch.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("lottery_id", lotteryId);
      formData.set("quantity", String(parsedQuantity));
      formData.set("page_size", "A4");
      formData.set("tickets_per_sheet", ticketsPerSheet);
      formData.set("duplex_flip", duplexFlip);
      formData.set("code_format", codeFormat);
      formData.set("front_design", frontDesign);
      if (backDesign) formData.set("back_design", backDesign);

      const response = await fetch(PAPER_BATCHES_API, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
        body: formData,
      });
      const data = await readJson<PaperBatchApiResponse>(response);

      if (!response.ok || !data.ok || !data.batch_id) {
        throw new Error(
          data.error ||
            data.message ||
            "The paper-ticket batch could not be generated.",
        );
      }

      setGeneratedBatch({
        batchId: data.batch_id,
        batchReference: data.batch_reference || data.batch_id,
        createdCount: data.created_count || parsedQuantity,
        status: data.status || "ready_to_print",
        readyToPrintUrl: safeInternalRoute(
          data.ready_to_print_url,
          `${READY_TO_PRINT_ROUTE}?batch=${encodeURIComponent(data.batch_id)}`,
        ),
      });
      await onRegistered();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The paper-ticket batch could not be generated.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paper-ticket-generation-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-3 text-purple-200">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="paper-ticket-generation-title"
                className="text-xl font-extrabold text-white"
              >
                Generate paper ticket batch
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Create secure tickets and place them in Ready to Print.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-40"
            aria-label="Close paper-ticket generation"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 md:p-6">
          <section className="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
              <div>
                <h3 className="font-extrabold text-emerald-100">
                  Secure generation
                </h3>
                <p className="mt-1 text-sm leading-6 text-emerald-100/70">
                  This page sends only the lottery, print settings and artwork.
                  The server must create every ticket number, UUID and barcode
                  token. Those security values cannot be entered here.
                </p>
              </div>
            </div>
          </section>

          {generatedBatch ? (
            <section className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-200" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold text-emerald-100">
                    Paper tickets generated
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-100/70">
                    {generatedBatch.createdCount} secure tickets were created in
                    batch {generatedBatch.batchReference}. Check the print preview
                    and test a barcode before confirming the batch as printed.
                  </p>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-emerald-100/50">Tickets</dt>
                      <dd className="mt-1 font-extrabold text-emerald-50">
                        {generatedBatch.createdCount}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-emerald-100/50">Batch</dt>
                      <dd className="mt-1 break-all font-mono text-xs text-emerald-50">
                        {generatedBatch.batchReference}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-emerald-100/50">Status</dt>
                      <dd className="mt-1 font-extrabold capitalize text-emerald-50">
                        {generatedBatch.status.replaceAll("_", " ")}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href={generatedBatch.readyToPrintUrl}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-extrabold text-emerald-950 hover:bg-emerald-200"
                  >
                    <Printer className="h-4 w-4" />
                    Open Ready to Print
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/75">
                    Lottery <span className="text-red-300">*</span>
                  </span>
                  <select
                    value={lotteryId}
                    onChange={(event) => setLotteryId(event.target.value)}
                    disabled={lotteriesLoading || submitting}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-purple-300/50 disabled:opacity-50"
                  >
                    {lotteriesLoading ? (
                      <option value="">Loading lotteries...</option>
                    ) : null}
                    {!lotteriesLoading && !lotteries.length ? (
                      <option value="">No lotteries available</option>
                    ) : null}
                    {lotteries.map((lottery) => (
                      <option key={lottery.id} value={lottery.id}>
                        {lottery.title}
                        {lottery.status ? ` (${lottery.status})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/75">
                    Number of paper tickets <span className="text-red-300">*</span>
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={MAX_BATCH_SIZE}
                    step="1"
                    inputMode="numeric"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    disabled={submitting}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-purple-300/50 disabled:opacity-50"
                  />
                  <span className="mt-1 block text-xs text-white/40">
                    Maximum {MAX_BATCH_SIZE.toLocaleString()} per batch.
                  </span>
                </label>
              </section>

              <section className="mt-6">
                <h3 className="font-extrabold text-white">Ticket artwork</h3>
                <p className="mb-3 mt-1 text-sm text-white/50">
                  Leave clear space for the generated ticket number and secure
                  codes.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <DesignUpload
                    side="front"
                    file={frontDesign}
                    previewUrl={frontPreviewUrl}
                    disabled={submitting}
                    required
                    onChange={(event) => selectDesign("front", event)}
                    onRemove={() => setFrontDesign(null)}
                  />
                  <DesignUpload
                    side="back"
                    file={backDesign}
                    previewUrl={backPreviewUrl}
                    disabled={submitting}
                    required={false}
                    onChange={(event) => selectDesign("back", event)}
                    onRemove={() => setBackDesign(null)}
                  />
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-extrabold text-white">Print settings</h3>
                <p className="mb-4 mt-1 text-sm text-white/50">
                  This first version creates a duplex A4 print-ready PDF.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white/70">
                      Tickets per sheet
                    </span>
                    <select
                      value={ticketsPerSheet}
                      onChange={(event) => setTicketsPerSheet(event.target.value)}
                      disabled={submitting}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="2">2 large tickets</option>
                      <option value="4">4 tickets</option>
                      <option value="6">6 small tickets</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white/70">
                      Duplex printing
                    </span>
                    <select
                      value={duplexFlip}
                      onChange={(event) =>
                        setDuplexFlip(event.target.value as DuplexFlip)
                      }
                      disabled={submitting}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="long_edge">Flip on long edge</option>
                      <option value="short_edge">Flip on short edge</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white/70">
                      Code on ticket back
                    </span>
                    <select
                      value={codeFormat}
                      onChange={(event) =>
                        setCodeFormat(event.target.value as CodeFormat)
                      }
                      disabled={submitting}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="qr_and_code128">QR and Code 128</option>
                      <option value="qr">QR code only</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={submitting}
                    className="mt-1 h-5 w-5 shrink-0 accent-amber-300"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-extrabold text-amber-100">
                      <LockKeyhole className="h-4 w-4" />
                      Confirm batch generation
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-amber-100/70">
                      I checked the lottery, quantity and artwork. The server will
                      lock every ticket number, UUID and barcode token. Later
                      changes must use the controlled void or reprint process.
                    </span>
                  </span>
                </label>
              </section>
            </>
          )}

          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {!generatedBatch ? (
            <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-white/40">
                Already have externally printed tickets? Keep that as a separate
                registration workflow.
              </p>
              <Link
                href={REGISTER_EXISTING_ROUTE}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white/75 hover:bg-white/10"
              >
                <Barcode className="h-4 w-4" />
                Register existing tickets
              </Link>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end md:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
          >
            {generatedBatch ? "Close" : "Cancel"}
          </button>
          {!generatedBatch ? (
            <button
              type="button"
              onClick={() => void generateBatch()}
              disabled={
                submitting ||
                lotteriesLoading ||
                !lotteryId ||
                !frontDesign ||
                !confirmed
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-300 px-5 py-3 text-sm font-extrabold text-purple-950 hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {submitting ? "Generating secure tickets..." : "Generate paper batch"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
