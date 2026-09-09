"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertTriangle,
  Barcode,
  Camera,
  CameraOff,
  CheckCircle2,
  Keyboard,
  Loader2,
  Plus,
  ScanLine,
  Ticket,
  Trash2,
  X,
} from "lucide-react";

type LotteryOption = {
  id: string;
  title: string;
  slug: string;
  status?: string | null;
};

type PaperTicketDraft = {
  ticket_uuid: string;
  ticket_number: string;
};

type ApiResponse = {
  ok: boolean;
  items?: unknown[];
  created_count?: number;
  error?: string;
  message?: string;
};

type LotteriesApiResponse = {
  ok: boolean;
  items?: LotteryOption[];
  error?: string;
  message?: string;
};

type Props = {
  existingTicketIds: string[];
  existingTicketNumbers: string[];
  onClose: () => void;
  onRegistered: () => void | Promise<void>;
};

type CameraControls = {
  stop: () => void;
};

const PAPER_TICKETS_API =
  "/api/admin/lotterymanagement/tickets/paper";
const LOTTERIES_API = "/api/admin/lotterymanagement/lottery";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_SEARCH_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const TICKET_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{2,63}$/;
const MAX_BATCH_SIZE = 100;

function normaliseTicketNumber(value: string) {
  return value.trim().toUpperCase();
}

function normaliseUuid(value: string) {
  return value.trim().toLowerCase();
}

function parseScannerValue(value: string): Partial<PaperTicketDraft> {
  const raw = value.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const possibleUuid = String(
      parsed.ticket_uuid ?? parsed.ticketUuid ?? parsed.uuid ?? parsed.id ?? "",
    );
    const possibleNumber = String(
      parsed.ticket_number ??
        parsed.ticketNumber ??
        parsed.number ??
        parsed.code ??
        "",
    );

    return {
      ticket_uuid: normaliseUuid(possibleUuid),
      ticket_number: normaliseTicketNumber(possibleNumber),
    };
  } catch {
    // Normal barcode text continues below.
  }

  try {
    const url = new URL(raw);
    const possibleUuid =
      url.searchParams.get("ticket_uuid") ||
      url.searchParams.get("uuid") ||
      url.searchParams.get("id") ||
      "";
    const possibleNumber =
      url.searchParams.get("ticket_number") ||
      url.searchParams.get("number") ||
      url.searchParams.get("code") ||
      "";

    if (possibleUuid || possibleNumber) {
      return {
        ticket_uuid: normaliseUuid(possibleUuid),
        ticket_number: normaliseTicketNumber(possibleNumber),
      };
    }
  } catch {
    // A scanner does not have to return a URL.
  }

  const uuidMatch = raw.match(UUID_SEARCH_PATTERN)?.[0] || "";
  if (uuidMatch) {
    const remainder = raw
      .replace(uuidMatch, " ")
      .replace(/[|,;:\t]+/g, " ")
      .trim()
      .split(/\s+/)
      .find((part) => TICKET_NUMBER_PATTERN.test(normaliseTicketNumber(part)));

    return {
      ticket_uuid: normaliseUuid(uuidMatch),
      ticket_number: remainder ? normaliseTicketNumber(remainder) : "",
    };
  }

  if (UUID_PATTERN.test(raw)) {
    return { ticket_uuid: normaliseUuid(raw) };
  }

  return { ticket_number: normaliseTicketNumber(raw) };
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
        `${endpoint} returned a web page instead of JSON. Check that this API route exists and is deployed.`,
      );
    }

    throw new Error(`${endpoint} returned an invalid response.`);
  }
}

export default function PaperTicketRegistrationModal({
  existingTicketIds,
  existingTicketNumbers,
  onClose,
  onRegistered,
}: Props) {
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraControlsRef = useRef<CameraControls | null>(null);
  const [lotteries, setLotteries] = useState<LotteryOption[]>([]);
  const [lotteriesLoading, setLotteriesLoading] = useState(true);
  const [lotteryId, setLotteryId] = useState("");
  const [scanValue, setScanValue] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketUuid, setTicketUuid] = useState("");
  const [drafts, setDrafts] = useState<PaperTicketDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [photoScanning, setPhotoScanning] = useState(false);
  const [liveCameraAvailable, setLiveCameraAvailable] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const existingIdSet = useMemo(
    () => new Set(existingTicketIds.map(normaliseUuid)),
    [existingTicketIds],
  );
  const existingNumberSet = useMemo(
    () => new Set(existingTicketNumbers.map(normaliseTicketNumber)),
    [existingTicketNumbers],
  );

  useEffect(() => {
    setLiveCameraAvailable(
      window.isSecureContext &&
        Boolean(
          navigator.mediaDevices
            ?.getUserMedia,
        ),
    );
  }, []);

  const applyCameraResult = useCallback(
    (
      rawValue: string,
      source: "live" | "photo",
    ) => {
      const parsed =
        parseScannerValue(rawValue);

      setCameraError(null);
      setError(null);

      if (
        !parsed.ticket_number &&
        !parsed.ticket_uuid
      ) {
        setError(
          "The barcode was read, but it did not contain a ticket number or UUID.",
        );
        return;
      }

      if (parsed.ticket_number) {
        setTicketNumber(
          parsed.ticket_number,
        );
      }

      if (parsed.ticket_uuid) {
        setTicketUuid(
          parsed.ticket_uuid,
        );
      }

      const sourceLabel =
        source === "photo"
          ? "Photo"
          : "Camera";

      setMessage(
        parsed.ticket_number &&
          parsed.ticket_uuid
          ? `${sourceLabel} scan captured the ticket number and UUID. Check them, then add the ticket to the batch.`
          : parsed.ticket_number
            ? `${sourceLabel} captured the ticket number. Scan or enter its UUID next.`
            : `${sourceLabel} captured the ticket UUID. Scan or enter its ticket number next.`,
      );
    },
    [],
  );

  useEffect(() => {
    let active = true;

    async function loadLotteries() {
      setLotteriesLoading(true);
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
    const focusTimer = window.setTimeout(() => scanInputRef.current?.focus(), 50);

    return () => {
      active = false;
      window.clearTimeout(focusTimer);
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;
    let controls: CameraControls | null = null;

    async function beginCameraScan() {
      setCameraStarting(true);
      setCameraError(null);

      try {
        if (!window.isSecureContext) {
          throw new Error(
            "Phone camera scanning requires HTTPS. Open the admin portal using its secure https:// address.",
          );
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not supported by this browser.");
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !cameraVideoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          cameraVideoRef.current,
          (result, _scanError, scanControls) => {
            if (!result || cancelled) return;

            scanControls.stop();
            cameraControlsRef.current = null;
            setCameraOpen(false);
            applyCameraResult(
              result.getText(),
              "live",
            );
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        cameraControlsRef.current = controls;
      } catch (caught) {
        if (cancelled) return;

        setCameraOpen(false);
        const cameraFailure = caught as { name?: string; message?: string };
        if (cameraFailure.name === "NotAllowedError") {
          setCameraError(
            "Camera permission was blocked. Allow camera access for this website in your phone settings, then try again.",
          );
        } else if (cameraFailure.name === "NotFoundError") {
          setCameraError("No camera was found on this device.");
        } else if (cameraFailure.name === "NotReadableError") {
          setCameraError(
            "The camera is already being used by another app. Close it and try again.",
          );
        } else {
          setCameraError(
            cameraFailure.message || "The phone camera could not be started.",
          );
        }
      } finally {
        if (!cancelled) setCameraStarting(false);
      }
    }

    void beginCameraScan();

    return () => {
      cancelled = true;
      controls?.stop();
      cameraControlsRef.current?.stop();
      cameraControlsRef.current = null;
    };
  }, [applyCameraResult, cameraOpen]);

  async function handleCameraPhoto(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    setPhotoScanning(true);
    setCameraError(null);
    setError(null);
    setMessage(null);

    const imageUrl =
      URL.createObjectURL(file);

    try {
      const {
        BrowserMultiFormatReader,
      } = await import(
        "@zxing/browser"
      );

      const reader =
        new BrowserMultiFormatReader();

      const result =
        await reader.decodeFromImageUrl(
          imageUrl,
        );

      applyCameraResult(
        result.getText(),
        "photo",
      );
    } catch (caught) {
      console.warn(
        "Barcode photo scan failed:",
        caught,
      );

      setCameraError(
        "No barcode could be read from that photo. Fill the frame with the barcode, keep the image clear and try again.",
      );
    } finally {
      URL.revokeObjectURL(imageUrl);
      setPhotoScanning(false);
    }
  }

  function stopCamera() {
    cameraControlsRef.current?.stop();
    cameraControlsRef.current = null;

    const stream = cameraVideoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    setCameraOpen(false);
    setCameraStarting(false);
  }

  function closeModal() {
    stopCamera();
    onClose();
  }

  function addDraft(numberValue = ticketNumber, uuidValue = ticketUuid) {
    const number = normaliseTicketNumber(numberValue);
    const uuid = normaliseUuid(uuidValue);

    setError(null);
    setMessage(null);

    if (!number || !uuid) {
      setError("Enter or scan both the ticket number and ticket UUID.");
      return false;
    }
    if (!TICKET_NUMBER_PATTERN.test(number)) {
      setError(
        "Ticket numbers must be 3–64 characters using letters, numbers, dots, dashes, slashes or underscores.",
      );
      return false;
    }
    if (!UUID_PATTERN.test(uuid)) {
      setError("The ticket UUID is not a valid UUID.");
      return false;
    }
    if (drafts.length >= MAX_BATCH_SIZE) {
      setError(`You can register up to ${MAX_BATCH_SIZE} tickets at a time.`);
      return false;
    }
    if (
      existingNumberSet.has(number) ||
      drafts.some((draft) => draft.ticket_number === number)
    ) {
      setError(`Ticket number ${number} is already registered or in this batch.`);
      return false;
    }
    if (
      existingIdSet.has(uuid) ||
      drafts.some((draft) => draft.ticket_uuid === uuid)
    ) {
      setError(`Ticket UUID ${uuid} is already registered or in this batch.`);
      return false;
    }

    setDrafts((current) => [
      ...current,
      { ticket_number: number, ticket_uuid: uuid },
    ]);
    setTicketNumber("");
    setTicketUuid("");
    setScanValue("");
    setMessage(`Added ${number} to the registration batch.`);
    window.setTimeout(() => scanInputRef.current?.focus(), 0);
    return true;
  }

  function handleScannerInput() {
    const parsed = parseScannerValue(scanValue);
    const nextNumber = parsed.ticket_number || ticketNumber;
    const nextUuid = parsed.ticket_uuid || ticketUuid;

    setTicketNumber(nextNumber);
    setTicketUuid(nextUuid);
    setScanValue("");
    setError(null);

    if (nextNumber && nextUuid) {
      addDraft(nextNumber, nextUuid);
      return;
    }

    setMessage(
      nextNumber
        ? "Ticket number captured. Scan or enter its UUID next."
        : nextUuid
          ? "Ticket UUID captured. Scan or enter its ticket number next."
          : "The barcode did not contain a ticket number or UUID.",
    );
    window.setTimeout(() => scanInputRef.current?.focus(), 0);
  }

  async function registerTickets() {
    if (!lotteryId) {
      setError("Select the lottery these paper tickets belong to.");
      return;
    }
    if (!drafts.length) {
      setError("Add at least one paper ticket before registering.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(PAPER_TICKETS_API, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lottery_id: lotteryId,
          tickets: drafts,
        }),
      });
      const data = await readJson<ApiResponse>(response);

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || data.message || "The paper tickets could not be registered.",
        );
      }

      await onRegistered();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The paper tickets could not be registered.",
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
      aria-labelledby="paper-ticket-registration-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-emerald-200">
              <Barcode className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="paper-ticket-registration-title"
                className="text-xl font-extrabold text-white"
              >
                Register paper tickets
              </h2>
              <p className="mt-1 text-sm text-white/55">
                Type the printed details or scan the barcode on each ticket.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={submitting}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-40"
            aria-label="Close paper-ticket registration"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 md:p-6">
          <div className="mb-6 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100/80">
            <div className="flex items-start gap-3">
              <ScanLine className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                USB and Bluetooth barcode scanners normally act like a keyboard.
                Keep the scan box focused and scan the code. A scanner that sends
                Enter will process it automatically. You can scan one combined code,
                or scan the number and UUID separately.
              </p>
            </div>
          </div>

          <section className="mb-6 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-extrabold text-emerald-100">
                  <Camera className="h-5 w-5" />
                  Scan with phone camera
                </h3>
                <p className="mt-1 text-sm leading-6 text-emerald-100/65">
                  {liveCameraAvailable
                    ? "Use the live rear-camera scanner or take a barcode photo."
                    : "This HTTP connection uses your phone’s camera app to take a barcode photo."}
                </p>
              </div>

              {!cameraOpen &&
              liveCameraAvailable ? (
                <button
                  type="button"
                  onClick={() => {
                    setCameraError(null);
                    setCameraOpen(true);
                  }}
                  disabled={submitting}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-extrabold text-emerald-950 hover:bg-emerald-200 disabled:opacity-40"
                >
                  <Camera className="h-4 w-4" />
                  Open phone camera
                </button>
              ) : null}
            </div>

            <input
              ref={cameraPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) =>
                void handleCameraPhoto(
                  event,
                )
              }
              disabled={
                submitting ||
                photoScanning
              }
              className="sr-only"
              aria-label="Take or upload a barcode photo"
            />

            <button
              type="button"
              onClick={() =>
                cameraPhotoInputRef.current
                  ?.click()
              }
              disabled={
                submitting ||
                photoScanning ||
                cameraOpen
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/25 bg-emerald-950/30 px-4 py-3 text-sm font-extrabold text-emerald-100 hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {photoScanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {photoScanning
                ? "Reading barcode photo…"
                : liveCameraAvailable
                  ? "Take or upload barcode photo"
                  : "Open camera and take barcode photo"}
            </button>

            {!liveCameraAvailable ? (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-blue-300/20 bg-blue-500/10 p-3 text-sm leading-6 text-blue-100/80">
                <Camera className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Live preview needs HTTPS, but taking a photo works on this HTTP address.
                </span>
              </div>
            ) : null}

            {cameraOpen ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-black">
                <div className="relative aspect-[4/3] w-full">
                  <video
                    ref={cameraVideoRef}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    aria-label="Live phone camera barcode scanner"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                    <div className="h-32 w-full max-w-md rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
                  </div>
                  {cameraStarting ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-white">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Starting camera…
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-white/60">
                    Hold the barcode inside the green box until it is detected.
                  </p>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
                  >
                    <CameraOff className="h-4 w-4" />
                    Stop camera
                  </button>
                </div>
              </div>
            ) : null}

            {cameraError ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            ) : null}
          </section>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-white/75">Lottery</span>
            <select
              value={lotteryId}
              onChange={(event) => setLotteryId(event.target.value)}
              disabled={lotteriesLoading || submitting}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/50 disabled:opacity-50"
            >
              {lotteriesLoading ? <option value="">Loading lotteries...</option> : null}
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

          <div className="mt-5 rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-purple-100">
                <Barcode className="h-4 w-4" />
                Barcode scanner input
              </span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleScannerInput();
                    }
                  }}
                  disabled={submitting}
                  autoComplete="off"
                  placeholder="Focus here, then scan the barcode"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-purple-300/50"
                />
                <button
                  type="button"
                  onClick={handleScannerInput}
                  disabled={submitting || !scanValue.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-300 px-4 py-3 text-sm font-extrabold text-purple-950 disabled:opacity-40"
                >
                  <ScanLine className="h-4 w-4" />
                  Process scan
                </button>
              </div>
            </label>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-white/35">
            <div className="h-px flex-1 bg-white/10" />
            <Keyboard className="h-4 w-4" />
            Or type manually
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white/75">
                Ticket number
              </span>
              <input
                value={ticketNumber}
                onChange={(event) =>
                  setTicketNumber(normaliseTicketNumber(event.target.value))
                }
                disabled={submitting}
                placeholder="Example: BP-2026-000501"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-400/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white/75">
                Ticket UUID
              </span>
              <input
                value={ticketUuid}
                onChange={(event) => setTicketUuid(normaliseUuid(event.target.value))}
                disabled={submitting}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-white/35 focus:border-emerald-400/50"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => addDraft()}
            disabled={submitting}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-extrabold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add ticket to batch
          </button>

          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {message ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}

          <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-white">Tickets ready to register</h3>
                <p className="mt-1 text-xs text-white/45">
                  {drafts.length} of {MAX_BATCH_SIZE} tickets in this batch
                </p>
              </div>
              <Ticket className="h-5 w-5 text-white/45" />
            </div>

            {drafts.length ? (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {drafts.map((draft) => (
                  <div
                    key={draft.ticket_uuid}
                    className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white">{draft.ticket_number}</div>
                      <div className="mt-1 break-all font-mono text-xs text-white/45">
                        {draft.ticket_uuid}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((current) =>
                          current.filter(
                            (item) => item.ticket_uuid !== draft.ticket_uuid,
                          ),
                        )
                      }
                      disabled={submitting}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
                Scan or type the first paper ticket above.
              </div>
            )}
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end md:p-6">
          <button
            type="button"
            onClick={closeModal}
            disabled={submitting}
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={registerTickets}
            disabled={submitting || !lotteryId || !drafts.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-emerald-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {submitting
              ? "Registering tickets..."
              : `Register ${drafts.length} paper ticket${drafts.length === 1 ? "" : "s"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
