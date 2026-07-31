"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgePoundSterling,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  UserRound,
} from "lucide-react";

import type {
  DirectDebitAccountSource,
  DirectDebitOccurrenceStatus,
  DirectDebitPlan,
  DirectDebitStatus,
} from "@/lib/money/directDebit";

type DirectDebitOccurrence = {
  id: string;
  due_date: string;
  period_month?: string | null;
  status: DirectDebitOccurrenceStatus;
  transaction_id: string | null;
  payment_number: number;
  amount_pence: number;
  reimbursement_status?:
    | "not_required"
    | "awaiting_reimbursement"
    | "partially_reimbursed"
    | "reimbursed"
    | null;
  reimbursement_transaction_id?: string | null;
  reimbursement_amount_pence?: number | null;
  reimbursement_payment_method?: string | null;
  reimbursed_at?: string | null;
  invoice_url?: string | null;
  invoice_file_name?: string | null;
};

type DirectDebitPlanRow = DirectDebitPlan & {
  created_at?: string | null;
  updated_at?: string | null;
  budget_category_key?: string | null;
  budget_category_label?: string | null;
  collection_day?: number | null;
  payments_failed?: number | null;
  outstanding_reimbursement_pence?: number | null;
  auto_reimburse_person?: boolean | null;
  reimbursement_payment_method?: string | null;
  reimbursement_image_url?: string | null;
  reimbursement_image_file_name?: string | null;
  money_direct_debit_occurrences?: DirectDebitOccurrence[] | null;
};

type ListResponse = {
  success?: boolean;
  plans?: DirectDebitPlanRow[];
  error?: string;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type StatusFilter = "all" | DirectDebitStatus;
type AccountFilter = "all" | DirectDebitAccountSource;
type RepaymentFilter =
  | "all"
  | "not_required"
  | "awaiting_reimbursement"
  | "partially_reimbursed"
  | "reimbursed";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function money(pence: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pence || 0) / 100);
}

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";

  const normalised = value.length === 10 ? `${value}T00:00:00` : value;
  const date = new Date(normalised);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: DirectDebitStatus) {
  if (status === "draft") return "Draft";
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "cancelled") return "Cancelled";
  return "Completed";
}

function occurrenceStatusLabel(status: DirectDebitOccurrenceStatus) {
  if (status === "scheduled") return "Scheduled";
  if (status === "posted") return "Posted";
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  return "Cancelled";
}

function reimbursementStatusLabel(status?: string | null) {
  const clean = cleanText(status).toLowerCase();

  if (clean === "awaiting_reimbursement") return "Awaiting repayment";
  if (clean === "partially_reimbursed") return "Partially repaid";
  if (clean === "reimbursed") return "Repaid";
  return "Not required";
}

function getOccurrences(plan: DirectDebitPlanRow) {
  return Array.isArray(plan.money_direct_debit_occurrences)
    ? [...plan.money_direct_debit_occurrences].sort((a, b) =>
        cleanText(a.due_date).localeCompare(cleanText(b.due_date)),
      )
    : [];
}

function outstandingReimbursement(plan: DirectDebitPlanRow) {
  if (plan.account_source !== "personal") return 0;

  const occurrences = getOccurrences(plan).filter(
    (occurrence) =>
      occurrence.status === "posted" || occurrence.status === "paid",
  );

  if (occurrences.length > 0) {
    return occurrences
      .filter((occurrence) => {
        const status = cleanText(
          occurrence.reimbursement_status,
        ).toLowerCase();

        return (
          status === "awaiting_reimbursement" ||
          status === "partially_reimbursed"
        );
      })
      .reduce(
        (sum, occurrence) =>
          sum + Math.max(0, Number(occurrence.amount_pence || 0)),
        0,
      );
  }

  return Math.max(
    0,
    Number(plan.outstanding_reimbursement_pence || 0),
  );
}

function latestReimbursementStatus(plan: DirectDebitPlanRow) {
  const latest = getOccurrences(plan)
    .filter(
      (occurrence) =>
        occurrence.status === "posted" || occurrence.status === "paid",
    )
    .sort((a, b) => cleanText(b.due_date).localeCompare(cleanText(a.due_date)))[0];

  return cleanText(latest?.reimbursement_status) || "not_required";
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  if (!raw) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return {
      error: "The server returned an invalid response.",
      details: raw.slice(0, 1000),
    } as T;
  }
}

function apiErrorMessage(
  payload: Partial<ListResponse>,
  fallback: string,
  response?: Response,
) {
  return [
    payload.error || payload.message || fallback,
    payload.code ? `Code: ${payload.code}` : "",
    payload.details ? `Details: ${payload.details}` : "",
    payload.hint ? `Hint: ${payload.hint}` : "",
    response ? `HTTP: ${response.status}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function DirectDebitsExportPage() {
  const [plans, setPlans] = useState<DirectDebitPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"excel" | "csv" | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [repaymentFilter, setRepaymentFilter] =
    useState<RepaymentFilter>("all");
  const [includeOccurrences, setIncludeOccurrences] = useState(true);
  const [reportGeneratedAt] = useState(() => new Date());

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits?t=${Date.now()}`,
        {
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = await readJsonResponse<ListResponse>(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(
            payload,
            "Could not load Direct Debit export data.",
            response,
          ),
        );
      }

      setPlans(Array.isArray(payload.plans) ? payload.plans : []);
    } catch (loadError) {
      setPlans([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Direct Debit export data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredPlans = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return plans.filter((plan) => {
      const occurrences = getOccurrences(plan);
      const planReimbursementStatus = latestReimbursementStatus(plan);

      const matchesSearch =
        !cleanSearch ||
        [
          plan.title,
          plan.description,
          plan.supplier_name,
          plan.account_holder,
          plan.mandate_reference,
          plan.notes,
          plan.budget_category_key,
          plan.budget_category_label,
          plan.status,
          plan.account_source,
          plan.reimbursement_payment_method,
          occurrences.map((item) => item.status).join(" "),
          occurrences
            .map((item) => item.reimbursement_status)
            .join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(cleanSearch);

      const matchesStatus =
        statusFilter === "all" || plan.status === statusFilter;

      const matchesAccount =
        accountFilter === "all" || plan.account_source === accountFilter;

      const matchesRepayment =
        repaymentFilter === "all" ||
        planReimbursementStatus === repaymentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesAccount &&
        matchesRepayment
      );
    });
  }, [
    plans,
    search,
    statusFilter,
    accountFilter,
    repaymentFilter,
  ]);

  const summary = useMemo(() => {
    const activePlans = filteredPlans.filter(
      (plan) => plan.status === "active",
    );

    const occurrenceRows = filteredPlans.flatMap(getOccurrences);

    return {
      plans: filteredPlans.length,
      activePlans: activePlans.length,
      monthlyCommitment: activePlans.reduce(
        (sum, plan) => sum + Number(plan.amount_pence || 0),
        0,
      ),
      personalPlans: filteredPlans.filter(
        (plan) => plan.account_source === "personal",
      ).length,
      reimbursementOutstanding: filteredPlans.reduce(
        (sum, plan) => sum + outstandingReimbursement(plan),
        0,
      ),
      scheduledPayments: occurrenceRows.filter(
        (occurrence) => occurrence.status === "scheduled",
      ).length,
      postedPayments: occurrenceRows.filter(
        (occurrence) =>
          occurrence.status === "posted" || occurrence.status === "paid",
      ).length,
    };
  }, [filteredPlans]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setAccountFilter("all");
    setRepaymentFilter("all");
  }

  async function exportCsv() {
    if (filteredPlans.length === 0 || exporting) return;

    setExporting("csv");

    try {
      const headers = [
        "Plan ID",
        "Title",
        "Description",
        "Status",
        "Monthly Amount",
        "Account Source",
        "Account Holder",
        "Supplier",
        "Budget Key",
        "Budget Label",
        "Mandate Reference",
        "First Collection",
        "Next Collection",
        "Total Payments",
        "Open Ended",
        "Payments Posted",
        "Payments Remaining",
        "Outstanding Repayment",
        "Repayment Method",
        "Notes",
      ];

      const rows = filteredPlans.map((plan) => {
        const paymentsRemaining = plan.is_open_ended
          ? "Open ended"
          : Math.max(
              0,
              Number(plan.total_payments || 0) - Number(plan.payments_paid || 0),
            );

        return [
          plan.id,
          plan.title,
          plan.description || "",
          statusLabel(plan.status),
          money(plan.amount_pence),
          plan.account_source === "personal"
            ? "Personal account"
            : "Burton Pride account",
          plan.account_holder || "",
          plan.supplier_name || "",
          plan.budget_category_key || "",
          plan.budget_category_label || "",
          plan.mandate_reference || "",
          dateLabel(plan.first_collection_date),
          dateLabel(plan.next_collection_date),
          plan.total_payments ?? "Open ended",
          plan.is_open_ended ? "Yes" : "No",
          plan.payments_paid ?? 0,
          paymentsRemaining,
          money(outstandingReimbursement(plan)),
          plan.reimbursement_payment_method || "",
          plan.notes || "",
        ];
      });

      const csv = [headers, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");

      saveBlob(
        new Blob([`\uFEFF${csv}`], {
          type: "text/csv;charset=utf-8",
        }),
        `burton-pride-direct-debits-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`,
      );

      setToast({
        type: "success",
        message: "The Direct Debit CSV report was downloaded.",
      });
    } catch (exportError) {
      setToast({
        type: "error",
        message:
          exportError instanceof Error
            ? exportError.message
            : "The Direct Debit CSV report could not be created.",
      });
    } finally {
      setExporting(null);
    }
  }

  async function exportExcel() {
    if (filteredPlans.length === 0 || exporting) return;

    setExporting("excel");

    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Burton Pride Admin Portal";
      workbook.lastModifiedBy = "Burton Pride Money Management";
      workbook.created = reportGeneratedAt;
      workbook.modified = reportGeneratedAt;
      workbook.calcProperties.fullCalcOnLoad = true;

      const workbookProperties = workbook.properties as {
        title?: string;
        subject?: string;
        category?: string;
        keywords?: string;
        description?: string;
        company?: string;
      };

      workbookProperties.company = "Burton Pride";
      workbookProperties.subject =
        "Direct Debit plans, repayments and payment schedule";
      workbookProperties.title = "Burton Pride Direct Debit Report";
      workbookProperties.category = "Money Management";
      workbookProperties.keywords =
        "Burton Pride, Direct Debits, Money Management, Repayments";
      workbookProperties.description =
        "Styled Direct Debit workbook exported from the Burton Pride Admin Portal.";

      const excelTheme = {
        purple: "FF7E22CE",
        purpleDark: "FF4C1D95",
        pink: "FFDB2777",
        teal: "FF0F766E",
        emerald: "FF047857",
        amber: "FFD97706",
        red: "FFB91C1C",
        sky: "FF0369A1",
        slate900: "FF0F172A",
        slate700: "FF334155",
        slate500: "FF64748B",
        slate300: "FFCBD5E1",
        slate200: "FFE2E8F0",
        slate100: "FFF1F5F9",
        white: "FFFFFFFF",
        purpleLight: "FFF5F3FF",
        tealLight: "FFF0FDFA",
        amberLight: "FFFFFBEB",
        redLight: "FFFEF2F2",
        emeraldLight: "FFECFDF5",
        skyLight: "FFF0F9FF",
      };

      const thinBorder = {
        top: { style: "thin" as const, color: { argb: excelTheme.slate300 } },
        left: { style: "thin" as const, color: { argb: excelTheme.slate300 } },
        bottom: { style: "thin" as const, color: { argb: excelTheme.slate300 } },
        right: { style: "thin" as const, color: { argb: excelTheme.slate300 } },
      };

      const mediumWhiteBorder = {
        top: { style: "medium" as const, color: { argb: excelTheme.white } },
        left: { style: "medium" as const, color: { argb: excelTheme.white } },
        bottom: { style: "medium" as const, color: { argb: excelTheme.white } },
        right: { style: "medium" as const, color: { argb: excelTheme.white } },
      };

      const summarySheet = workbook.addWorksheet("Executive Summary", {
        views: [
          {
            state: "frozen",
            ySplit: 8,
            showGridLines: false,
          },
        ],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 1,
          margins: {
            left: 0.35,
            right: 0.35,
            top: 0.45,
            bottom: 0.45,
            header: 0.2,
            footer: 0.2,
          },
        },
      });

      summarySheet.headerFooter = {
        differentFirst: false,
        differentOddEven: false,
        oddHeader:
          '&L&B&Burton Pride&C&BDirect Debit Report&R&D',
        oddFooter:
          '&LInternal finance record&CPage &P of &N&RGenerated by Admin Portal',
        evenHeader: "",
        evenFooter: "",
        firstHeader: "",
        firstFooter: "",
      };

      summarySheet.properties.defaultRowHeight = 20;
      if (summarySheet.views?.[0]) {
        summarySheet.views[0].showGridLines = false;
      }

      summarySheet.mergeCells("A1:H2");
      const summaryTitleCell = summarySheet.getCell("A1");
      summaryTitleCell.value = "BURTON PRIDE DIRECT DEBIT REPORT";
      summaryTitleCell.font = {
        bold: true,
        size: 22,
        color: { argb: excelTheme.white },
      };
      summaryTitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.purpleDark },
      };
      summaryTitleCell.alignment = {
        vertical: "middle",
        horizontal: "left",
        indent: 1,
      };
      summaryTitleCell.border = mediumWhiteBorder;
      summarySheet.getRow(1).height = 28;
      summarySheet.getRow(2).height = 18;

      summarySheet.mergeCells("A3:H3");
      const subtitleCell = summarySheet.getCell("A3");
      subtitleCell.value =
        "Monthly commitments, account sources, personal repayments and payment schedules";
      subtitleCell.font = {
        italic: true,
        size: 11,
        color: { argb: excelTheme.slate700 },
      };
      subtitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.purpleLight },
      };
      subtitleCell.alignment = {
        vertical: "middle",
        horizontal: "left",
        indent: 1,
      };

      summarySheet.mergeCells("A4:D4");
      summarySheet.getCell("A4").value =
        `Generated: ${reportGeneratedAt.toLocaleString("en-GB")}`;
      summarySheet.getCell("A4").font = {
        bold: true,
        color: { argb: excelTheme.slate700 },
      };

      summarySheet.mergeCells("E4:H4");
      summarySheet.getCell("E4").value =
        `Filters: ${filteredPlans.length} of ${plans.length} plans included`;
      summarySheet.getCell("E4").font = {
        bold: true,
        color: { argb: excelTheme.slate700 },
      };
      summarySheet.getCell("E4").alignment = {
        horizontal: "right",
      };

      const kpiCards = [
        {
          range: "A6:B7",
          label: "PLANS EXPORTED",
          value: summary.plans,
          fill: excelTheme.purple,
          numberFormat: "0",
        },
        {
          range: "C6:D7",
          label: "ACTIVE PLANS",
          value: summary.activePlans,
          fill: excelTheme.emerald,
          numberFormat: "0",
        },
        {
          range: "E6:F7",
          label: "MONTHLY COMMITMENT",
          value: summary.monthlyCommitment / 100,
          fill: excelTheme.pink,
          numberFormat: '£#,##0.00',
        },
        {
          range: "G6:H7",
          label: "PERSONAL PLANS",
          value: summary.personalPlans,
          fill: excelTheme.sky,
          numberFormat: "0",
        },
        {
          range: "A9:B10",
          label: "REPAYMENT DUE",
          value: summary.reimbursementOutstanding / 100,
          fill:
            summary.reimbursementOutstanding > 0
              ? excelTheme.amber
              : excelTheme.emerald,
          numberFormat: '£#,##0.00',
        },
        {
          range: "C9:D10",
          label: "SCHEDULED PAYMENTS",
          value: summary.scheduledPayments,
          fill: excelTheme.teal,
          numberFormat: "0",
        },
        {
          range: "E9:F10",
          label: "POSTED / PAID",
          value: summary.postedPayments,
          fill: excelTheme.purpleDark,
          numberFormat: "0",
        },
        {
          range: "G9:H10",
          label: "EXPORT DATE",
          value: reportGeneratedAt.toLocaleDateString("en-GB"),
          fill: excelTheme.slate700,
          numberFormat: "@",
        },
      ];

      for (const card of kpiCards) {
        summarySheet.mergeCells(card.range);
        const cardCell = summarySheet.getCell(card.range.split(":")[0]);
        cardCell.value = {
          richText: [
            {
              text: `${card.label}\n`,
              font: {
                bold: true,
                size: 9,
                color: { argb: excelTheme.white },
              },
            },
            {
              text: String(card.value),
              font: {
                bold: true,
                size: 18,
                color: { argb: excelTheme.white },
              },
            },
          ],
        };
        cardCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: card.fill },
        };
        cardCell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        cardCell.border = mediumWhiteBorder;
        cardCell.numFmt = card.numberFormat;
      }

      summarySheet.getRow(6).height = 30;
      summarySheet.getRow(7).height = 30;
      summarySheet.getRow(9).height = 30;
      summarySheet.getRow(10).height = 30;

      summarySheet.mergeCells("A12:H12");
      summarySheet.getCell("A12").value = "REPORT CONTENTS";
      summarySheet.getCell("A12").font = {
        bold: true,
        color: { argb: excelTheme.white },
      };
      summarySheet.getCell("A12").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.slate900 },
      };
      summarySheet.getCell("A12").alignment = {
        horizontal: "left",
        indent: 1,
      };

      const contentsRows = [
        [
          "Direct Debit Plans",
          "One row per plan with status, amount, account, supplier, budget and repayment totals.",
        ],
        [
          "Payment Schedule",
          includeOccurrences
            ? "One row per scheduled or completed occurrence, including transaction and repayment links."
            : "Not included in this export.",
        ],
        [
          "Status Legend",
          "Colour guide for plan, payment and repayment statuses.",
        ],
      ];

      contentsRows.forEach((row, index) => {
        const excelRow = 13 + index;
        summarySheet.mergeCells(`A${excelRow}:B${excelRow}`);
        summarySheet.mergeCells(`C${excelRow}:H${excelRow}`);
        summarySheet.getCell(`A${excelRow}`).value = row[0];
        summarySheet.getCell(`A${excelRow}`).font = {
          bold: true,
          color: { argb: excelTheme.purpleDark },
        };
        summarySheet.getCell(`C${excelRow}`).value = row[1];
        summarySheet.getCell(`C${excelRow}`).font = {
          color: { argb: excelTheme.slate700 },
        };
        summarySheet.getCell(`A${excelRow}`).border = thinBorder;
        summarySheet.getCell(`C${excelRow}`).border = thinBorder;
        summarySheet.getCell(`A${excelRow}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelTheme.purpleLight },
        };
        summarySheet.getCell(`C${excelRow}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelTheme.white },
        };
        summarySheet.getCell(`C${excelRow}`).alignment = {
          wrapText: true,
          vertical: "middle",
        };
        summarySheet.getRow(excelRow).height = 28;
      });

      summarySheet.mergeCells("A18:H18");
      summarySheet.getCell("A18").value =
        "This workbook is an internal Burton Pride finance record. Review personal-account repayments and supporting evidence before final approval.";
      summarySheet.getCell("A18").font = {
        italic: true,
        color: { argb: excelTheme.slate700 },
      };
      summarySheet.getCell("A18").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.amberLight },
      };
      summarySheet.getCell("A18").alignment = {
        horizontal: "center",
        wrapText: true,
      };
      summarySheet.getCell("A18").border = thinBorder;
      summarySheet.getRow(18).height = 32;

      summarySheet.columns = [
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
        { width: 17 },
      ];

      const plansSheet = workbook.addWorksheet("Direct Debit Plans", {
        views: [
          {
            state: "frozen",
            ySplit: 3,
            xSplit: 2,
            showGridLines: false,
          },
        ],
        pageSetup: {
          paperSize: 9,
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          repeatRows: "1:3",
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.45,
            bottom: 0.45,
            header: 0.2,
            footer: 0.2,
          },
        } as any,
      });

      plansSheet.properties.defaultRowHeight = 19;

      plansSheet.headerFooter = {
        oddHeader: '&L&B&Burton Pride&C&BDirect Debit Plans&R&D',
        oddFooter: '&LInternal finance record&CPage &P of &N&RAdmin Portal',
      } as any;

      plansSheet.mergeCells("A1:V1");
      plansSheet.getCell("A1").value =
        "BURTON PRIDE — DIRECT DEBIT PLANS";
      plansSheet.getCell("A1").font = {
        bold: true,
        size: 18,
        color: { argb: excelTheme.white },
      };
      plansSheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.purpleDark },
      };
      plansSheet.getCell("A1").alignment = {
        horizontal: "left",
        vertical: "middle",
        indent: 1,
      };
      plansSheet.getRow(1).height = 28;

      plansSheet.mergeCells("A2:V2");
      plansSheet.getCell("A2").value =
        `Generated ${reportGeneratedAt.toLocaleString(
          "en-GB",
        )} · ${filteredPlans.length} plan${
          filteredPlans.length === 1 ? "" : "s"
        } included`;
      plansSheet.getCell("A2").font = {
        italic: true,
        color: { argb: excelTheme.slate700 },
      };
      plansSheet.getCell("A2").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.purpleLight },
      };
      plansSheet.getCell("A2").alignment = {
        horizontal: "left",
        indent: 1,
      };

      plansSheet.autoFilter = { from: "A3", to: "V3" };

      plansSheet.columns = [
        { header: "Plan ID", key: "id", width: 38 },
        { header: "Title", key: "title", width: 30 },
        { header: "Description", key: "description", width: 42 },
        { header: "Status", key: "status", width: 14 },
        { header: "Monthly Amount", key: "amount", width: 18 },
        { header: "Account Source", key: "account_source", width: 20 },
        { header: "Account Holder", key: "account_holder", width: 24 },
        { header: "Supplier", key: "supplier", width: 24 },
        { header: "Budget Key", key: "budget_key", width: 20 },
        { header: "Budget Label", key: "budget_label", width: 22 },
        { header: "Mandate Reference", key: "mandate", width: 24 },
        { header: "First Collection", key: "first_collection", width: 18 },
        { header: "Next Collection", key: "next_collection", width: 18 },
        { header: "Total Payments", key: "total_payments", width: 16 },
        { header: "Open Ended", key: "open_ended", width: 14 },
        { header: "Payments Posted", key: "payments_posted", width: 18 },
        { header: "Payments Remaining", key: "payments_remaining", width: 20 },
        {
          header: "Outstanding Repayment",
          key: "outstanding_repayment",
          width: 22,
        },
        {
          header: "Repayment Method",
          key: "repayment_method",
          width: 22,
        },
        { header: "Created", key: "created_at", width: 20 },
        { header: "Updated", key: "updated_at", width: 20 },
        { header: "Notes", key: "notes", width: 40 },
      ];

      const planHeaders = plansSheet.columns.map(
        (column) => cleanText(column.header),
      );

      plansSheet.getRow(1).values = [];
      plansSheet.getRow(2).values = [];
      plansSheet.getRow(3).values = planHeaders;

      const plansHeader = plansSheet.getRow(3);
      plansHeader.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      plansHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.purple },
      };
      plansHeader.border = thinBorder;
      plansHeader.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      plansHeader.height = 28;

      for (const plan of filteredPlans) {
        const paymentsRemaining = plan.is_open_ended
          ? "Open ended"
          : Math.max(
              0,
              Number(plan.total_payments || 0) - Number(plan.payments_paid || 0),
            );

        plansSheet.addRow({
          id: plan.id,
          title: plan.title,
          description: plan.description || "",
          status: statusLabel(plan.status),
          amount: Number(plan.amount_pence || 0) / 100,
          account_source:
            plan.account_source === "personal"
              ? "Personal account"
              : "Burton Pride account",
          account_holder: plan.account_holder || "",
          supplier: plan.supplier_name || "",
          budget_key: plan.budget_category_key || "",
          budget_label: plan.budget_category_label || "",
          mandate: plan.mandate_reference || "",
          first_collection: plan.first_collection_date || "",
          next_collection: plan.next_collection_date || "",
          total_payments: plan.total_payments ?? "Open ended",
          open_ended: plan.is_open_ended ? "Yes" : "No",
          payments_posted: plan.payments_paid ?? 0,
          payments_remaining: paymentsRemaining,
          outstanding_repayment:
            outstandingReimbursement(plan) / 100,
          repayment_method:
            plan.reimbursement_payment_method || "",
          created_at: plan.created_at || "",
          updated_at: plan.updated_at || "",
          notes: plan.notes || "",
        });
      }

      plansSheet.getColumn("amount").numFmt = '£#,##0.00';
      plansSheet.getColumn("outstanding_repayment").numFmt =
        '£#,##0.00';

      plansSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 3) return;

        row.alignment = {
          vertical: "top",
          wrapText: true,
        };
        row.height = 34;

        row.eachCell((cell) => {
          cell.border = thinBorder;
          cell.font = {
            color: { argb: excelTheme.slate900 },
            size: 10,
          };
        });

        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              rowNumber % 2 === 0
                ? excelTheme.purpleLight
                : excelTheme.white,
          },
        };

        const statusCell = row.getCell("status");
        const statusValue = cleanText(statusCell.value).toLowerCase();

        if (statusValue === "active") {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: excelTheme.emeraldLight },
          };
          statusCell.font = {
            bold: true,
            color: { argb: excelTheme.emerald },
          };
        } else if (statusValue === "paused") {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: excelTheme.amberLight },
          };
          statusCell.font = {
            bold: true,
            color: { argb: excelTheme.amber },
          };
        } else if (statusValue === "cancelled") {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: excelTheme.redLight },
          };
          statusCell.font = {
            bold: true,
            color: { argb: excelTheme.red },
          };
        }

        const repaymentCell = row.getCell("outstanding_repayment");
        const repaymentValue = Number(repaymentCell.value || 0);

        if (repaymentValue > 0) {
          repaymentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: excelTheme.amberLight },
          };
          repaymentCell.font = {
            bold: true,
            color: { argb: excelTheme.amber },
          };
        } else {
          repaymentCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: excelTheme.emeraldLight },
          };
          repaymentCell.font = {
            bold: true,
            color: { argb: excelTheme.emerald },
          };
        }
      });

      plansSheet.getColumn("id").hidden = true;
      plansSheet.getColumn("description").width = 34;
      plansSheet.getColumn("notes").width = 34;
      plansSheet.getColumn("title").width = 28;
      plansSheet.getColumn("account_holder").width = 22;
      plansSheet.getColumn("supplier").width = 22;
      plansSheet.getColumn("amount").alignment = {
        horizontal: "right",
      };
      plansSheet.getColumn("outstanding_repayment").alignment = {
        horizontal: "right",
      };

      if (includeOccurrences) {
        const occurrencesSheet = workbook.addWorksheet("Payment Schedule", {
          views: [
            {
              state: "frozen",
              ySplit: 3,
              xSplit: 3,
              showGridLines: false,
            },
          ],
          pageSetup: {
            paperSize: 9,
            orientation: "landscape",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            printTitlesRow: "1:3",
            margins: {
              left: 0.25,
              right: 0.25,
              top: 0.45,
              bottom: 0.45,
              header: 0.2,
              footer: 0.2,
            },
          },
        });

        occurrencesSheet.headerFooter = {
          differentFirst: false,
          differentOddEven: false,
          oddHeader:
            '&L&B&Burton Pride&C&BPayment Schedule&R&D',
          oddFooter:
            '&LInternal finance record&CPage &P of &N&RAdmin Portal',
          evenHeader: "",
          evenFooter: "",
          firstHeader: "",
          firstFooter: "",
        };

        occurrencesSheet.views[0] = { showGridLines: false };
        occurrencesSheet.properties.defaultRowHeight = 19;

        occurrencesSheet.mergeCells("A1:P1");
        occurrencesSheet.getCell("A1").value =
          "BURTON PRIDE — DIRECT DEBIT PAYMENT SCHEDULE";
        occurrencesSheet.getCell("A1").font = {
          bold: true,
          size: 18,
          color: { argb: excelTheme.white },
        };
        occurrencesSheet.getCell("A1").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelTheme.teal },
        };
        occurrencesSheet.getCell("A1").alignment = {
          horizontal: "left",
          vertical: "middle",
          indent: 1,
        };
        occurrencesSheet.getRow(1).height = 28;

        occurrencesSheet.mergeCells("A2:P2");
        occurrencesSheet.getCell("A2").value =
          "Scheduled, posted, paid and reimbursed occurrences";
        occurrencesSheet.getCell("A2").font = {
          italic: true,
          color: { argb: excelTheme.slate700 },
        };
        occurrencesSheet.getCell("A2").fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelTheme.tealLight },
        };
        occurrencesSheet.getCell("A2").alignment = {
          horizontal: "left",
          indent: 1,
        };

        occurrencesSheet.autoFilter = {
          from: "A3",
          to: "P3",
        };

        occurrencesSheet.columns = [
          { header: "Occurrence ID", key: "occurrence_id", width: 38 },
          { header: "Plan ID", key: "plan_id", width: 38 },
          { header: "Plan Title", key: "plan_title", width: 28 },
          { header: "Payment Number", key: "payment_number", width: 16 },
          { header: "Due Date", key: "due_date", width: 16 },
          { header: "Period Month", key: "period_month", width: 16 },
          { header: "Status", key: "status", width: 16 },
          { header: "Amount", key: "amount", width: 16 },
          { header: "Transaction ID", key: "transaction_id", width: 38 },
          {
            header: "Repayment Status",
            key: "repayment_status",
            width: 22,
          },
          {
            header: "Repayment Transaction ID",
            key: "repayment_transaction_id",
            width: 38,
          },
          {
            header: "Repayment Amount",
            key: "repayment_amount",
            width: 18,
          },
          {
            header: "Repayment Method",
            key: "repayment_method",
            width: 20,
          },
          { header: "Repaid At", key: "repaid_at", width: 20 },
          { header: "Receipt File", key: "receipt_file", width: 28 },
          { header: "Receipt URL", key: "receipt_url", width: 48 },
        ];

        const occurrenceHeaders = occurrencesSheet.columns.map(
          (column) => cleanText(column.header),
        );

        occurrencesSheet.getRow(1).values = [];
        occurrencesSheet.getRow(2).values = [];
        occurrencesSheet.getRow(3).values = occurrenceHeaders;

        const occurrenceHeader = occurrencesSheet.getRow(3);
        occurrenceHeader.font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        occurrenceHeader.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: excelTheme.teal },
        };
        occurrenceHeader.border = thinBorder;
        occurrenceHeader.alignment = {
          vertical: "middle",
          horizontal: "center",
        };
        occurrenceHeader.height = 28;

        for (const plan of filteredPlans) {
          for (const occurrence of getOccurrences(plan)) {
            occurrencesSheet.addRow({
              occurrence_id: occurrence.id,
              plan_id: plan.id,
              plan_title: plan.title,
              payment_number: occurrence.payment_number,
              due_date: occurrence.due_date,
              period_month: occurrence.period_month || "",
              status: occurrenceStatusLabel(occurrence.status),
              amount: Number(occurrence.amount_pence || 0) / 100,
              transaction_id: occurrence.transaction_id || "",
              repayment_status: reimbursementStatusLabel(
                occurrence.reimbursement_status,
              ),
              repayment_transaction_id:
                occurrence.reimbursement_transaction_id || "",
              repayment_amount:
                Number(
                  occurrence.reimbursement_amount_pence || 0,
                ) / 100,
              repayment_method:
                occurrence.reimbursement_payment_method || "",
              repaid_at: occurrence.reimbursed_at || "",
              receipt_file: occurrence.invoice_file_name || "",
              receipt_url: occurrence.invoice_url || "",
            });
          }
        }

        occurrencesSheet.getColumn("amount").numFmt = '£#,##0.00';
        occurrencesSheet.getColumn("repayment_amount").numFmt =
          '£#,##0.00';

        occurrencesSheet.eachRow((row, rowNumber) => {
          if (rowNumber <= 3) return;

          row.alignment = {
            vertical: "top",
            wrapText: true,
          };
          row.height = 30;

          row.eachCell((cell) => {
            cell.border = thinBorder;
            cell.font = {
              color: { argb: excelTheme.slate900 },
              size: 9,
            };
          });

          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb:
                rowNumber % 2 === 0
                  ? excelTheme.tealLight
                  : excelTheme.white,
            },
          };

          const statusCell = row.getCell("status");
          const statusValue = cleanText(statusCell.value).toLowerCase();

          const statusStyles: Record<
            string,
            { fill: string; font: string }
          > = {
            scheduled: {
              fill: excelTheme.skyLight,
              font: excelTheme.sky,
            },
            posted: {
              fill: excelTheme.emeraldLight,
              font: excelTheme.emerald,
            },
            paid: {
              fill: excelTheme.emeraldLight,
              font: excelTheme.emerald,
            },
            failed: {
              fill: excelTheme.redLight,
              font: excelTheme.red,
            },
            skipped: {
              fill: excelTheme.amberLight,
              font: excelTheme.amber,
            },
            cancelled: {
              fill: excelTheme.slate100,
              font: excelTheme.slate500,
            },
          };

          const statusStyle = statusStyles[statusValue];

          if (statusStyle) {
            statusCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: statusStyle.fill },
            };
            statusCell.font = {
              bold: true,
              color: { argb: statusStyle.font },
            };
          }

          const repaymentStatusCell = row.getCell(
            "repayment_status",
          );
          const repaymentStatusValue = cleanText(
            repaymentStatusCell.value,
          ).toLowerCase();

          if (repaymentStatusValue === "repaid") {
            repaymentStatusCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: excelTheme.emeraldLight },
            };
            repaymentStatusCell.font = {
              bold: true,
              color: { argb: excelTheme.emerald },
            };
          } else if (
            repaymentStatusValue === "awaiting repayment" ||
            repaymentStatusValue === "partially repaid"
          ) {
            repaymentStatusCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: excelTheme.amberLight },
            };
            repaymentStatusCell.font = {
              bold: true,
              color: { argb: excelTheme.amber },
            };
          }

          const receiptUrlCell = row.getCell("receipt_url");
          const receiptUrl = cleanText(receiptUrlCell.value);

          if (receiptUrl) {
            receiptUrlCell.value = {
              text: "Open receipt",
              hyperlink: receiptUrl,
            };
            receiptUrlCell.font = {
              color: { argb: excelTheme.sky },
              underline: true,
              bold: true,
            };
          }
        });

        occurrencesSheet.getColumn("occurrence_id").hidden = true;
        occurrencesSheet.getColumn("plan_id").hidden = true;
        occurrencesSheet.getColumn("repayment_transaction_id").hidden = true;
        occurrencesSheet.getColumn("transaction_id").width = 22;
        occurrencesSheet.getColumn("plan_title").width = 26;
        occurrencesSheet.getColumn("receipt_file").width = 24;
        occurrencesSheet.getColumn("receipt_url").width = 18;
      }

      const legendSheet = workbook.addWorksheet("Status Legend", {
        views: [{ showGridLines: false }],
      });

      legendSheet.mergeCells("A1:D2");
      legendSheet.getCell("A1").value =
        "DIRECT DEBIT STATUS LEGEND";
      legendSheet.getCell("A1").font = {
        bold: true,
        size: 18,
        color: { argb: excelTheme.white },
      };
      legendSheet.getCell("A1").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.slate900 },
      };
      legendSheet.getCell("A1").alignment = {
        horizontal: "left",
        vertical: "middle",
        indent: 1,
      };

      legendSheet.getRow(1).height = 26;
      legendSheet.getRow(2).height = 18;

      legendSheet.getRow(4).values = [
        "Area",
        "Status",
        "Meaning",
        "Colour",
      ];

      const legendHeader = legendSheet.getRow(4);
      legendHeader.font = {
        bold: true,
        color: { argb: excelTheme.white },
      };
      legendHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: excelTheme.purple },
      };
      legendHeader.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      legendHeader.border = thinBorder;

      const legendRows = [
        ["Plan", "Active", "Future payments can continue.", excelTheme.emerald],
        ["Plan", "Paused", "Future payment processing is paused.", excelTheme.amber],
        ["Plan", "Cancelled", "Future payments have been cancelled.", excelTheme.red],
        ["Payment", "Scheduled", "Payment is planned but not yet posted.", excelTheme.sky],
        ["Payment", "Posted / Paid", "Payment has been recorded in Money Tracker.", excelTheme.emerald],
        ["Payment", "Failed", "Payment failed and needs attention.", excelTheme.red],
        ["Repayment", "Awaiting repayment", "Burton Pride still owes the personal account holder.", excelTheme.amber],
        ["Repayment", "Repaid", "The person has been repaid.", excelTheme.emerald],
        ["Repayment", "Not required", "Payment came from the Burton Pride account.", excelTheme.slate500],
      ];

      legendRows.forEach((values) => {
        const row = legendSheet.addRow(values);
        row.height = 26;
        row.alignment = {
          vertical: "middle",
          wrapText: true,
        };

        row.eachCell((cell) => {
          cell.border = thinBorder;
        });

        row.getCell(4).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: cleanText(row.getCell(4).value) },
        };
        row.getCell(4).value = "";
      });

      legendSheet.columns = [
        { width: 16 },
        { width: 24 },
        { width: 62 },
        { width: 14 },
      ];

      legendSheet.getColumn(2).font = {
        bold: true,
      };

      legendSheet.pageSetup = {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: {
          left: 0.4,
          right: 0.4,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      };

      legendSheet.headerFooter = {
        differentFirst: false,
        differentOddEven: false,
        oddHeader:
          '&L&B&Burton Pride&C&BStatus Legend&R&D',
        oddFooter:
          '&LInternal finance record&CPage &P of &N&RAdmin Portal',
        evenHeader: "",
        evenFooter: "",
        firstHeader: "",
        firstFooter: "",
      };

      const buffer = await workbook.xlsx.writeBuffer();

      saveBlob(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `burton-pride-direct-debits-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`,
      );

      setToast({
        type: "success",
        message: "The fully styled Direct Debit Excel workbook was downloaded with an executive summary, coloured statuses, print settings and a legend.",
      });
    } catch (exportError) {
      console.error("Direct Debit Excel export failed", exportError);

      setToast({
        type: "error",
        message:
          exportError instanceof Error
            ? exportError.message
            : "The Direct Debit Excel workbook could not be created.",
      });
    } finally {
      setExporting(null);
    }
  }

  function printReport() {
    window.print();
  }

  return (
    <main className="min-h-screen w-full max-w-none overflow-x-hidden bg-[#080812] px-0 py-5 text-white">
      <div className="w-full max-w-none space-y-5 px-2 sm:px-3 lg:px-4">
        <header className="print:hidden w-full rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Link
                href="/Admin/MoneyManagement/TrackingMoney/DirectDebits"
                className="mb-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Direct Debits
              </Link>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Direct Debit export
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                Filter the Direct Debit records, review the report, then export
                a styled Excel workbook, CSV file or print-friendly report.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadPlans()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={printReport}
                disabled={filteredPlans.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-4 py-3 text-sm font-black text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Print report
              </button>

              <button
                type="button"
                onClick={() => void exportCsv()}
                disabled={filteredPlans.length === 0 || Boolean(exporting)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-4 py-3 text-sm font-black text-amber-100 ring-1 ring-amber-300/20 hover:bg-amber-500/25 disabled:opacity-50"
              >
                {exporting === "csv" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => void exportExcel()}
                disabled={filteredPlans.length === 0 || Boolean(exporting)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {exporting === "excel" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Export Excel
              </button>
            </div>
          </div>
        </header>

        {toast ? (
          <div
            className={`print:hidden rounded-2xl border p-4 text-sm font-bold ${
              toast.type === "success"
                ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-300/30 bg-red-500/10 text-red-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {toast.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <p className="whitespace-pre-line">{toast.message}</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <section className="print:hidden rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">Direct Debit export error</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-red-100/80">
                  {error}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="print:hidden w-full rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-purple-200" />
            <h2 className="font-black">Export filters</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="relative block xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search plan, supplier, holder, reference..."
                className="w-full rounded-xl bg-black/25 py-3 pl-10 pr-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-purple-300/40"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10"
            >
              <option className="bg-[#11111f]" value="all">
                All statuses
              </option>
              <option className="bg-[#11111f]" value="active">
                Active
              </option>
              <option className="bg-[#11111f]" value="paused">
                Paused
              </option>
              <option className="bg-[#11111f]" value="draft">
                Draft
              </option>
              <option className="bg-[#11111f]" value="completed">
                Completed
              </option>
              <option className="bg-[#11111f]" value="cancelled">
                Cancelled
              </option>
            </select>

            <select
              value={accountFilter}
              onChange={(event) =>
                setAccountFilter(event.target.value as AccountFilter)
              }
              className="rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10"
            >
              <option className="bg-[#11111f]" value="all">
                All paying accounts
              </option>
              <option className="bg-[#11111f]" value="organisation">
                Burton Pride account
              </option>
              <option className="bg-[#11111f]" value="personal">
                Personal accounts
              </option>
            </select>

            <select
              value={repaymentFilter}
              onChange={(event) =>
                setRepaymentFilter(
                  event.target.value as RepaymentFilter,
                )
              }
              className="rounded-xl bg-black/25 p-3 text-sm font-bold text-white outline-none ring-1 ring-white/10"
            >
              <option className="bg-[#11111f]" value="all">
                All repayment states
              </option>
              <option
                className="bg-[#11111f]"
                value="awaiting_reimbursement"
              >
                Awaiting repayment
              </option>
              <option
                className="bg-[#11111f]"
                value="partially_reimbursed"
              >
                Partially repaid
              </option>
              <option className="bg-[#11111f]" value="reimbursed">
                Repaid
              </option>
              <option className="bg-[#11111f]" value="not_required">
                Not required
              </option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/75 ring-1 ring-white/10">
              <input
                type="checkbox"
                checked={includeOccurrences}
                onChange={(event) =>
                  setIncludeOccurrences(event.target.checked)
                }
                className="h-4 w-4 accent-emerald-500"
              />
              Include full payment schedule in Excel
            </label>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black text-white/75 ring-1 ring-white/10 hover:bg-white/15"
            >
              Clear filters
            </button>

            <p className="text-sm font-semibold text-white/45">
              Exporting {filteredPlans.length} of {plans.length} plans.
            </p>
          </div>
        </section>

        <section className="direct-debit-print-summary grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {[
            {
              label: "Plans",
              value: summary.plans,
              icon: <FileSpreadsheet className="h-5 w-5" />,
            },
            {
              label: "Active",
              value: summary.activePlans,
              icon: <CheckCircle2 className="h-5 w-5" />,
            },
            {
              label: "Monthly commitment",
              value: money(summary.monthlyCommitment),
              icon: <BadgePoundSterling className="h-5 w-5" />,
            },
            {
              label: "Personal plans",
              value: summary.personalPlans,
              icon: <UserRound className="h-5 w-5" />,
            },
            {
              label: "Repayment due",
              value: money(summary.reimbursementOutstanding),
              icon: <Banknote className="h-5 w-5" />,
            },
            {
              label: "Scheduled payments",
              value: summary.scheduledPayments,
              icon: <CalendarDays className="h-5 w-5" />,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 print:border-slate-300 print:bg-white print:text-black"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-white/45 print:text-slate-500">
                  {card.label}
                </p>
                <div className="text-purple-200 print:text-purple-700">
                  {card.icon}
                </div>
              </div>
              <p className="mt-2 text-2xl font-black">{card.value}</p>
            </div>
          ))}
        </section>

        <section
          id="direct-debit-print-report"
          className="direct-debit-print-report w-full rounded-3xl border border-white/10 bg-white/[0.04] p-4 print:border-0 print:bg-white print:p-0 print:text-black"
        >
          <div className="direct-debit-print-header mb-5 hidden print:block">
            <div className="direct-debit-print-brand">
              <div>
                <p className="direct-debit-print-kicker">
                  BURTON PRIDE · MONEY MANAGEMENT
                </p>
                <h1>Direct Debit Report</h1>
                <p className="direct-debit-print-subtitle">
                  Monthly commitments, paying accounts, payment progress and
                  personal-account repayments.
                </p>
              </div>

              <div className="direct-debit-print-meta">
                <p>
                  <strong>Generated</strong>
                  <span>{reportGeneratedAt.toLocaleString("en-GB")}</span>
                </p>
                <p>
                  <strong>Plans included</strong>
                  <span>{filteredPlans.length}</span>
                </p>
                <p>
                  <strong>Report status</strong>
                  <span>Internal finance record</span>
                </p>
              </div>
            </div>

            <div className="direct-debit-print-rule" />
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-200" />
                <p className="mt-3 text-sm font-bold text-white/50">
                  Loading export data...
                </p>
              </div>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-white/25" />
              <h2 className="mt-3 text-xl font-black">
                No Direct Debit records to export
              </h2>
              <p className="mt-2 text-sm text-white/50">
                Change the filters or create a Direct Debit plan first.
              </p>
            </div>
          ) : (
            <div className="direct-debit-print-table-wrap overflow-x-auto">
              <table className="direct-debit-print-table w-full min-w-[1500px] border-collapse text-left text-sm print:min-w-0">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.05] print:border-slate-300 print:bg-slate-100">
                    {[
                      "Title",
                      "Status",
                      "Monthly amount",
                      "Paying account",
                      "Account holder",
                      "Supplier",
                      "Next collection",
                      "Progress",
                      "Repayment",
                      "Budget",
                      "Mandate reference",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-3 py-3 font-black"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-white/10 align-top print:border-slate-200"
                    >
                      <td className="px-3 py-3">
                        <p className="font-black">{plan.title}</p>
                        <p className="mt-1 max-w-xs text-xs text-white/45 print:text-slate-500">
                          {plan.description || "No description"}
                        </p>
                      </td>
                      <td className="px-3 py-3 font-bold">
                        {statusLabel(plan.status)}
                      </td>
                      <td className="px-3 py-3 font-black">
                        {money(plan.amount_pence)}
                      </td>
                      <td className="px-3 py-3">
                        {plan.account_source === "personal"
                          ? "Personal account"
                          : "Burton Pride account"}
                      </td>
                      <td className="px-3 py-3">
                        {plan.account_holder || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {plan.supplier_name || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {dateLabel(plan.next_collection_date)}
                      </td>
                      <td className="px-3 py-3">
                        {plan.payments_paid ?? 0} posted ·{" "}
                        {plan.is_open_ended
                          ? "Open ended"
                          : `${Math.max(
                              0,
                              Number(plan.total_payments || 0) -
                                Number(plan.payments_paid || 0),
                            )} remaining`}
                      </td>
                      <td className="px-3 py-3">
                        {plan.account_source === "personal"
                          ? `${reimbursementStatusLabel(
                              latestReimbursementStatus(plan),
                            )} · ${money(
                              outstandingReimbursement(plan),
                            )}`
                          : "Not required"}
                      </td>
                      <td className="px-3 py-3">
                        {plan.budget_category_label ||
                          plan.budget_category_key ||
                          "Not assigned"}
                      </td>
                      <td className="px-3 py-3">
                        {plan.mandate_reference || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <footer className="direct-debit-print-footer hidden print:flex">
            <p>Burton Pride Admin Portal · Money Management</p>
            <p>Confidential internal finance report</p>
          </footer>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          html,
          body {
            width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /*
           * Hide every Admin Portal layer first. The report is made visible
           * again below. This removes the sidebar, navigation, loading layers,
           * fixed notifications and the Money Management beta watermark.
           */
          body > * {
            visibility: hidden !important;
          }

          body * {
            animation: none !important;
            transition: none !important;
          }

          [data-watermark],
          [data-money-watermark],
          [data-beta-watermark],
          [class*="watermark" i],
          [id*="watermark" i],
          [class*="beta-banner" i],
          [id*="beta-banner" i],
          [class*="beta-notice" i],
          [id*="beta-notice" i],
          [class*="toast" i],
          [role="status"],
          [role="alert"],
          aside,
          nav,
          header:not(.direct-debit-print-header),
          [class*="sidebar" i],
          [class*="navigation" i],
          [class*="admin-access" i],
          [class*="loading-screen" i],
          [class*="fixed" i],
          body::before,
          body::after {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            content: none !important;
          }

          #direct-debit-print-report,
          #direct-debit-print-report * {
            visibility: visible !important;
          }

          #direct-debit-print-report {
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 2147483647 !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            color: #111827 !important;
          }

          .direct-debit-print-header {
            display: block !important;
            margin: 0 0 5mm !important;
            page-break-after: avoid !important;
          }

          .direct-debit-print-brand {
            display: flex !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 8mm !important;
            padding: 5mm 6mm !important;
            border: 0.35mm solid #d8b4fe !important;
            border-radius: 3mm !important;
            background:
              linear-gradient(135deg, #faf5ff 0%, #ffffff 55%, #f0fdfa 100%)
              !important;
          }

          .direct-debit-print-kicker {
            margin: 0 0 1.5mm !important;
            color: #7e22ce !important;
            font-size: 7.5pt !important;
            font-weight: 900 !important;
            letter-spacing: 0.14em !important;
          }

          .direct-debit-print-brand h1 {
            margin: 0 !important;
            color: #111827 !important;
            font-size: 22pt !important;
            font-weight: 900 !important;
            line-height: 1.05 !important;
          }

          .direct-debit-print-subtitle {
            max-width: 145mm !important;
            margin: 2mm 0 0 !important;
            color: #475569 !important;
            font-size: 8.5pt !important;
            line-height: 1.45 !important;
          }

          .direct-debit-print-meta {
            min-width: 55mm !important;
            padding-left: 5mm !important;
            border-left: 0.3mm solid #ddd6fe !important;
          }

          .direct-debit-print-meta p {
            display: flex !important;
            justify-content: space-between !important;
            gap: 5mm !important;
            margin: 0 0 1.5mm !important;
            font-size: 7.5pt !important;
            line-height: 1.35 !important;
          }

          .direct-debit-print-meta strong {
            color: #64748b !important;
            font-weight: 800 !important;
          }

          .direct-debit-print-meta span {
            color: #111827 !important;
            font-weight: 800 !important;
            text-align: right !important;
          }

          .direct-debit-print-rule {
            height: 1mm !important;
            margin-top: 2mm !important;
            border-radius: 999px !important;
            background:
              linear-gradient(90deg, #7e22ce 0%, #db2777 48%, #0f766e 100%)
              !important;
          }

          /*
           * Summary cards appear above the report in the screen layout. Move
           * them into a clean, compact six-column print strip.
           */
          .direct-debit-print-summary {
            position: absolute !important;
            top: 39mm !important;
            left: 0 !important;
            z-index: 2147483646 !important;
            display: grid !important;
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
            gap: 2mm !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: visible !important;
          }

          .direct-debit-print-summary,
          .direct-debit-print-summary * {
            visibility: visible !important;
          }

          .direct-debit-print-summary > div {
            min-height: 18mm !important;
            padding: 3mm !important;
            border: 0.3mm solid #cbd5e1 !important;
            border-radius: 2.5mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            break-inside: avoid !important;
          }

          .direct-debit-print-summary p:first-child {
            color: #64748b !important;
            font-size: 6.5pt !important;
            font-weight: 900 !important;
            letter-spacing: 0.06em !important;
          }

          .direct-debit-print-summary p:last-child {
            margin-top: 1.5mm !important;
            color: #111827 !important;
            font-size: 14pt !important;
            font-weight: 900 !important;
          }

          .direct-debit-print-report {
            padding-top: 24mm !important;
          }

          .direct-debit-print-table-wrap {
            width: 100% !important;
            overflow: visible !important;
          }

          .direct-debit-print-table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            border: 0.3mm solid #cbd5e1 !important;
            border-radius: 2mm !important;
            overflow: hidden !important;
            font-size: 6.8pt !important;
          }

          .direct-debit-print-table thead {
            display: table-header-group !important;
          }

          .direct-debit-print-table thead tr {
            background:
              linear-gradient(90deg, #4c1d95 0%, #7e22ce 55%, #0f766e 100%)
              !important;
          }

          .direct-debit-print-table th {
            padding: 2.5mm 1.8mm !important;
            border-right: 0.2mm solid rgba(255, 255, 255, 0.25) !important;
            background: transparent !important;
            color: #ffffff !important;
            font-size: 6.4pt !important;
            font-weight: 900 !important;
            line-height: 1.25 !important;
            white-space: normal !important;
            vertical-align: middle !important;
          }

          .direct-debit-print-table td {
            padding: 2.5mm 1.8mm !important;
            border-right: 0.2mm solid #e2e8f0 !important;
            border-bottom: 0.2mm solid #e2e8f0 !important;
            color: #1f2937 !important;
            font-size: 6.6pt !important;
            line-height: 1.35 !important;
            vertical-align: top !important;
            overflow-wrap: anywhere !important;
            word-break: normal !important;
          }

          .direct-debit-print-table tbody tr:nth-child(even) {
            background: #f8fafc !important;
          }

          .direct-debit-print-table tbody tr:nth-child(odd) {
            background: #ffffff !important;
          }

          .direct-debit-print-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .direct-debit-print-table th:nth-child(1),
          .direct-debit-print-table td:nth-child(1) {
            width: 13% !important;
          }

          .direct-debit-print-table th:nth-child(2),
          .direct-debit-print-table td:nth-child(2) {
            width: 6% !important;
          }

          .direct-debit-print-table th:nth-child(3),
          .direct-debit-print-table td:nth-child(3) {
            width: 7% !important;
          }

          .direct-debit-print-table th:nth-child(4),
          .direct-debit-print-table td:nth-child(4) {
            width: 9% !important;
          }

          .direct-debit-print-table th:nth-child(5),
          .direct-debit-print-table td:nth-child(5) {
            width: 8% !important;
          }

          .direct-debit-print-table th:nth-child(6),
          .direct-debit-print-table td:nth-child(6) {
            width: 8% !important;
          }

          .direct-debit-print-table th:nth-child(7),
          .direct-debit-print-table td:nth-child(7) {
            width: 9% !important;
          }

          .direct-debit-print-table th:nth-child(8),
          .direct-debit-print-table td:nth-child(8) {
            width: 10% !important;
          }

          .direct-debit-print-table th:nth-child(9),
          .direct-debit-print-table td:nth-child(9) {
            width: 10% !important;
          }

          .direct-debit-print-table th:nth-child(10),
          .direct-debit-print-table td:nth-child(10) {
            width: 10% !important;
          }

          .direct-debit-print-table th:nth-child(11),
          .direct-debit-print-table td:nth-child(11) {
            width: 10% !important;
          }

          .direct-debit-print-table p {
            margin: 0 !important;
            color: inherit !important;
          }

          .direct-debit-print-table td p + p {
            margin-top: 1mm !important;
            color: #64748b !important;
            font-size: 6pt !important;
          }

          .direct-debit-print-footer {
            display: flex !important;
            justify-content: space-between !important;
            gap: 5mm !important;
            margin-top: 4mm !important;
            padding-top: 2mm !important;
            border-top: 0.3mm solid #cbd5e1 !important;
            color: #64748b !important;
            font-size: 6.5pt !important;
            font-weight: 700 !important;
          }

          a {
            color: inherit !important;
            text-decoration: none !important;
          }

          svg {
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </main>
  );
}
