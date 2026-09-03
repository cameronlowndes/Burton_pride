"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
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
};

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default function AcceptancesClient() {
  const [items, setItems] = useState<AcceptanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [choice, setChoice] = useState("all");
  const [exporting, setExporting] = useState(false);

  async function loadRecords() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });
      const data: ApiResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to load declaration records.");
      }

      setItems(data.items || []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load declaration records.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

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

  const orderCount = new Set(items.map((item) => item.order_id)).size;
  const marketingYes = items.filter(
    (item) => item.acceptance_type === "marketing_opt_in" && item.accepted,
  ).length;
  const marketingNo = items.filter(
    (item) => item.acceptance_type === "marketing_opt_in" && !item.accepted,
  ).length;

  async function exportXlsx() {
    if (!filtered.length || exporting) return;

    setExporting(true);
    setError(null);

    try {
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
        ["B6", "Recorded choices", filtered.length, colours.purple],
        ["E6", "Orders represented", new Set(filtered.map((item) => item.order_id)).size, "FF2563EB"],
        ["B9", "Marketing opt-ins", filtered.filter((item) => item.acceptance_type === "marketing_opt_in" && item.accepted).length, colours.green],
        ["E9", "Marketing declined", filtered.filter((item) => item.acceptance_type === "marketing_opt_in" && !item.accepted).length, colours.red],
      ] as const;

      for (const [cellAddress, label, value, colour] of summaryCards) {
        const cell = summary.getCell(cellAddress);
        const startColumn = Number(cell.col);
        const startRow = Number(cell.row);
        summary.mergeCells(startRow, startColumn, startRow + 1, startColumn + 1);
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
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colour } };
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
        "This workbook contains the currently filtered records shown in Lottery Management.";
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
          oddFooter: "&LBurton Pride C.I.C&CDeclarations & Consent&RPage &P of &N",
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
        { key: "ipAddress", width: 22 },
      ];

      declarations.mergeCells("A1:J2");
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

      declarations.mergeCells("A3:J3");
      declarations.getCell("A3").value =
        `Exported records: ${filtered.length}  |  Filter: ${type === "all" ? "All declarations" : typeLabel(type)}  |  Choice: ${choice === "all" ? "All" : choice === "accepted" ? "Yes" : "No"}`;
      declarations.getCell("A3").font = {
        name: "Arial",
        size: 10,
        color: { argb: colours.grey },
      };
      declarations.getCell("A3").alignment = { horizontal: "center" };
      declarations.getRow(4).height = 8;

      const headings = [
        "Accepted at",
        "Order reference",
        "Purchaser",
        "Email",
        "Lottery",
        "Declaration",
        "Accepted",
        "Version",
        "Payment status",
        "IP address",
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

      filtered.forEach((item, index) => {
        const row = declarations.addRow({
          acceptedAt: new Date(item.accepted_at),
          orderReference: item.order?.order_reference || item.order_id,
          purchaser: item.order?.purchaser_name || "Not provided",
          email: item.order?.purchaser_email || "Not provided",
          lottery: item.lottery?.title || item.lottery_id,
          declaration: typeLabel(item.acceptance_type),
          accepted: item.accepted ? "Yes" : "No",
          version: item.version || "Not recorded",
          paymentStatus: item.order?.payment_status || "Unknown",
          ipAddress: item.ip_address || "Not available",
        });

        row.height = 24;
        row.eachCell((cell) => {
          cell.font = { name: "Arial", size: 10, color: { argb: colours.navy } };
          cell.alignment = { vertical: "middle", wrapText: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: index % 2 === 0 ? colours.white : colours.greySoft },
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
          fgColor: { argb: item.accepted ? colours.greenSoft : colours.redSoft },
        };
        row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(9).font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: item.order?.payment_status === "paid" ? "FF065F46" : colours.navy },
        };
        row.getCell(9).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: item.order?.payment_status === "paid"
              ? colours.greenSoft
              : colours.blueSoft,
          },
        };
        row.getCell(9).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(10).numFmt = "@";
      });

      declarations.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: Math.max(5, declarations.rowCount), column: 10 },
      };

      declarations.getColumn(2).numFmt = "@";
      declarations.getColumn(4).numFmt = "@";
      declarations.getColumn(10).numFmt = "@";

      const buffer = await workbook.xlsx.writeBuffer();
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
      URL.revokeObjectURL(url);
    } catch (caught) {
      console.error("Lottery declarations XLSX export failed:", caught);
      setError(
        "The formatted Excel report could not be created. Check that ExcelJS is installed.",
      );
    } finally {
      setExporting(false);
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
              Declarations &amp; Consent
            </h1>
            <p className="mt-2 max-w-3xl text-white/55">
              Evidence of the confirmations and marketing choices recorded when
              purchasers continue to Stripe.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadRecords}
              disabled={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 py-2 font-bold hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportXlsx}
              disabled={!filtered.length || exporting}
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Recorded choices" value={String(items.length)} />
          <Stat label="Orders recorded" value={String(orderCount)} />
          <Stat label="Marketing opt-ins" value={String(marketingYes)} />
          <Stat label="Marketing declined" value={String(marketingNo)} />
        </section>

        <section className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl md:grid-cols-[minmax(0,1fr)_260px_220px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, purchaser, email or lottery..."
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-white outline-none placeholder:text-white/30 focus:border-purple-400/60"
            />
          </label>
          <Select value={type} onChange={setType}>
            <option value="all">All declaration types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={choice} onChange={setChoice}>
            <option value="all">All choices</option>
            <option value="accepted">Accepted / Yes</option>
            <option value="not_accepted">Not accepted / No</option>
          </Select>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 font-semibold text-red-100">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] backdrop-blur-xl">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-white/60">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading declaration records...
            </div>
          ) : !filtered.length ? (
            <div className="p-10 text-center">
              <FileCheck2 className="mx-auto h-9 w-9 text-white/30" />
              <h2 className="mt-3 font-black">No declaration records found</h2>
              <p className="mt-1 text-sm text-white/45">
                New records will appear after a purchaser continues to payment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1150px] w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th className="px-5 py-4">Recorded</th>
                    <th className="px-5 py-4">Order &amp; purchaser</th>
                    <th className="px-5 py-4">Lottery</th>
                    <th className="px-5 py-4">Declaration</th>
                    <th className="px-5 py-4">Choice</th>
                    <th className="px-5 py-4">Version</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">IP address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.04]">
                      <td className="whitespace-nowrap px-5 py-4 text-white/65">
                        {formatDate(item.accepted_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-black">{item.order?.order_reference || item.order_id}</div>
                        <div className="mt-1 text-white/55">{item.order?.purchaser_name || "Not provided"}</div>
                        <div className="text-xs text-white/40">{item.order?.purchaser_email || "Not provided"}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-white/75">
                        {item.lottery?.title || item.lottery_id}
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        {typeLabel(item.acceptance_type)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${
                          item.accepted
                            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                            : "border-slate-400/20 bg-white/5 text-white/55"
                        }`}>
                          {item.accepted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {item.accepted ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-white/55">{item.version || "Not recorded"}</td>
                      <td className="px-5 py-4 capitalize text-white/65">{item.order?.payment_status || "Unknown"}</td>
                      <td className="px-5 py-4 font-mono text-xs text-white/45">{item.ip_address || "Not available"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl">
      <div className="text-xs font-bold uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
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
