"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

type AcceptanceOrder = {
  id: string;
  order_reference: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  payment_status: string;
  quantity: number;
  total_amount: number;
  currency: string;
  created_at: string;
};

type AcceptanceLottery = {
  id: string;
  title: string;
  slug: string;
};

type AcceptanceRecord = {
  id: string;
  lottery_id: string;
  order_id: string;
  acceptance_type: string;
  version: string | null;
  accepted: boolean;
  accepted_at: string;
  ip_address: string | null;
  created_at: string;
  order: AcceptanceOrder | null;
  lottery: AcceptanceLottery | null;
};

type ApiResponse = {
  ok: boolean;
  items?: AcceptanceRecord[];
  error?: string;
  capabilities?: { exportAcceptances?: boolean };
};

type AcceptanceGroup = {
  orderId: string;
  order: AcceptanceOrder | null;
  lottery: AcceptanceLottery | null;
  records: AcceptanceRecord[];
  latestAt: string;
};

/**
 * Integration requirements from the production-readiness review:
 * GET must validate the server session and granular PII permission, minimise
 * columns, bound/paginate results, and audit access. UI flags are not security.
 * GET may return capabilities.exportAcceptances=true only for an authorised
 * exporter. It defaults to false for the legacy API.
 * The NEW POST /acceptances/export contract accepts { recordIds: string[] } and
 * returns { ok: true, items: AcceptanceRecord[] } AFTER independently checking
 * the verified session, dataset permission + lottery:export, CSRF/origin policy,
 * rate/size limits, and durable audit of the exact export scope. Fail closed if
 * audit fails. Never trust IDs or capabilities supplied by the browser.
 * This endpoint was not supplied and must be implemented separately; exports
 * remain disabled with the existing API. No unaudited client-only fallback.
 */
const MAX_RECORDS = 2000;
const PAGE_SIZE = 25;
const API_ROUTE = "/api/admin/lotterymanagement/acceptances";

const TYPE_LABELS: Record<string, string> = {
  minimum_age_confirmed: "Minimum age confirmed",
  eligibility_confirmed: "Eligibility confirmed",
  general_terms_accepted: "General terms accepted",
  lottery_terms_accepted: "Lottery terms accepted",
  marketing_opt_in: "Marketing choice",
};

function typeLabel(value: string) {
  return TYPE_LABELS[value] || value.replaceAll("_", " ");
}

function timestamp(value: string) {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : 0;
}

function formatDate(value: string) {
  if (!Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function safeText(value: string) {
  // Store as literal text, including when a spreadsheet is later saved as CSV.
  return /^[\s\uFEFF]*[=+@-]/u.test(value) ? `'${value}` : value;
}

function readItems(data: unknown): AcceptanceRecord[] {
  if (
    !data ||
    typeof data !== "object" ||
    !("items" in data) ||
    !Array.isArray(data.items) ||
    data.items.length > MAX_RECORDS
  ) {
    throw new Error(
      "The declaration response is invalid or exceeds the safe record limit.",
    );
  }
  const ids = new Set<string>();
  for (const item of data.items) {
    if (
      !item ||
      typeof item !== "object" ||
      ![
        item.id,
        item.order_id,
        item.lottery_id,
        item.acceptance_type,
        item.accepted_at,
        item.created_at,
      ].every((value) => typeof value === "string" && value.length > 0) ||
      typeof item.accepted !== "boolean" ||
      ids.has(item.id) ||
      ![item.version, item.ip_address].every(
        (value) => value == null || typeof value === "string",
      )
    ) {
      throw new Error("The declaration response contains invalid records.");
    }
    if (
      item.order != null &&
      (typeof item.order !== "object" ||
        typeof item.order.order_reference !== "string" ||
        ![
          item.order.purchaser_name,
          item.order.purchaser_email,
          item.order.payment_status,
        ].every((value) => value == null || typeof value === "string"))
    ) {
      throw new Error(
        "The declaration response contains invalid order details.",
      );
    }
    if (
      item.lottery != null &&
      (typeof item.lottery !== "object" ||
        typeof item.lottery.title !== "string")
    ) {
      throw new Error(
        "The declaration response contains invalid lottery details.",
      );
    }
    ids.add(item.id);
  }
  return data.items as AcceptanceRecord[];
}

function latestMarketing(records: AcceptanceRecord[]) {
  return records
    .filter((item) => item.acceptance_type === "marketing_opt_in")
    .sort(
      (a, b) =>
        timestamp(b.accepted_at) - timestamp(a.accepted_at) ||
        timestamp(b.created_at) - timestamp(a.created_at) ||
        Number(a.accepted) - Number(b.accepted) ||
        b.id.localeCompare(a.id),
    )[0];
}

export default function AcceptancesClient() {
  const [items, setItems] = useState<AcceptanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [choice, setChoice] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [canExport, setCanExport] = useState(false);
  const [page, setPage] = useState(1);
  const requestRef = useRef<AbortController | null>(null);
  const exportRequestRef = useRef<AbortController | null>(null);
  const exportBusyRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const loadRecords = useCallback(async () => {
    requestRef.current?.abort();
    exportRequestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    setLoading(true);
    setError(null);
    setCanExport(false);
    setItems([]);
    setSelectedOrderId(null);
    try {
      const response = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Your session has expired or you do not have permission to view declarations.",
        );
      }
      if (!response.ok)
        throw new Error("Unable to load declaration records. Try Refresh.");
      const data: ApiResponse = await response.json();
      if (!data?.ok)
        throw new Error("Unable to load declaration records. Try Refresh.");
      const records = readItems(data);
      if (requestRef.current !== controller || controller.signal.aborted)
        return;
      setItems(records);
      setCanExport(data.capabilities?.exportAcceptances === true);
      setPage(1);
    } catch (caught) {
      if (requestRef.current !== controller) return;
      setItems([]);
      setCanExport(false);
      setSelectedOrderId(null);
      setError(
        controller.signal.aborted
          ? "Loading timed out. Try Refresh."
          : caught instanceof Error && caught.message.startsWith("Your session")
            ? caught.message
            : "Unable to load declaration records. Try Refresh. If this continues, ask an administrator to check the records and response limit.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void loadRecords();
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
      exportRequestRef.current?.abort();
      exportRequestRef.current = null;
    };
  }, [loadRecords]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.order?.order_reference.toLowerCase().includes(query) ||
        (item.order?.purchaser_name || "").toLowerCase().includes(query) ||
        (item.order?.purchaser_email || "").toLowerCase().includes(query) ||
        (item.lottery?.title || "").toLowerCase().includes(query) ||
        item.acceptance_type.toLowerCase().includes(query);

      const matchesType = type === "all" || item.acceptance_type === type;
      const matchesChoice =
        choice === "all" ||
        (choice === "accepted" && item.accepted) ||
        (choice === "not_accepted" && !item.accepted);

      return matchesSearch && matchesType && matchesChoice;
    });
  }, [items, search, type, choice]);

  // Filters decide which orders appear; opening one shows its complete record.
  const groups = useMemo(() => {
    const byOrder = new Map<string, AcceptanceGroup>();
    for (const item of items) {
      const group = byOrder.get(item.order_id) ?? {
        orderId: item.order_id,
        order: item.order,
        lottery: item.lottery,
        records: [],
        latestAt: item.accepted_at,
      };
      group.records.push(item);
      group.order ??= item.order;
      group.lottery ??= item.lottery;
      if (timestamp(item.accepted_at) > timestamp(group.latestAt))
        group.latestAt = item.accepted_at;
      byOrder.set(item.order_id, group);
    }
    return [...byOrder.values()].sort(
      (a, b) =>
        timestamp(b.latestAt) - timestamp(a.latestAt) ||
        a.orderId.localeCompare(b.orderId),
    );
  }, [items]);

  const matchingOrderIds = useMemo(
    () => new Set(filtered.map((item) => item.order_id)),
    [filtered],
  );
  const visibleGroups = groups.filter((group) =>
    matchingOrderIds.has(group.orderId),
  );
  const pageCount = Math.max(1, Math.ceil(visibleGroups.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageGroups = visibleGroups.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  useEffect(() => {
    setPage(1);
  }, [search, type, choice]);
  const selectedGroup = groups.find(
    (group) => group.orderId === selectedOrderId,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedOrderId && dialog && !dialog.open) dialog.showModal();
  }, [selectedOrderId, mounted]);

  const orderCount = groups.length;
  const marketingYes = groups.filter(
    (group) => latestMarketing(group.records)?.accepted === true,
  ).length;
  const marketingNo = groups.filter(
    (group) => latestMarketing(group.records)?.accepted === false,
  ).length;

  async function exportXlsx() {
    if (!canExport || loading || !filtered.length || exportBusyRef.current)
      return;
    exportBusyRef.current = true;
    const controller = new AbortController();
    exportRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);

    setExporting(true);
    setError(null);

    try {
      const recordIds = filtered.map((item) => item.id);
      const response = await fetch(`${API_ROUTE}/export`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds }),
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) {
        setCanExport(false);
        setItems([]);
        setSelectedOrderId(null);
        throw new Error(
          "You do not have permission to export declarations. Refresh to check your session.",
        );
      }
      if (!response.ok)
        throw new Error(
          "The authorised export could not be prepared. Ask an administrator to check export access and audit logging.",
        );
      const data: ApiResponse = await response.json();
      if (!data?.ok)
        throw new Error("The authorised export could not be prepared.");
      const exportItems = readItems(data);
      const requested = new Set(recordIds);
      if (
        exportItems.length !== requested.size ||
        exportItems.some((item) => !requested.has(item.id))
      ) {
        throw new Error("The export records changed. Refresh and try again.");
      }
      if (controller.signal.aborted) return;
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const generatedAt = new Date();

      workbook.creator = "Burton Pride Lottery Management";
      workbook.created = generatedAt;
      workbook.modified = generatedAt;
      workbook.calcProperties.fullCalcOnLoad = true;

      const colours = {
        navy: "FF15172A",
        navyLight: "FF252842",
        purple: "FF7C3AED",
        pink: "FFEC4899",
        yellow: "FFFDE047",
        green: "FF10B981",
        greenSoft: "FFD1FAE5",
        red: "FFEF4444",
        redSoft: "FFFEE2E2",
        blueSoft: "FFDBEAFE",
        white: "FFFFFFFF",
        grey: "FF64748B",
        greySoft: "FFF1F5F9",
        border: "FFCBD5E1",
      };

      const summary = workbook.addWorksheet("Summary", {
        properties: { tabColor: { argb: colours.pink } },
        views: [{ showGridLines: false }],
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1,
          paperSize: 9,
          margins: {
            left: 0.35,
            right: 0.35,
            top: 0.55,
            bottom: 0.55,
            header: 0.2,
            footer: 0.2,
          },
        },
      });

      summary.columns = [
        { width: 4 },
        { width: 30 },
        { width: 18 },
        { width: 4 },
        { width: 30 },
        { width: 18 },
      ];
      summary.mergeCells("A1:F2");
      const summaryTitle = summary.getCell("A1");
      summaryTitle.value = "BURTON PRIDE LOTTERY";
      summaryTitle.font = {
        name: "Arial",
        size: 22,
        bold: true,
        color: { argb: colours.white },
      };
      summaryTitle.alignment = { vertical: "middle", horizontal: "center" };
      summaryTitle.fill = {
        type: "gradient",
        gradient: "angle",
        degree: 0,
        stops: [
          { position: 0, color: { argb: colours.pink } },
          { position: 0.5, color: { argb: colours.purple } },
          { position: 1, color: { argb: "FF2563EB" } },
        ],
      };
      summary.getRow(1).height = 28;
      summary.getRow(2).height = 28;

      summary.mergeCells("A3:F3");
      const summarySubtitle = summary.getCell("A3");
      summarySubtitle.value = "Declarations & Consent Register";
      summarySubtitle.font = {
        name: "Arial",
        size: 16,
        bold: true,
        color: { argb: colours.navy },
      };
      summarySubtitle.alignment = { horizontal: "center" };
      summary.getRow(3).height = 26;

      summary.mergeCells("A4:F4");
      const generatedCell = summary.getCell("A4");
      generatedCell.value = `Generated ${generatedAt.toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "long",
        timeStyle: "short",
      })}`;
      generatedCell.font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: colours.grey },
      };
      generatedCell.alignment = { horizontal: "center" };

      const summaryCards = [
        ["B6", "Recorded choices", exportItems.length, colours.purple],
        [
          "E6",
          "Orders represented",
          new Set(exportItems.map((item) => item.order_id)).size,
          "FF2563EB",
        ],
        [
          "B9",
          "Opt-in records",
          exportItems.filter(
            (item) =>
              item.acceptance_type === "marketing_opt_in" && item.accepted,
          ).length,
          colours.green,
        ],
        [
          "E9",
          "Declined records",
          exportItems.filter(
            (item) =>
              item.acceptance_type === "marketing_opt_in" && !item.accepted,
          ).length,
          colours.red,
        ],
      ] as const;

      for (const [cellAddress, label, value, colour] of summaryCards) {
        const cell = summary.getCell(cellAddress);
        const startColumn = Number(cell.col);
        const startRow = Number(cell.row);
        summary.mergeCells(
          startRow,
          startColumn,
          startRow + 1,
          startColumn + 1,
        );
        cell.value = `${label}\n${value}`;
        cell.font = {
          name: "Arial",
          size: 14,
          bold: true,
          color: { argb: colours.white },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colour },
        };
        cell.border = {
          top: { style: "thin", color: { argb: colour } },
          left: { style: "thin", color: { argb: colour } },
          bottom: { style: "thin", color: { argb: colour } },
          right: { style: "thin", color: { argb: colour } },
        };
      }
      summary.getRow(6).height = 30;
      summary.getRow(7).height = 30;
      summary.getRow(9).height = 30;
      summary.getRow(10).height = 30;

      summary.mergeCells("A13:F13");
      summary.getCell("A13").value =
        "This workbook contains the currently exportItems records shown in Lottery Management.";
      summary.getCell("A13").font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: colours.grey },
      };
      summary.getCell("A13").alignment = { horizontal: "center" };

      const declarations = workbook.addWorksheet("Declarations", {
        properties: { tabColor: { argb: colours.purple } },
        views: [
          {
            state: "frozen",
            ySplit: 5,
            activeCell: "A6",
            showGridLines: false,
          },
        ],
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.55,
            bottom: 0.55,
            header: 0.2,
            footer: 0.2,
          },
        },
        headerFooter: {
          oddFooter:
            "&LBurton Pride C.I.C&CDeclarations & Consent&RPage &P of &N",
        },
      });

      declarations.columns = [
        { key: "acceptedAt", width: 21 },
        { key: "orderReference", width: 25 },
        { key: "purchaser", width: 24 },
        { key: "email", width: 34 },
        { key: "lottery", width: 28 },
        { key: "declaration", width: 28 },
        { key: "accepted", width: 13 },
        { key: "version", width: 20 },
        { key: "paymentStatus", width: 18 },
      ];

      declarations.mergeCells("A1:I2");
      const titleCell = declarations.getCell("A1");
      titleCell.value = "BURTON PRIDE LOTTERY — DECLARATIONS & CONSENT";
      titleCell.font = {
        name: "Arial",
        size: 20,
        bold: true,
        color: { argb: colours.white },
      };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      titleCell.fill = {
        type: "gradient",
        gradient: "angle",
        degree: 0,
        stops: [
          { position: 0, color: { argb: colours.pink } },
          { position: 0.5, color: { argb: colours.purple } },
          { position: 1, color: { argb: "FF2563EB" } },
        ],
      };
      declarations.getRow(1).height = 28;
      declarations.getRow(2).height = 28;

      declarations.mergeCells("A3:I3");
      declarations.getCell("A3").value =
        `Exported records: ${exportItems.length}  |  Filter: ${type === "all" ? "All declarations" : typeLabel(type)}  |  Choice: ${choice === "all" ? "All" : choice === "accepted" ? "Yes" : "No"}`;
      declarations.getCell("A3").font = {
        name: "Arial",
        size: 10,
        color: { argb: colours.grey },
      };
      declarations.getCell("A3").alignment = { horizontal: "center" };
      declarations.getRow(4).height = 8;

      const headings = [
        "Recorded at (Europe/London)",
        "Order reference",
        "Purchaser",
        "Email",
        "Lottery",
        "Declaration",
        "Accepted",
        "Version",
        "Payment status",
      ];

      const headerRow = declarations.getRow(5);
      headerRow.values = headings;
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: colours.white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colours.navy },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          bottom: { style: "medium", color: { argb: colours.purple } },
        };
      });

      exportItems.forEach((item, index) => {
        const row = declarations.addRow({
          acceptedAt: formatDate(item.accepted_at),
          orderReference: item.order?.order_reference || item.order_id,
          purchaser: item.order?.purchaser_name || "Not provided",
          email: item.order?.purchaser_email || "Not provided",
          lottery: item.lottery?.title || item.lottery_id,
          declaration: typeLabel(item.acceptance_type),
          accepted: item.accepted ? "Yes" : "No",
          version: item.version || "Not recorded",
          paymentStatus: item.order?.payment_status || "Unknown",
        });

        // Calculate wrapped height from the longest field/explicit line breaks.
        let lineCount = 1;
        row.eachCell((cell, column) => {
          if (typeof cell.value === "string") cell.value = safeText(cell.value);
          const width = Math.max(
            8,
            Number(declarations.getColumn(column).width) - 2,
          );
          const lines = String(cell.value ?? "")
            .split("\n")
            .reduce(
              (count, line) =>
                count + Math.max(1, Math.ceil(line.length / width)),
              0,
            );
          lineCount = Math.max(lineCount, lines);
        });
        row.height = Math.min(409, Math.max(24, lineCount * 15 + 8));
        row.eachCell((cell) => {
          cell.font = {
            name: "Arial",
            size: 10,
            color: { argb: colours.navy },
          };
          cell.alignment = { vertical: "middle", wrapText: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: index % 2 === 0 ? colours.white : colours.greySoft,
            },
          };
          cell.border = {
            bottom: { style: "hair", color: { argb: colours.border } },
          };
        });

        row.getCell(1).numFmt = "dd/mm/yyyy hh:mm";
        row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(7).font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: item.accepted ? "FF065F46" : "FF991B1B" },
        };
        row.getCell(7).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: item.accepted ? colours.greenSoft : colours.redSoft,
          },
        };
        row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(9).font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: {
            argb:
              item.order?.payment_status === "paid" ? "FF065F46" : colours.navy,
          },
        };
        row.getCell(9).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              item.order?.payment_status === "paid"
                ? colours.greenSoft
                : colours.blueSoft,
          },
        };
        row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
      });

      declarations.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: Math.max(5, declarations.rowCount), column: 9 },
      };

      declarations.getColumn(2).numFmt = "@";
      declarations.getColumn(4).numFmt = "@";

      const buffer = await workbook.xlsx.writeBuffer();
      if (controller.signal.aborted || exportRequestRef.current !== controller)
        return;
      const blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lottery-declarations-${generatedAt
        .toISOString()
        .slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      if (exportRequestRef.current === controller) {
        setError(
          controller.signal.aborted
            ? "Export cancelled or timed out. Refresh and try again."
            : caught instanceof Error
              ? caught.message
              : "The Excel export could not be created.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      exportBusyRef.current = false;
      if (exportRequestRef.current === controller) {
        exportRequestRef.current = null;
        setExporting(false);
      }
    }
  }

  return (
    <main className="min-h-screen w-full px-4 py-8 text-white sm:px-6 xl:px-10">
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-purple-300">
              <ShieldCheck className="h-5 w-5" />
              Lottery Management
            </div>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Declarations & Consent
            </h1>
            <p className="mt-2 max-w-3xl text-white/55">
              Evidence of the confirmations and marketing choices recorded when
              purchasers continue to Stripe.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadRecords()}
              disabled={loading || exporting}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 font-bold hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportXlsx}
              disabled={!canExport || loading || !filtered.length || exporting}
              aria-describedby="export-help"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-400 px-4 py-2 font-black text-purple-950 hover:bg-purple-300 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Creating Excel..." : "Export XLSX"}
            </button>
          </div>
        </header>

        <p id="export-help" className="text-sm text-white/65">
          {canExport
            ? "Exports include the matching loaded declaration records."
            : "Export is unavailable until your export access is confirmed."}
        </p>
        <p className="text-sm text-white/65">
          Counts and filters cover loaded records only. Declarations do not
          prove payment or eligibility.
        </p>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Recorded choices" value={String(items.length)} />
          <Stat label="Orders recorded" value={String(orderCount)} />
          <Stat
            label="Orders with latest opt-in"
            value={String(marketingYes)}
          />
          <Stat
            label="Orders with latest decline"
            value={String(marketingNo)}
          />
        </section>

        <section className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_260px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              ref={searchRef}
              aria-label="Search declarations by order, purchaser, email or lottery"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, purchaser, email or lottery..."
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-12 text-white outline-none placeholder:text-white/30 focus:border-purple-400/60 focus-visible:ring-2 focus-visible:ring-purple-400"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Select label="Declaration type" value={type} onChange={setType}>
            <option value="all">All declaration types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Recorded choice" value={choice} onChange={setChoice}>
            <option value="all">All choices</option>
            <option value="accepted">Accepted / Yes</option>
            <option value="not_accepted">Not accepted / No</option>
          </Select>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 font-semibold text-red-100"
          >
            {error}
          </div>
        ) : null}

        <section
          aria-busy={loading}
          className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] backdrop-blur-xl"
        >
          {loading ? (
            <div
              role="status"
              className="flex min-h-64 items-center justify-center text-white/60"
            >
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading declaration records...
            </div>
          ) : !visibleGroups.length ? (
            <div className="p-10 text-center">
              <FileCheck2 className="mx-auto h-9 w-9 text-white/30" />
              <h2 className="mt-3 font-black">
                {items.length
                  ? "No matching declarations"
                  : "No declaration records found"}
              </h2>
              <p className="mt-1 text-sm text-white/45">
                {items.length
                  ? "Clear the search or change the filters to see more records."
                  : "New records will appear after a purchaser continues to payment."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[740px] w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th scope="col" className="px-5 py-4">
                      Order & purchaser
                    </th>
                    <th scope="col" className="px-5 py-4">
                      Recorded
                    </th>
                    <th scope="col" className="px-5 py-4">
                      Declarations
                    </th>
                    <th scope="col" className="px-5 py-4">
                      Marketing
                    </th>
                    <th scope="col" className="px-5 py-4">
                      Payment
                    </th>
                    <th scope="col" className="px-5 py-4">
                      Lottery
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pageGroups.map((group) => {
                    const marketing = latestMarketing(group.records);
                    return (
                      <tr key={group.orderId} className="hover:bg-white/[0.08]">
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              triggerRef.current = event.currentTarget;
                              setSelectedOrderId(group.orderId);
                            }}
                            className="rounded-md text-left font-black text-purple-200 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-400"
                            aria-label={`Open declarations for order ${group.order?.order_reference || group.orderId}`}
                          >
                            {group.order?.order_reference || group.orderId}
                          </button>
                          <div className="mt-1 text-white/65">
                            {group.order?.purchaser_name || "Not provided"}
                          </div>
                          <div className="text-xs text-white/45">
                            {group.order?.purchaser_email || "Not provided"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-white/65">
                          {formatDate(group.latestAt)}
                        </td>
                        <td className="px-5 py-4 text-white/75">
                          {group.records.length} recorded{" "}
                          <span className="ml-1 text-xs font-bold text-purple-300">
                            View details
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${
                              marketing?.accepted
                                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                : "border-slate-400/20 bg-white/5 text-white/55"
                            }`}
                          >
                            {marketing
                              ? marketing.accepted
                                ? "Opted in"
                                : "Declined"
                              : "Not recorded"}
                          </span>
                        </td>
                        <td className="px-5 py-4 capitalize text-white/65">
                          {group.order?.payment_status || "Unknown"}
                        </td>
                        <td className="px-5 py-4 font-semibold text-white/75">
                          {group.lottery?.title || group.records[0]?.lottery_id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {visibleGroups.length > 0 ? (
          <nav
            aria-label="Loaded declaration pages"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p role="status" className="text-sm text-white/65">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, visibleGroups.length)} of{" "}
              {visibleGroups.length} matching loaded orders
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => setPage(currentPage - 1)}
                className="min-h-11 rounded-xl border border-white/15 px-4 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage >= pageCount || loading}
                onClick={() => setPage(currentPage + 1)}
                className="min-h-11 rounded-xl border border-white/15 px-4 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </nav>
        ) : null}
        {mounted && selectedGroup
          ? createPortal(
              <dialog
                ref={dialogRef}
                aria-labelledby="acceptance-dialog-title"
                aria-describedby="acceptance-dialog-description"
                onClose={() => {
                  setSelectedOrderId(null);
                  triggerRef.current?.focus();
                }}
                onClick={(event) => {
                  if (event.target === dialogRef.current)
                    dialogRef.current.close();
                }}
                className="fixed left-1/2 top-1/2 m-0 max-h-[min(90dvh,850px)] w-[calc(100%_-_2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/15 bg-[#151d2a] p-0 text-white shadow-2xl backdrop:bg-slate-950/80"
              >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#151d2a] px-5 py-5 sm:px-7">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-purple-300">
                      Order declarations
                    </div>
                    <h2
                      id="acceptance-dialog-title"
                      className="mt-1 break-all text-xl font-black sm:text-2xl"
                    >
                      {selectedGroup.order?.order_reference ||
                        selectedGroup.orderId}
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close order details"
                    onClick={() => dialogRef.current?.close()}
                    className="rounded-xl border border-white/15 p-2.5 text-white/75 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-6 px-5 py-6 sm:px-7">
                  <p
                    id="acceptance-dialog-description"
                    className="text-sm text-white/65"
                  >
                    Recorded declarations for this order, from the loaded
                    records. Payment status is shown separately.
                  </p>
                  <dl className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:grid-cols-2">
                    <Detail
                      label="Purchaser"
                      value={
                        selectedGroup.order?.purchaser_name || "Not provided"
                      }
                    />
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wide text-white/45">
                        Email
                      </dt>
                      <dd className="mt-1 break-all font-semibold">
                        {selectedGroup.order?.purchaser_email ? (
                          <a
                            className="text-purple-200 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
                            href={`mailto:${selectedGroup.order.purchaser_email}`}
                          >
                            {selectedGroup.order.purchaser_email}
                          </a>
                        ) : (
                          "Not provided"
                        )}
                      </dd>
                    </div>
                    <Detail
                      label="Lottery"
                      value={
                        selectedGroup.lottery?.title ||
                        selectedGroup.records[0]?.lottery_id ||
                        "Unknown"
                      }
                    />
                    <Detail
                      label="Payment"
                      value={selectedGroup.order?.payment_status || "Unknown"}
                    />
                    <Detail
                      label="Tickets"
                      value={String(
                        selectedGroup.order?.quantity ?? "Not recorded",
                      )}
                    />
                    <Detail
                      label="Latest record"
                      value={formatDate(selectedGroup.latestAt)}
                    />
                  </dl>
                  <section aria-label="Recorded declarations">
                    <h3 className="mb-3 text-lg font-black">
                      All recorded choices ({selectedGroup.records.length})
                    </h3>
                    <div className="space-y-3">
                      {[...selectedGroup.records]
                        .sort(
                          (a, b) =>
                            timestamp(a.accepted_at) -
                              timestamp(b.accepted_at) ||
                            a.id.localeCompare(b.id),
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-black/20 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="font-bold">
                                {typeLabel(item.acceptance_type)}
                              </h4>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                                  item.accepted
                                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                                    : "border-slate-400/20 bg-white/5 text-white/65"
                                }`}
                              >
                                {item.accepted ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                                {item.accepted ? "Yes" : "No"}
                              </span>
                            </div>
                            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                              <Detail
                                label="Recorded"
                                value={formatDate(item.accepted_at)}
                              />
                              <Detail
                                label="Version / response"
                                value={item.version || "Not recorded"}
                              />
                            </dl>
                          </div>
                        ))}
                    </div>
                  </section>
                </div>
              </dialog>,
              document.body,
            )
          : null}
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-white/45">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-white/90">
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl">
      <div className="text-xs font-bold uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-[#15172a] px-4 pr-10 text-white outline-none focus:border-purple-400/60"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </label>
  );
}
