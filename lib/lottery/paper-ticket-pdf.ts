import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import bwipjs from "bwip-js";
import sharp from "sharp";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  PDFImage,
  rgb,
  Duplex,
  PrintScaling,
} from "pdf-lib";

export const PAPER_PDF_BUCKET = "lottery-paper-ticket-pdfs";
export const PAPER_DESIGN_BUCKET = "lottery-paper-ticket-designs";
export const PDF_LIMIT_BYTES = 50 * 1024 * 1024;

const MM = 72 / 25.4;
const PAGE_WIDTH = 297 * MM;
const PAGE_HEIGHT = 210 * MM;

/**
 * IMPORTANT
 * ---------
 * The uploaded artwork IS the ticket. We no longer render a thumbnail with
 * extra information below it. The image fills the physical ticket rectangle,
 * and variable information is stamped directly on top of the artwork.
 *
 * The Burton Pride artwork is designed at 2:1. The print layouts below keep
 * that ratio so the supplied artwork is not squeezed or stretched.
 */
const LAYOUTS: Record<2 | 4 | 6, { widthMm: number; heightMm: number; gapXmm: number; gapYmm: number }> = {
  2: { widthMm: 140, heightMm: 70, gapXmm: 0, gapYmm: 8 },
  4: { widthMm: 135, heightMm: 67.5, gapXmm: 4, gapYmm: 5 },
  6: { widthMm: 130, heightMm: 65, gapXmm: 5, gapYmm: 4 },
};

export class PaperPdfError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 409,
  ) {
    super(message);
    this.name = "PaperPdfError";
  }
}

export type PaperBatch = {
  id: string;
  lottery_id: string;
  batch_reference: string;
  quantity: number;
  page_size: string;
  tickets_per_sheet: number;
  duplex_flip: string;
  code_format: string;
  front_design_path: string;
  back_design_path: string | null;
  status: string;
  cancelled_at: string | null;
  pdf_path: string | null;
  pdf_sha256: string | null;
  pdf_bytes: number | null;
  pdf_page_count: number | null;
  pdf_generated_at: string | null;
};

export type PaperLottery = {
  id: string;
  title: string;
  draw_at: string | null;
  timezone: string;
  currency: string;
  ticket_price: number | string;
  ticket_price_pence: number | null;
  minimum_age: number;
  promoting_society_legal_name: string | null;
  registration_licence_number: string | null;
  licensing_authority: string | null;
  responsible_promoter_name: string | null;
  responsible_promoter_address: string | null;
  required_ticket_wording: string | null;
};

export type PaperPdfTicket = {
  id: string;
  ticket_number: string;
  barcode_token_hash: string;
  barcode_token: string;
  barcode_value: string;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ArtworkInfo = {
  image: PDFImage;
  width: number;
  height: number;
};

const characterSets = new WeakMap<PDFFont, Set<number>>();

function checkCharacters(font: PDFFont, text: string) {
  let supported = characterSets.get(font);
  if (!supported) {
    supported = new Set(font.getCharacterSet());
    characterSets.set(font, supported);
  }

  for (const character of text) {
    if (!/\s/.test(character) && !supported.has(character.codePointAt(0)!)) {
      throw new PaperPdfError(
        "Some ticket text contains a character the PDF font cannot print. Remove emoji or use ordinary text.",
        "PDF_UNSUPPORTED_CHARACTER",
        400,
      );
    }
  }
}

function cleanSingleLine(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

function fitTextSize(font: PDFFont, text: string, maxWidth: number, wantedSize: number, minSize = 5) {
  const cleaned = cleanSingleLine(text);
  checkCharacters(font, cleaned);
  const measured = font.widthOfTextAtSize(cleaned, wantedSize);
  const actual = measured > maxWidth ? wantedSize * (maxWidth / measured) : wantedSize;

  if (actual < minSize) {
    throw new PaperPdfError(
      "Some ticket information is too long for the artwork. Shorten the relevant lottery field.",
      "PDF_TEXT_TOO_LONG",
      400,
    );
  }

  return { cleaned, size: actual };
}

function drawCentredText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  rect: Rect,
  wantedSize: number,
  minSize = 5,
) {
  const { cleaned, size } = fitTextSize(font, value, rect.width, wantedSize, minSize);
  const textWidth = font.widthOfTextAtSize(cleaned, size);
  const textHeight = font.heightAtSize(size, { descender: false });

  page.drawText(cleaned, {
    x: rect.x + (rect.width - textWidth) / 2,
    y: rect.y + (rect.height - textHeight) / 2 + size * 0.1,
    font,
    size,
    color: rgb(0.03, 0.13, 0.38),
  });
}

function drawLeftText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  rect: Rect,
  wantedSize: number,
  minSize = 5,
) {
  const { cleaned, size } = fitTextSize(font, value, rect.width, wantedSize, minSize);
  const textHeight = font.heightAtSize(size, { descender: false });
  page.drawText(cleaned, {
    x: rect.x,
    y: rect.y + (rect.height - textHeight) / 2 + size * 0.1,
    font,
    size,
    color: rgb(0.03, 0.13, 0.38),
  });
}

function relativeRect(ticket: Rect, x: number, y: number, width: number, height: number): Rect {
  return {
    x: ticket.x + ticket.width * x,
    y: ticket.y + ticket.height * y,
    width: ticket.width * width,
    height: ticket.height * height,
  };
}

function paintPatch(page: PDFPage, rect: Rect, opacity = 0.96) {
  page.drawRectangle({
    ...rect,
    color: rgb(1, 1, 1),
    opacity,
  });
}

/**
 * Slot position for A4 landscape.
 *
 * Front pages use natural order. Back pages mirror the position across the
 * selected duplex edge, so the correct back lands behind the correct front.
 */
export function paperTicketPosition(
  index: number,
  perSheet: number,
  back: boolean,
  flip: string,
): Rect {
  if (![2, 4, 6].includes(perSheet) || index < 0 || index >= perSheet) {
    throw new PaperPdfError("Invalid ticket layout.", "INVALID_PDF_LAYOUT", 400);
  }

  const typed = perSheet as 2 | 4 | 6;
  const layout = LAYOUTS[typed];
  const columns = perSheet === 2 ? 1 : 2;
  const rows = Math.ceil(perSheet / columns);

  let col = index % columns;
  let row = Math.floor(index / columns);

  if (back) {
    if (flip === "long_edge") {
      row = rows - 1 - row;
    } else if (flip === "short_edge") {
      col = columns - 1 - col;
    } else {
      throw new PaperPdfError("Invalid duplex setting.", "INVALID_DUPLEX_FLIP", 400);
    }
  }

  const width = layout.widthMm * MM;
  const height = layout.heightMm * MM;
  const gapX = layout.gapXmm * MM;
  const gapY = layout.gapYmm * MM;
  const usedWidth = columns * width + (columns - 1) * gapX;
  const usedHeight = rows * height + (rows - 1) * gapY;
  const marginX = (PAGE_WIDTH - usedWidth) / 2;
  const marginY = (PAGE_HEIGHT - usedHeight) / 2;

  return {
    x: marginX + col * (width + gapX),
    y: PAGE_HEIGHT - marginY - (row + 1) * height - row * gapY,
    width,
    height,
  };
}

async function embedArtwork(pdf: PDFDocument, bytes: Buffer, label: "front" | "back"): Promise<ArtworkInfo> {
  if (bytes.length > 15 * 1024 * 1024) {
    throw new PaperPdfError("Ticket artwork is too large.", "PDF_ARTWORK_TOO_LARGE", 400);
  }

  const source = sharp(bytes, {
    limitInputPixels: 50_000_000,
    failOn: "error",
  }).rotate();

  const metadata = await source.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format || "") || (metadata.pages || 1) !== 1) {
    throw new PaperPdfError(
      "Artwork must be a single PNG, JPEG or WebP image.",
      "INVALID_PDF_ARTWORK",
      400,
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new PaperPdfError("The artwork dimensions could not be read.", "INVALID_PDF_ARTWORK", 400);
  }

  const ratio = metadata.width / metadata.height;
  if (ratio < 1.85 || ratio > 2.15) {
    throw new PaperPdfError(
      `${label === "front" ? "Front" : "Back"} artwork should be close to a 2:1 landscape ticket. Upload the full ticket artwork rather than a cropped image.`,
      "PDF_ARTWORK_RATIO_INVALID",
      400,
    );
  }

  // Keep enough resolution for A4 printing but avoid unnecessarily huge PDFs.
  const png = await source
    .resize({
      width: 2200,
      height: 1100,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    image: await pdf.embedPng(png),
    width: metadata.width,
    height: metadata.height,
  };
}

/** Fill the ticket with the artwork. Because the Burton Pride art is 2:1 and
 * the physical ticket layout is also 2:1, there is no letterboxing. */
function drawFullArtwork(page: PDFPage, artwork: ArtworkInfo, ticket: Rect) {
  page.drawImage(artwork.image, {
    x: ticket.x,
    y: ticket.y,
    width: ticket.width,
    height: ticket.height,
  });
}

function formatDrawParts(drawAt: string, timezone: string) {
  const value = new Date(drawAt);
  return {
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: timezone,
    }).format(value),
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(value),
    full: new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(value),
  };
}

/**
 * Coordinates below match the Burton Pride Community Lottery artwork created
 * for this system. The white patches cover [TO CONFIRM] placeholders before
 * printing dynamic values.
 */
function drawFrontDynamicFields(
  page: PDFPage,
  font: PDFFont,
  ticket: Rect,
  ticketNumber: string,
  price: string,
  drawDate: string,
) {
  const prize = relativeRect(ticket, 0.365, 0.695, 0.145, 0.075);
  const priceRect = relativeRect(ticket, 0.575, 0.695, 0.145, 0.075);
  const drawRect = relativeRect(ticket, 0.785, 0.695, 0.16, 0.075);
  const numberRect = relativeRect(ticket, 0.875, 0.083, 0.092, 0.055);

  // Cover only the changing text, not the box titles or artwork.
  paintPatch(page, prize, 0.9);
  paintPatch(page, priceRect, 0.9);
  paintPatch(page, drawRect, 0.9);
  paintPatch(page, numberRect, 0.98);

  drawCentredText(page, font, "See lottery page", prize, 7.4, 4.8);
  drawCentredText(page, font, price, priceRect, 9, 5);
  drawCentredText(page, font, drawDate, drawRect, 8, 4.8);
  drawCentredText(page, font, ticketNumber, numberRect, 8, 4.5);
}

function drawBackDynamicFields(
  page: PDFPage,
  font: PDFFont,
  ticket: Rect,
  input: {
    drawDate: string;
    drawTime: string;
    price: string;
    minimumAge: number;
    promoter: string;
    registration: string;
    authority: string;
  },
) {
  const leftX = 0.25;
  const leftW = 0.205;
  const rightX = 0.745;
  const rightW = 0.19;
  const rowH = 0.045;

  // PDF y coordinates are measured from the bottom. These correspond to the
  // five value rows in each white information panel on the back artwork.
  const leftRows = [0.437, 0.387, 0.337, 0.287, 0.237];
  const rightRows = [0.437, 0.387, 0.337, 0.287, 0.237];

  const leftValues = [
    input.drawDate,
    input.drawTime,
    "See lottery page",
    input.price,
    "See lottery page",
  ];
  const rightValues = [
    input.promoter,
    "www.burtonpride.co.uk",
    `${input.minimumAge}+`,
    "See lottery terms",
    `${input.registration} · ${input.authority}`,
  ];

  leftRows.forEach((y, index) => {
    const rect = relativeRect(ticket, leftX, y, leftW, rowH);
    paintPatch(page, rect, 0.96);
    drawLeftText(page, font, leftValues[index], rect, 6.8, 4.2);
  });

  rightRows.forEach((y, index) => {
    const rect = relativeRect(ticket, rightX, y, rightW, rowH);
    paintPatch(page, rect, 0.96);
    drawLeftText(page, font, rightValues[index], rect, 6.5, 3.7);
  });

  const termsRect = relativeRect(ticket, 0.56, 0.145, 0.235, 0.047);
  paintPatch(page, termsRect, 0.96);
  drawLeftText(page, font, "www.burtonpride.co.uk", termsRect, 6.5, 4.2);
}

async function drawSecurityCodes(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  ticketRect: Rect,
  ticket: PaperPdfTicket,
  includeCode128: boolean,
) {
  // The security area lives on top of the back artwork. It deliberately has a
  // solid white quiet zone so the codes remain scannable when printed.
  const qrRect = relativeRect(ticketRect, 0.822, 0.018, 0.155, 0.31);
  const barcodeRect = relativeRect(ticketRect, 0.055, 0.028, 0.73, 0.16);
  const labelRect = relativeRect(ticketRect, 0.055, 0.195, 0.73, 0.052);

  paintPatch(page, {
    x: qrRect.x - 1.7 * MM,
    y: qrRect.y - 1.7 * MM,
    width: qrRect.width + 3.4 * MM,
    height: qrRect.height + 3.4 * MM,
  }, 1);

  const qrPng = await bwipjs.toBuffer({
    bcid: "qrcode",
    text: ticket.barcode_value,
    scale: 6,
    eclevel: "M",
    padding: 6,
  });
  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, qrRect);

  if (includeCode128) {
    paintPatch(page, {
      x: barcodeRect.x - 1.5 * MM,
      y: barcodeRect.y - 1.3 * MM,
      width: barcodeRect.width + 3 * MM,
      height: barcodeRect.height + 3.4 * MM,
    }, 1);

    const barcodePng = await bwipjs.toBuffer({
      bcid: "code128",
      text: ticket.barcode_token,
      scale: 4,
      height: 10,
      includetext: false,
      paddingwidth: 8,
      paddingheight: 2,
    });
    const code = await pdf.embedPng(barcodePng);
    page.drawImage(code, barcodeRect);

    paintPatch(page, labelRect, 0.98);
    drawLeftText(page, font, `Ticket ${ticket.ticket_number}`, labelRect, 6.5, 4.2);
  }
}

function validateTickets(tickets: PaperPdfTicket[]) {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  const tokens = new Set<string>();

  for (const ticket of tickets) {
    if (
      ids.has(ticket.id) ||
      numbers.has(ticket.ticket_number) ||
      tokens.has(ticket.barcode_token) ||
      !/^[A-Za-z0-9_-]{43}$/.test(ticket.barcode_token) ||
      createHash("sha256").update(ticket.barcode_token).digest("hex") !== ticket.barcode_token_hash
    ) {
      throw new PaperPdfError(
        "A ticket has missing, duplicate or inconsistent barcode data.",
        "INVALID_PDF_TICKET_DATA",
      );
    }

    let url: URL;
    try {
      url = new URL(ticket.barcode_value);
    } catch {
      throw new PaperPdfError(
        "A stored verification URL is invalid.",
        "INVALID_PDF_BARCODE_URL",
      );
    }

    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.pathname !== `/Lottery/Ticket/${ticket.barcode_token}` ||
      url.search ||
      url.hash
    ) {
      throw new PaperPdfError(
        "A verification URL does not match its ticket token.",
        "INVALID_PDF_BARCODE_URL",
      );
    }

    ids.add(ticket.id);
    numbers.add(ticket.ticket_number);
    tokens.add(ticket.barcode_token);
  }
}

export async function buildPaperTicketPdf(input: {
  batch: PaperBatch;
  lottery: PaperLottery;
  tickets: PaperPdfTicket[];
  frontArtwork: Buffer;
  backArtwork: Buffer | null;
}) {
  const { batch, lottery } = input;

  if (
    batch.page_size !== "A4" ||
    ![2, 4, 6].includes(batch.tickets_per_sheet) ||
    !["qr", "qr_and_code128"].includes(batch.code_format) ||
    !["long_edge", "short_edge"].includes(batch.duplex_flip)
  ) {
    throw new PaperPdfError("Unsupported print layout.", "INVALID_PDF_LAYOUT", 400);
  }

  if (
    batch.quantity < 1 ||
    batch.quantity > 5000 ||
    input.tickets.length !== batch.quantity
  ) {
    throw new PaperPdfError(
      "The batch quantity does not match its stored tickets.",
      "PDF_TICKET_COUNT_MISMATCH",
    );
  }

  if (!input.backArtwork) {
    throw new PaperPdfError(
      "Upload back artwork before generating a print-ready paper ticket batch. The QR code and barcode are placed on the back design.",
      "PDF_BACK_ARTWORK_REQUIRED",
      400,
    );
  }

  const tickets = [...input.tickets].sort((a, b) =>
    a.ticket_number < b.ticket_number
      ? -1
      : a.ticket_number > b.ticket_number
        ? 1
        : a.id < b.id
          ? -1
          : 1,
  );

  validateTickets(tickets);

  if (!lottery.draw_at || !Number.isFinite(Date.parse(lottery.draw_at))) {
    throw new PaperPdfError(
      "Set the lottery draw date before generating its PDF.",
      "PDF_DRAW_DATE_REQUIRED",
      400,
    );
  }

  const timezone = lottery.timezone || "Europe/London";
  const draw = formatDrawParts(lottery.draw_at, timezone);
  const pence = lottery.ticket_price_pence ?? Math.round(Number(lottery.ticket_price) * 100);

  if (
    !Number.isSafeInteger(pence) ||
    pence < 0 ||
    lottery.currency !== "GBP" ||
    lottery.minimum_age < 18
  ) {
    throw new PaperPdfError(
      "Check the lottery price, GBP currency and minimum age.",
      "INVALID_PDF_LOTTERY_DETAILS",
      400,
    );
  }

  const price = `£${(pence / 100).toFixed(2)}`;
  const society = lottery.promoting_society_legal_name || "Burton Pride C.I.C.";
  const registration = lottery.registration_licence_number || "SL0507";
  const authority = lottery.licensing_authority || "East Staffordshire Borough Council";
  const promoter = lottery.responsible_promoter_name || society;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = await readFile(
    process.env.PAPER_TICKET_PDF_FONT_PATH ||
      join(process.cwd(), "lib/lottery/fonts/DejaVuSans.ttf"),
  );
  const font = await pdf.embedFont(fontBytes, { subset: true });

  pdf.setTitle(`${lottery.title} - ${batch.batch_reference}`);
  pdf.setAuthor(society);
  pdf.setSubject("Burton Pride paper lottery tickets");
  pdf.setKeywords(["Burton Pride", "lottery", registration, batch.batch_reference]);

  const preferences = pdf.catalog.getOrCreateViewerPreferences();
  preferences.setPrintScaling(PrintScaling.None);
  preferences.setDuplex(
    batch.duplex_flip === "long_edge"
      ? Duplex.DuplexFlipLongEdge
      : Duplex.DuplexFlipShortEdge,
  );

  const frontArt = await embedArtwork(pdf, input.frontArtwork, "front");
  const backArt = await embedArtwork(pdf, input.backArtwork, "back");
  const sheetCount = Math.ceil(tickets.length / batch.tickets_per_sheet);

  for (let sheet = 0; sheet < sheetCount; sheet++) {
    const frontPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const backPage = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    for (let slot = 0; slot < batch.tickets_per_sheet; slot++) {
      const ticket = tickets[sheet * batch.tickets_per_sheet + slot];
      if (!ticket) continue;

      const frontRect = paperTicketPosition(
        slot,
        batch.tickets_per_sheet,
        false,
        batch.duplex_flip,
      );
      const backRect = paperTicketPosition(
        slot,
        batch.tickets_per_sheet,
        true,
        batch.duplex_flip,
      );

      // FULL FRONT ARTWORK — no thumbnail, no extra ticket box beneath it.
      drawFullArtwork(frontPage, frontArt, frontRect);
      drawFrontDynamicFields(
        frontPage,
        font,
        frontRect,
        ticket.ticket_number,
        price,
        draw.date,
      );

      // FULL BACK ARTWORK — codes are stamped directly onto this design.
      drawFullArtwork(backPage, backArt, backRect);
      drawBackDynamicFields(backPage, font, backRect, {
        drawDate: draw.date,
        drawTime: draw.time,
        price,
        minimumAge: lottery.minimum_age,
        promoter,
        registration,
        authority,
      });

      await drawSecurityCodes(
        pdf,
        backPage,
        font,
        backRect,
        ticket,
        batch.code_format === "qr_and_code128",
      );
    }
  }

  const bytes = Buffer.from(await pdf.save());
  if (bytes.length > PDF_LIMIT_BYTES) {
    throw new PaperPdfError(
      "The PDF exceeds 50 MB. Use a smaller batch or simpler artwork.",
      "PDF_FILE_TOO_LARGE",
      400,
    );
  }

  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    pageCount: pdf.getPageCount(),
    manifest: tickets.map(({ id, ticket_number }) => ({ id, ticket_number })),
    snapshot: {
      renderer_version: 2,
      layout_mode: "full_artwork_overlay",
      title: lottery.title,
      draw_at: lottery.draw_at,
      timezone,
      price_pence: pence,
      minimum_age: lottery.minimum_age,
      society,
      registration,
      authority,
      orientation: "landscape",
      page_size: "A4",
      tickets_per_sheet: batch.tickets_per_sheet,
      duplex_flip: batch.duplex_flip,
      code_format: batch.code_format,
      responsible_promoter_name: lottery.responsible_promoter_name,
      responsible_promoter_address: lottery.responsible_promoter_address,
      required_ticket_wording: lottery.required_ticket_wording,
      full_artwork: true,
      qr_on_back_artwork: true,
      barcode_on_back_artwork: batch.code_format === "qr_and_code128",
    },
  };
}
