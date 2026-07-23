import ExcelJS from "exceljs";

export type AuditExportRow = {
  occurred_at: string;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_role?: string | null;
  action_label: string;
  action_key: string;
  module: string;
  record_type?: string | null;
  record_name?: string | null;
  record_reference?: string | null;
  status: string;
  risk_level: string;
  description?: string | null;
  reason?: string | null;
  quantity_before?: number | null;
  quantity_change?: number | null;
  quantity_after?: number | null;
  source_location_name?: string | null;
  destination_location_name?: string | null;
  changed_fields?: string[] | null;
  request_id?: string | null;
  api_endpoint?: string | null;
  http_method?: string | null;
  http_status?: number | null;
  error_code?: string | null;
  error_message?: string | null;
};

type ExportAuditWorkbookOptions = {
  logs: AuditExportRow[];
  generatedBy?: string | null;
  fileName?: string;
};

const COLOURS = {
  navy: "FF172554",
  white: "FFFFFFFF",
  slate: "FF334155",
  light: "FFF8FAFC",
  border: "FFD8DEE9",
  text: "FF111827",
  muted: "FF64748B",
  green: "FF047857",
  greenLight: "FFD1FAE5",
  red: "FFB91C1C",
  redLight: "FFFEE2E2",
  amber: "FFB45309",
  amberLight: "FFFEF3C7",
  blue: "FF1D4ED8",
  blueLight: "FFDBEAFE",
  purple: "FF7E22CE",
  purpleLight: "FFF3E8FF",
};

function statusColours(status: string) {
  if (status === "success") {
    return { fill: COLOURS.greenLight, font: COLOURS.green };
  }

  if (status === "failed") {
    return { fill: COLOURS.redLight, font: COLOURS.red };
  }

  if (status === "blocked") {
    return { fill: COLOURS.amberLight, font: COLOURS.amber };
  }

  return { fill: COLOURS.blueLight, font: COLOURS.blue };
}

function riskColours(risk: string) {
  if (risk === "critical") {
    return { fill: COLOURS.redLight, font: COLOURS.red };
  }

  if (risk === "high") {
    return { fill: COLOURS.amberLight, font: COLOURS.amber };
  }

  if (risk === "medium") {
    return { fill: COLOURS.blueLight, font: COLOURS.blue };
  }

  return { fill: COLOURS.greenLight, font: COLOURS.green };
}

function safeDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}

function makeFileName(value?: string) {
  if (value?.trim()) {
    return value.endsWith(".xlsx") ? value : `${value}.xlsx`;
  }

  return `burton-pride-stock-audit-logs-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
}

export async function exportAuditWorkbook({
  logs,
  generatedBy,
  fileName,
}: ExportAuditWorkbookOptions) {
  if (!logs.length) {
    throw new Error("There are no audit logs to export.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = generatedBy || "Burton Pride Stock Control";
  workbook.created = new Date();

  const addAuditSheet = (
    name: string,
    rows: AuditExportRow[],
  ) => {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 4, xSplit: 2 }],
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    sheet.mergeCells("A1:Y1");
    const title = sheet.getCell("A1");
    title.value = `Burton Pride Stock Audit Logs — ${name}`;
    title.font = {
      name: "Aptos Display",
      size: 20,
      bold: true,
      color: { argb: COLOURS.white },
    };
    title.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOURS.navy },
    };
    title.alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(1).height = 36;

    sheet.mergeCells("A2:Y2");
    const subtitle = sheet.getCell("A2");
    subtitle.value = `Generated ${new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date())}${
      generatedBy ? ` • ${generatedBy}` : ""
    }`;
    subtitle.font = {
      name: "Aptos",
      size: 10,
      italic: true,
      color: { argb: COLOURS.muted },
    };

    const headers = [
      "Date and time",
      "Admin name",
      "Admin email",
      "Admin role",
      "Action",
      "Action key",
      "Module",
      "Record type",
      "Record name",
      "Reference",
      "Status",
      "Risk",
      "Description",
      "Reason",
      "Quantity before",
      "Quantity change",
      "Quantity after",
      "Source location",
      "Destination location",
      "Changed fields",
      "Request ID",
      "API endpoint",
      "HTTP method",
      "HTTP status",
      "Error",
    ];

    const headerRow = sheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 30;

    headerRow.eachCell((cell) => {
      cell.font = {
        name: "Aptos",
        size: 10,
        bold: true,
        color: { argb: COLOURS.white },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOURS.slate },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: COLOURS.border } },
        left: { style: "thin", color: { argb: COLOURS.border } },
        bottom: { style: "thin", color: { argb: COLOURS.border } },
        right: { style: "thin", color: { argb: COLOURS.border } },
      };
    });

    rows.forEach((log, index) => {
      const row = sheet.getRow(index + 5);

      row.values = [
        safeDate(log.occurred_at),
        log.admin_name || "",
        log.admin_email || "",
        log.admin_role || "",
        log.action_label,
        log.action_key,
        log.module,
        log.record_type || "",
        log.record_name || "",
        log.record_reference || "",
        log.status,
        log.risk_level,
        log.description || "",
        log.reason || "",
        log.quantity_before ?? null,
        log.quantity_change ?? null,
        log.quantity_after ?? null,
        log.source_location_name || "",
        log.destination_location_name || "",
        (log.changed_fields || []).join(", "),
        log.request_id || "",
        log.api_endpoint || "",
        log.http_method || "",
        log.http_status ?? null,
        [log.error_code, log.error_message]
          .filter(Boolean)
          .join(": "),
      ];

      row.height = 24;
      const fill = index % 2 === 0 ? COLOURS.white : COLOURS.light;

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = {
          name: "Aptos",
          size: 10,
          color: { argb: COLOURS.text },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fill },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
          wrapText: true,
        };
        cell.border = {
          top: { style: "hair", color: { argb: COLOURS.border } },
          left: { style: "hair", color: { argb: COLOURS.border } },
          bottom: { style: "hair", color: { argb: COLOURS.border } },
          right: { style: "hair", color: { argb: COLOURS.border } },
        };
      });

      row.getCell(1).numFmt = "dd mmm yyyy, hh:mm:ss";

      const status = statusColours(log.status);
      row.getCell(11).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: status.fill },
      };
      row.getCell(11).font = {
        name: "Aptos",
        size: 10,
        bold: true,
        color: { argb: status.font },
      };

      const risk = riskColours(log.risk_level);
      row.getCell(12).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: risk.fill },
      };
      row.getCell(12).font = {
        name: "Aptos",
        size: 10,
        bold: true,
        color: { argb: risk.font },
      };
    });

    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: Math.max(4, rows.length + 4), column: headers.length },
    };

    const widths = [
      22, 20, 28, 16, 28, 28, 18, 18, 24, 20, 13, 12,
      36, 32, 14, 14, 14, 22, 22, 26, 38, 40, 12, 12, 38,
    ];

    widths.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });

    return sheet;
  };

  addAuditSheet("Audit Logs", logs);
  addAuditSheet(
    "Failed Actions",
    logs.filter((log) => log.status === "failed"),
  );
  addAuditSheet(
    "High-Risk Actions",
    logs.filter(
      (log) =>
        log.risk_level === "high" ||
        log.risk_level === "critical",
    ),
  );

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.mergeCells("A1:D1");
  summarySheet.getCell("A1").value =
    "Burton Pride Stock Audit Summary";
  summarySheet.getCell("A1").font = {
    name: "Aptos Display",
    size: 20,
    bold: true,
    color: { argb: COLOURS.white },
  };
  summarySheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLOURS.navy },
  };
  summarySheet.getRow(1).height = 36;

  const summaryRows = [
    ["Total actions", logs.length],
    [
      "Successful",
      logs.filter((log) => log.status === "success").length,
    ],
    [
      "Failed",
      logs.filter((log) => log.status === "failed").length,
    ],
    [
      "Blocked",
      logs.filter((log) => log.status === "blocked").length,
    ],
    [
      "High risk",
      logs.filter((log) => log.risk_level === "high").length,
    ],
    [
      "Critical risk",
      logs.filter((log) => log.risk_level === "critical").length,
    ],
    [
      "Administrators",
      new Set(
        logs
          .map((log) => log.admin_email || log.admin_name)
          .filter(Boolean),
      ).size,
    ],
  ];

  summaryRows.forEach(([label, value], index) => {
    const row = summarySheet.getRow(index + 3);
    row.values = [label, value];
    row.getCell(1).font = { bold: true };
    row.getCell(2).font = { bold: true, size: 14 };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOURS.purpleLight },
    };
    row.getCell(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOURS.blueLight },
    };
  });

  summarySheet.getColumn(1).width = 28;
  summarySheet.getColumn(2).width = 18;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = makeFileName(fileName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
