import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  randomInt,
} from "node:crypto";

import {
  isIP,
} from "node:net";

import Stripe from "stripe";
import { Resend } from "resend";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

import {
  issueTicketsForPaidOrder,
} from "@/lib/lottery/secureTicketIssuance";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

const stripe =
  new Stripe(
    process.env.STRIPE_SECRET_KEY!,
  );

const resend =
  new Resend(
    process.env.RESEND_API_KEY,
  );

function response(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function createOrderReference() {
  return `LOT-${new Date()
    .getFullYear()}-${crypto
    .randomUUID()
    .replaceAll(
      "-",
      "",
    )
    .slice(
      0,
      10,
    )
    .toUpperCase()}`;
}

function getClientIp(
  request: NextRequest,
) {
  const forwardedFor =
    request.headers
      .get(
        "x-forwarded-for",
      )
      ?.split(",")[0]
      ?.trim();

  const candidate =
    forwardedFor ||
    request.headers
      .get(
        "x-real-ip",
      )
      ?.trim() ||
    null;

  if (
    !candidate ||
    isIP(candidate) ===
      0
  ) {
    return null;
  }

  return candidate;
}

async function recordLotteryAcceptances({
  request,
  lotteryId,
  orderId,
  minimumAge,
  geographicEligibility,
  termsVersion,
  privacyNoticeVersion,
  ageConfirmed,
  eligibilityConfirmed,
  termsAccepted,
  marketingOptIn,
}: {
  request: NextRequest;
  lotteryId: string;
  orderId: string;
  minimumAge: number;
  geographicEligibility:
    | string
    | null;
  termsVersion:
    | string
    | null;
  privacyNoticeVersion:
    | string
    | null;
  ageConfirmed: boolean;
  eligibilityConfirmed: boolean;
  termsAccepted: boolean;
  marketingOptIn: boolean;
}) {
  const acceptedAt =
    new Date()
      .toISOString();

  const ipAddress =
    getClientIp(
      request,
    );

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_acceptances",
      )
      .insert([
        {
          lottery_id:
            lotteryId,

          order_id:
            orderId,

          acceptance_type:
            "age_confirmation",

          version:
            `minimum-age:${minimumAge}`,

          accepted:
            ageConfirmed,

          accepted_at:
            acceptedAt,

          ip_address:
            ipAddress,
        },

        {
          lottery_id:
            lotteryId,

          order_id:
            orderId,

          acceptance_type:
            "eligibility_confirmation",

          version:
            geographicEligibility,

          accepted:
            eligibilityConfirmed,

          accepted_at:
            acceptedAt,

          ip_address:
            ipAddress,
        },

        {
          lottery_id:
            lotteryId,

          order_id:
            orderId,

          acceptance_type:
            "terms_acceptance",

          version:
            termsVersion,

          accepted:
            termsAccepted,

          accepted_at:
            acceptedAt,

          ip_address:
            ipAddress,
        },

        {
          lottery_id:
            lotteryId,

          order_id:
            orderId,

          acceptance_type:
            "marketing_opt_in",

          version:
            privacyNoticeVersion,

          accepted:
            marketingOptIn,

          accepted_at:
            acceptedAt,

          ip_address:
            ipAddress,
        },
      ]);

  if (error) {
    console.error(
      "Lottery acceptance creation failed:",
      {
        code:
          error.code,

        message:
          error.message,

        details:
          error.details,

        hint:
          error.hint,

        lotteryId,

        orderId,
      },
    );

    throw new Error(
      "Unable to save the lottery confirmations.",
    );
  }
}


const LOTTERY_FROM_EMAIL =
  "Burton Pride Lotteries <Lotteries@burtonpride.co.uk>";

const LOTTERY_INFO_EMAIL =
  "info@burtonpride.co.uk";

type PaidOrder = {
  id: string;
  lottery_id: string;
  order_reference: string;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string | null;
  quantity: number;
  total_amount: number;
  currency: string;
  payment_status: string;
  payment_reference: string | null;
};

type LotteryForEmail = {
  id: string;
  title: string;
  slug: string;
  draw_at: string | null;
  max_tickets: number | null;
};

type TicketForEmail = {
  id: string;
  ticket_number: string;
  status: string;
  issued_at: string | null;
};

function escapeHtml(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

function formatMoney(
  value: number,
  currency = "GBP",
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency:
        currency || "GBP",
    },
  ).format(
    Number(
      value || 0,
    ),
  );
}

function formatDateTime(
  value:
    | string
    | null,
) {
  if (!value) {
    return "To be confirmed";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-GB",
    {
      weekday:
        "long",
      day:
        "numeric",
      month:
        "long",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
      timeZone:
        "Europe/London",
    },
  );
}


function parseNumericTicketNumber(
  value: unknown,
) {
  const text =
    String(
      value ?? "",
    ).trim();

  if (
    !/^[0-9]+$/.test(
      text,
    )
  ) {
    return null;
  }

  const number =
    Number(
      text,
    );

  return (
    Number.isSafeInteger(
      number,
    ) &&
    number >= 1
  )
    ? number
    : null;
}

function formatRandomTicketNumber(
  ticketNumber: number,
  maxTickets: number,
) {
  // A fixed width makes a ticket a proper reference such as 004218,
  // rather than displaying as "1", "2", "3". The underlying number is
  // still allocated with crypto.randomInt below, not in issue order.
  const width =
    Math.max(
      4,
      String(
        maxTickets,
      ).length,
    );

  return String(
    ticketNumber,
  ).padStart(
    width,
    "0",
  );
}

async function getUsedNumericTicketNumbers(
  lotteryId: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_tickets",
      )
      .select(
        "ticket_number",
      )
      .eq(
        "lottery_id",
        lotteryId,
      );

  if (
    error
  ) {
    throw new Error(
      `Unable to load used lottery numbers: ${error.message}`,
    );
  }

  const used =
    new Set<number>();

  for (
    const row of
    data || []
  ) {
    const number =
      parseNumericTicketNumber(
        row.ticket_number,
      );

    if (
      number !==
      null
    ) {
      used.add(
        number,
      );
    }
  }

  return used;
}

function getRandomUnusedTicketNumber(
  used: Set<number>,
  maxTickets: number,
) {
  const usedNumbers =
    Array.from(
      used,
    )
      .filter(
        (
          number,
        ) =>
          Number.isInteger(
            number,
          ) &&
          number >= 1 &&
          number <= maxTickets,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first - second,
      );

  const availableCount =
    maxTickets -
    usedNumbers.length;

  if (
    availableCount < 1
  ) {
    return null;
  }

  // Choose a random zero-based position from all currently unused
  // numbers, then map it through the gaps between issued numbers.
  // This is uniform, cryptographically random and does not scan up to
  // maxTickets (which can be as large as 2,147,483,647).
  let availableIndex =
    randomInt(
      availableCount,
    );

  let previousUsedNumber =
    0;

  for (
    const usedNumber of
    usedNumbers
  ) {
    const gapSize =
      usedNumber -
      previousUsedNumber -
      1;

    if (
      availableIndex < gapSize
    ) {
      return (
        previousUsedNumber +
        availableIndex +
        1
      );
    }

    availableIndex -=
      gapSize;

    previousUsedNumber =
      usedNumber;
  }

  return (
    previousUsedNumber +
    availableIndex +
    1
  );
}

function shuffleTicketsForDisplay(
  tickets: TicketForEmail[],
) {
  const shuffled =
    [
      ...tickets,
    ];

  for (
    let index =
      shuffled.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      randomInt(
        index + 1,
      );

    [
      shuffled[index],
      shuffled[swapIndex],
    ] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  // Never present a multi-ticket result in ascending numeric order.
  const isAscending =
    shuffled.length > 1 &&
    shuffled.every(
      (
        ticket,
        index,
      ) => {
        if (
          index === 0
        ) {
          return true;
        }

        const previousNumber =
          parseNumericTicketNumber(
            shuffled[
              index - 1
            ].ticket_number,
          );

        const currentNumber =
          parseNumericTicketNumber(
            ticket.ticket_number,
          );

        return (
          previousNumber !==
            null &&
          currentNumber !==
            null &&
          previousNumber <
            currentNumber
        );
      },
    );

  if (
    isAscending
  ) {
    [
      shuffled[0],
      shuffled[1],
    ] = [
      shuffled[1],
      shuffled[0],
    ];
  }

  return shuffled;
}


async function sendLotteryEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}) {
  const apiKey =
    process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured.",
    );
  }

  const {
    data,
    error,
  } =
    await resend.emails.send(
      {
        from:
          LOTTERY_FROM_EMAIL,

        to: [
          to,
        ],

        subject,

        html,

        text,

        replyTo:
          LOTTERY_INFO_EMAIL,
      },
      {
        idempotencyKey,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        "Resend rejected the lottery email.",
    );
  }

  return data;
}

function createEmailIdempotencyKey(
  orderId: string,
  notificationType: string,
) {
  return `lottery-${notificationType}-${orderId}`;
}

function createNotificationId(
  orderId: string,
  notificationType: string,
  recipient: string,
) {
  const hash =
    createHash(
      "sha256",
    )
      .update(
        `${orderId}|${notificationType}|${recipient.toLowerCase()}`,
      )
      .digest(
        "hex",
      )
      .slice(
        0,
        32,
      )
      .split("");
  hash[12] =
    "5";

  hash[16] =
    (
      (
        Number.parseInt(
          hash[16],
          16,
        ) &
        0x3
      ) |
      0x8
    ).toString(16);

  const value =
    hash.join("");

  return [
    value.slice(
      0,
      8,
    ),
    value.slice(
      8,
      12,
    ),
    value.slice(
      12,
      16,
    ),
    value.slice(
      16,
      20,
    ),
    value.slice(
      20,
      32,
    ),
  ].join("-");
}

async function notificationAlreadySent(
  orderId: string,
  notificationType: string,
  recipient: string,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_notifications",
      )
      .select(
        "id,status",
      )
      .eq(
        "order_id",
        orderId,
      )
      .eq(
        "notification_type",
        notificationType,
      )
      .eq(
        "recipient",
        recipient,
      )
      .eq(
        "status",
        "sent",
      )
      .limit(1);

  if (error) {
    console.error(
      "Lottery notification history lookup failed:",
      error,
    );

    return false;
  }

  return Boolean(
    data?.length,
  );
}

async function recordLotteryNotification({
  lotteryId,
  orderId,
  notificationType,
  recipient,
  status,
  providerMessageId = null,
  errorMessage = null,
}: {
  lotteryId: string;
  orderId: string;
  notificationType: string;
  recipient: string;
  status:
    | "sent"
    | "failed";
  providerMessageId?:
    | string
    | null;
  errorMessage?:
    | string
    | null;
}) {
  const now =
    new Date()
      .toISOString();

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "lottery_notifications",
      )
      .upsert({
        id:
          createNotificationId(
            orderId,
            notificationType,
            recipient,
          ),

        lottery_id:
          lotteryId,

        order_id:
          orderId,

        notification_type:
          notificationType,

        recipient,

        status,

        provider_message_id:
          providerMessageId,

        sent_at:
          status === "sent"
            ? now
            : null,

        failed_at:
          status === "failed"
            ? now
            : null,

        error_message:
          errorMessage,
      }, {
        onConflict:
          "id",
      });

  if (error) {
    console.error(
      "Lottery notification history upsert failed:",
      error,
    );
  }
}

async function issueLotteryTickets(
  order: PaidOrder,
  lottery: LotteryForEmail,
) {
  const {
    data:
      existingTickets,
    error:
      existingTicketsError,
  } =
    await supabaseAdmin
      .from(
        "lottery_tickets",
      )
      .select(
        "id,ticket_number,status,issued_at",
      )
      .eq(
        "order_id",
        order.id,
      )
      .order(
        "issued_at",
        {
          ascending:
            true,
        },
      );

  if (
    existingTicketsError
  ) {
    throw new Error(
      `Unable to load existing tickets: ${existingTicketsError.message}`,
    );
  }

  const tickets: TicketForEmail[] =
    [
      ...(
        existingTickets ??
        []
      ),
    ];

  const maxTickets =
    Math.floor(
      Number(
        lottery.max_tickets ||
        0,
      ),
    );

  if (
    !Number.isFinite(
      maxTickets,
    ) ||
    maxTickets < 1
  ) {
    throw new Error(
      "This lottery does not have a valid maximum ticket number.",
    );
  }

  const missing =
    Math.max(
      0,
      Number(
        order.quantity ||
        0,
      ) -
        tickets.length,
    );

  if (
    missing ===
    0
  ) {
    return tickets;
  }

  const used =
    await getUsedNumericTicketNumbers(
      order.lottery_id,
    );

  for (
    let index = 0;
    index < missing;
    index += 1
  ) {
    let created:
      | TicketForEmail
      | null =
      null;
    for (
      let attempt = 0;
      attempt < maxTickets;
      attempt += 1
    ) {
      const nextNumber =
        getRandomUnusedTicketNumber(
          used,
          maxTickets,
        );

      if (
        nextNumber ===
        null
      ) {
        throw new Error(
          "No lottery numbers are available. This lottery is sold out.",
        );
      }

      const ticketNumber =
        formatRandomTicketNumber(
          nextNumber,
          maxTickets,
        );

      const {
        data:
          insertedTicket,
        error:
          insertError,
      } =
        await supabaseAdmin
          .from(
            "lottery_tickets",
          )
          .insert({
            lottery_id:
              order.lottery_id,

            order_id:
              order.id,

            ticket_number:
              ticketNumber,

            status:
              "issued",

            issued_at:
              new Date()
                .toISOString(),
          })
          .select(
            "id,ticket_number,status,issued_at",
          )
          .single();

      if (
        !insertError &&
        insertedTicket
      ) {
        created =
          insertedTicket as TicketForEmail;

        used.add(
          nextNumber,
        );

        break;
      }

      if (
        insertError?.code ===
        "23505"
      ) {
        used.add(
          nextNumber,
        );

        continue;
      }

      throw new Error(
        `Unable to issue lottery ticket: ${
          insertError?.message ||
          "Unknown database error"
        }`,
      );
    }

    if (
      !created
    ) {
      throw new Error(
        "Unable to allocate an available numeric lottery number.",
      );
    }

    tickets.push(
      created,
    );
  }

  return tickets;
}

function ticketNumbersHtml(
  tickets: TicketForEmail[],
) {
  return tickets
    .map(
      (
        ticket,
      ) =>
        `<div style="margin:8px 0;padding:12px 14px;border-radius:10px;background:#f3e8ff;color:#581c87;font-size:18px;font-weight:800;letter-spacing:.04em;">${escapeHtml(
          ticket.ticket_number,
        )}</div>`,
    )
    .join("");
}

function ticketNumbersText(
  tickets: TicketForEmail[],
) {
  return tickets
    .map(
      (
        ticket,
      ) =>
        `- ${ticket.ticket_number}`,
    )
    .join("\n");
}

function getCompleteOrderTickets(
  order: PaidOrder,
  tickets: TicketForEmail[],
) {
  const uniqueTickets =
    Array.from(
      new Map(
        tickets.map(
          (
            ticket,
          ) => [
            ticket.id,
            ticket,
          ],
        ),
      ).values(),
    );

  const expectedQuantity =
    Number(
      order.quantity,
    );

  if (
    !Number.isInteger(
      expectedQuantity,
    ) ||
    expectedQuantity < 1 ||
    uniqueTickets.length !==
      expectedQuantity
  ) {
    throw new Error(
      `The customer email was not sent because the order requires ${expectedQuantity} ticket(s), but ${uniqueTickets.length} complete ticket record(s) were loaded.`,
    );
  }

  return shuffleTicketsForDisplay(
    uniqueTickets,
  );
}

function customerEmailHtml({
  order,
  lottery,
  tickets,
}: {
  order: PaidOrder;
  lottery: LotteryForEmail;
  tickets: TicketForEmail[];
}) {
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="max-width:640px;margin:0 auto;padding:30px 18px;">
      <div style="overflow:hidden;border-radius:22px;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="padding:30px;background:linear-gradient(135deg,#ec4899,#7c3aed,#2563eb);color:#ffffff;text-align:center;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fde68a;">Burton Pride Lottery</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;">You have been entered into the lottery</h1>
        </div>

        <div style="padding:30px;">
          <p style="margin-top:0;font-size:17px;line-height:1.7;">
            Hello <strong>${escapeHtml(
              order.purchaser_name,
            )}</strong>,
          </p>

          <p style="font-size:16px;line-height:1.7;">
            Thank you for supporting Burton Pride. Your payment has been confirmed and your entry into
            <strong>${escapeHtml(
              lottery.title,
            )}</strong> is complete.
          </p>

          <h2 style="margin:28px 0 10px;font-size:20px;">Your lottery number${tickets.length === 1 ? "" : "s"}</h2>

          ${ticketNumbersHtml(
            tickets,
          )}

          <div style="margin-top:28px;padding:18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;"><strong>Order reference:</strong> ${escapeHtml(
              order.order_reference,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Lottery:</strong> ${escapeHtml(
              lottery.title,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Tickets:</strong> ${escapeHtml(
              order.quantity,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Amount paid:</strong> ${escapeHtml(
              formatMoney(
                order.total_amount,
                order.currency,
              ),
            )}</p>
            <p style="margin:0;"><strong>Draw:</strong> ${escapeHtml(
              formatDateTime(
                lottery.draw_at,
              ),
            )}</p>
          </div>

          <p style="margin:26px 0 0;font-size:15px;line-height:1.7;color:#475569;">
            Please keep this email safe until the draw has taken place. If you purchased more than one
            ticket, every number shown above is one separate entry.
          </p>

          <p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#475569;">
            Good luck, and thank you for supporting Burton Pride.
          </p>
        </div>
      </div>

      <p style="margin:18px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
        This is an automated lottery confirmation from Burton Pride.
      </p>

      <div style="margin:14px 0 0;padding:18px;border-radius:14px;background:#ffffff;border:1px solid #e2e8f0;color:#475569;font-size:12px;line-height:1.65;">
        <p style="margin:0 0 10px;font-weight:700;color:#172033;">
          This is an official Burton Pride lottery.
        </p>
        <p style="margin:0 0 10px;">
          The promoter of Burton Pride lotteries is <strong>Burton Pride C.I.C.</strong>
        </p>
        <p style="margin:0 0 10px;">
          Burton Pride C.I.C. is a grassroots, community-led Community Interest Company created to support the LGBTQIA+ community and allies in Burton upon Trent and the surrounding area.
        </p>
        <p style="margin:0 0 10px;">
          Where a lottery is operated under Burton Pride C.I.C.'s small society lottery registration, the relevant registration information will be displayed on the individual lottery page or within its Individual Lottery Terms.
        </p>
        <p style="margin:0 0 10px;">
          Where another permission, licence, exemption or lottery category applies, this will also be identified where required.
        </p>
        <p style="margin:0;">
          Burton Pride C.I.C.'s small society lottery registration number is <strong>SL0507</strong>, issued by East Staffordshire Borough Council.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

function customerEmailText({
  order,
  lottery,
  tickets,
}: {
  order: PaidOrder;
  lottery: LotteryForEmail;
  tickets: TicketForEmail[];
}) {
  return `BURTON PRIDE LOTTERY

Hello ${order.purchaser_name},

You have been entered into the lottery.

Thank you for supporting Burton Pride. Your payment has been confirmed and your entry into ${lottery.title} is complete.

Your lottery number${tickets.length === 1 ? "" : "s"}:
${ticketNumbersText(
  tickets,
)}

Order reference: ${order.order_reference}
Lottery: ${lottery.title}
Tickets: ${order.quantity}
Amount paid: ${formatMoney(
    order.total_amount,
    order.currency,
  )}
Draw: ${formatDateTime(
    lottery.draw_at,
  )}

Please keep this email safe until the draw has taken place.

Good luck,
Burton Pride

This is an official Burton Pride lottery.

The promoter of Burton Pride lotteries is Burton Pride C.I.C.

Burton Pride C.I.C. is a grassroots, community-led Community Interest Company created to support the LGBTQIA+ community and allies in Burton upon Trent and the surrounding area.

Where a lottery is operated under Burton Pride C.I.C.'s small society lottery registration, the relevant registration information will be displayed on the individual lottery page or within its Individual Lottery Terms.

Where another permission, licence, exemption or lottery category applies, this will also be identified where required.

Burton Pride C.I.C.'s small society lottery registration number is SL0507, issued by East Staffordshire Borough Council.`;
}

function internalEmailHtml({
  order,
  lottery,
  tickets,
}: {
  order: PaidOrder;
  lottery: LotteryForEmail;
  tickets: TicketForEmail[];
}) {
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="max-width:680px;margin:0 auto;padding:30px 18px;">
      <div style="overflow:hidden;border-radius:22px;background:#ffffff;border:1px solid #e2e8f0;">
        <div style="padding:26px 30px;background:#1e1b4b;color:#ffffff;">
          <div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fde68a;">Lottery Entry Notification</div>
          <h1 style="margin:9px 0 0;font-size:28px;">A paid lottery entry has been received</h1>
        </div>

        <div style="padding:30px;">
          <p style="margin-top:0;font-size:16px;line-height:1.7;">
            A customer has successfully paid and has been issued their lottery number${tickets.length === 1 ? "" : "s"}.
          </p>

          <div style="margin-top:22px;padding:18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(
              order.purchaser_name,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(
              order.purchaser_email,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(
              order.purchaser_phone ||
                "Not provided",
            )}</p>
            <p style="margin:0 0 8px;"><strong>Lottery:</strong> ${escapeHtml(
              lottery.title,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Order reference:</strong> ${escapeHtml(
              order.order_reference,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Tickets purchased:</strong> ${escapeHtml(
              order.quantity,
            )}</p>
            <p style="margin:0 0 8px;"><strong>Amount paid:</strong> ${escapeHtml(
              formatMoney(
                order.total_amount,
                order.currency,
              ),
            )}</p>
            <p style="margin:0;"><strong>Draw:</strong> ${escapeHtml(
              formatDateTime(
                lottery.draw_at,
              ),
            )}</p>
          </div>

          <h2 style="margin:28px 0 10px;font-size:20px;">Issued lottery number${tickets.length === 1 ? "" : "s"}</h2>

          ${ticketNumbersHtml(
            tickets,
          )}
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function internalEmailText({
  order,
  lottery,
  tickets,
}: {
  order: PaidOrder;
  lottery: LotteryForEmail;
  tickets: TicketForEmail[];
}) {
  return `BURTON PRIDE LOTTERY ENTRY NOTIFICATION

A paid lottery entry has been received.

Name: ${order.purchaser_name}
Email: ${order.purchaser_email}
Phone: ${order.purchaser_phone || "Not provided"}
Lottery: ${lottery.title}
Order reference: ${order.order_reference}
Tickets purchased: ${order.quantity}
Amount paid: ${formatMoney(
    order.total_amount,
    order.currency,
  )}
Draw: ${formatDateTime(
    lottery.draw_at,
  )}

Issued lottery number${tickets.length === 1 ? "" : "s"}:
${ticketNumbersText(
    tickets,
  )}`;
}

async function sendPaidEntryEmails({
  order,
  lottery,
  tickets,
}: {
  order: PaidOrder;
  lottery: LotteryForEmail;
  tickets: TicketForEmail[];
}) {
  const results = {
    customer:
      "skipped",
    internal:
      "skipped",
  } as {
    customer:
      | "sent"
      | "failed"
      | "skipped";
    internal:
      | "sent"
      | "failed"
      | "skipped";
  };
  const orderTickets =
    getCompleteOrderTickets(
      order,
      tickets,
    );

  const customerType =
    "paid_entry_customer_confirmation";

  const customerSent =
    await notificationAlreadySent(
      order.id,
      customerType,
      order.purchaser_email,
    );

  if (!customerSent) {
    try {
      const sentEmail =
        await sendLotteryEmail({
          to:
            order.purchaser_email,

          subject:
            `Your ${lottery.title} lottery number${orderTickets.length === 1 ? "" : "s"}`,

          html:
            customerEmailHtml({
              order,
              lottery,
              tickets:
                orderTickets,
            }),

          text:
            customerEmailText({
              order,
              lottery,
              tickets:
                orderTickets,
            }),

          idempotencyKey:
            createEmailIdempotencyKey(
              order.id,
              customerType,
            ),
        });

      await recordLotteryNotification({
        lotteryId:
          order.lottery_id,

        orderId:
          order.id,

        notificationType:
          customerType,

        recipient:
          order.purchaser_email,

        status:
          "sent",

        providerMessageId:
          sentEmail?.id ??
          null,
      });

      results.customer =
        "sent";
    } catch (
      error
    ) {
      const message =
        error instanceof
        Error
          ? error.message
          : "Unknown email error";

      console.error(
        "Lottery customer confirmation email failed:",
        error,
      );

      await recordLotteryNotification({
        lotteryId:
          order.lottery_id,

        orderId:
          order.id,

        notificationType:
          customerType,

        recipient:
          order.purchaser_email,

        status:
          "failed",

        errorMessage:
          message,
      });

      results.customer =
        "failed";
    }
  }

  const internalType =
    "paid_entry_internal_notification";

  const internalSent =
    await notificationAlreadySent(
      order.id,
      internalType,
      LOTTERY_INFO_EMAIL,
    );

  if (!internalSent) {
    try {
      const sentEmail =
        await sendLotteryEmail({
          to:
            LOTTERY_INFO_EMAIL,

          subject:
            `New lottery entry: ${order.purchaser_name} - ${lottery.title}`,

          html:
            internalEmailHtml({
              order,
              lottery,
              tickets:
                orderTickets,
            }),

          text:
            internalEmailText({
              order,
              lottery,
              tickets:
                orderTickets,
            }),

          idempotencyKey:
            createEmailIdempotencyKey(
              order.id,
              internalType,
            ),
        });

      await recordLotteryNotification({
        lotteryId:
          order.lottery_id,

        orderId:
          order.id,

        notificationType:
          internalType,

        recipient:
          LOTTERY_INFO_EMAIL,

        status:
          "sent",

        providerMessageId:
          sentEmail?.id ??
          null,
      });

      results.internal =
        "sent";
    } catch (
      error
    ) {
      const message =
        error instanceof
        Error
          ? error.message
          : "Unknown email error";

      console.error(
        "Lottery internal entry notification failed:",
        error,
      );

      await recordLotteryNotification({
        lotteryId:
          order.lottery_id,

        orderId:
          order.id,

        notificationType:
          internalType,

        recipient:
          LOTTERY_INFO_EMAIL,

        status:
          "failed",

        errorMessage:
          message,
      });

      results.internal =
        "failed";
    }
  }

  return results;
}

async function completePaidLotteryCheckout(
  session: Stripe.Checkout.Session,
  expectedSlug: string,
) {
  if (
    session.payment_status !==
    "paid"
  ) {
    throw new Error(
      "Stripe has not marked this checkout session as paid.",
    );
  }

  if (
    session.metadata?.type !==
    "burton_pride_lottery"
  ) {
    throw new Error(
      "This Stripe session is not a Burton Pride lottery checkout.",
    );
  }

  if (
    session.metadata?.lottery_slug !==
    expectedSlug
  ) {
    throw new Error(
      "The Stripe session does not belong to this lottery.",
    );
  }

  const orderId =
    String(
      session.metadata
        ?.order_id ||
        "",
    ).trim();

  if (!orderId) {
    throw new Error(
      "The Stripe session does not contain a lottery order ID.",
    );
  }

  const {
    data:
      orderData,
    error:
      orderError,
  } =
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .select(
        `
        id,
        lottery_id,
        order_reference,
        purchaser_name,
        purchaser_email,
        purchaser_phone,
        quantity,
        total_amount,
        currency,
        payment_status,
        payment_reference
        `,
      )
      .eq(
        "id",
        orderId,
      )
      .single();

  if (
    orderError ||
    !orderData
  ) {
    throw new Error(
      `Unable to load lottery order: ${orderError?.message || "Order not found"}`,
    );
  }

  const order =
    orderData as PaidOrder;

  if (
    String(
      order.payment_reference ||
        "",
    ) &&
    order.payment_reference !==
      session.id
  ) {
    throw new Error(
      "The Stripe session does not match the saved lottery payment reference.",
    );
  }

  const {
    data:
      lotteryData,
    error:
      lotteryError,
  } =
    await supabaseAdmin
      .from(
        "lotteries",
      )
      .select(
        "id,title,slug,draw_at,max_tickets",
      )
      .eq(
        "id",
        order.lottery_id,
      )
      .single();

  if (
    lotteryError ||
    !lotteryData
  ) {
    throw new Error(
      `Unable to load lottery details: ${lotteryError?.message || "Lottery not found"}`,
    );
  }

  const lottery =
    lotteryData as LotteryForEmail;

  if (
    lottery.slug !==
    expectedSlug
  ) {
    throw new Error(
      "The order belongs to a different lottery.",
    );
  }

  const expectedAmount =
    Math.round(
      Number(
        order.total_amount ||
          0,
      ) *
        100,
    );

  if (
    typeof session.amount_total ===
      "number" &&
    expectedAmount !==
      session.amount_total
  ) {
    throw new Error(
      "The Stripe payment amount does not match the lottery order total.",
    );
  }

  // The Stripe webhook owns payment reconciliation, ticket issuance and email.
  // This GET route is read-only; revisiting the success page cannot send again.
  const { data: ticketRows, error: ticketError } = await supabaseAdmin
    .from("lottery_tickets")
    .select("id,ticket_number,status,issued_at")
    .eq("order_id", order.id)
    .order("issued_at", { ascending: true });

  if (ticketError) {
    throw new Error(`Unable to load order tickets: ${ticketError.message}`);
  }

  const tickets = (ticketRows ?? []) as TicketForEmail[];
  const customerSent = await notificationAlreadySent(
    order.id,
    "paid_entry_customer_confirmation",
    order.purchaser_email,
  );

  return {
    order,
    lottery,
    tickets,
    emailResults: {
      customer: customerSent ? "sent" : "pending",
    },
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const {
    slug: rawSlug,
  } =
    await context.params;

  const slug =
    decodeURIComponent(
      rawSlug,
    )
      .trim()
      .toLowerCase();

  const origin =
    new URL(
      request.url,
    ).origin;

  const successPage =
    new URL(
      `/Lottery/${encodeURIComponent(
        slug,
      )}/checkout`,
      origin,
    );

  const responseMode =
    request.nextUrl
      .searchParams
      .get(
        "response",
      );

  const wantsJson =
    responseMode ===
    "json";

  try {
    const payment =
      request.nextUrl
        .searchParams
        .get(
          "payment",
        );

    const sessionId =
      request.nextUrl
        .searchParams
        .get(
          "session_id",
        )
        ?.trim();

    if (
      payment !==
        "success" ||
      !sessionId
    ) {
      if (wantsJson) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_CHECKOUT_CONFIRMATION_INVALID",
            error:
              "A valid paid checkout session is required.",
          },
          400,
        );
      }

      successPage.searchParams.set(
        "payment",
        "invalid",
      );

      return NextResponse.redirect(
        successPage,
      );
    }

    const session =
      await stripe
        .checkout
        .sessions
        .retrieve(
          sessionId,
        );

    const completion =
      await completePaidLotteryCheckout(
        session,
        slug,
      );

    const customerEmailStatus =
      completion.emailResults.customer;

    if (wantsJson) {
      return response({
        ok: true,
        payment_status:
          session.payment_status,
        fulfilment_status:
          completion.tickets.length === Number(completion.order.quantity)
            ? "issued"
            : "processing",
        order_reference:
          completion
            .order
            .order_reference,
        ticket_count:
          completion
            .tickets
            .length,
        email_status:
          customerEmailStatus,
      });
    }
    successPage.searchParams.set(
      "payment",
      completion.tickets.length === Number(completion.order.quantity)
        ? "success"
        : "processing",
    );

    successPage.searchParams.set(
      "session_id",
      session.id,
    );

    successPage.searchParams.set(
      "email",
      customerEmailStatus,
    );

    return NextResponse.redirect(
      successPage,
    );
  } catch (
    error
  ) {
    console.error(
      "Lottery paid checkout completion failed:",
      error,
    );

    if (wantsJson) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_CHECKOUT_CONFIRMATION_FAILED",
          error:
            "We could not complete the lottery entry confirmation.",
        },
        409,
      );
    }

    successPage.searchParams.set(
      "payment",
      "confirmation_error",
    );

    return NextResponse.redirect(
      successPage,
    );
  }
}


export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  let orderId:
    | string
    | null =
    null;

  try {
  
    const {
      slug: rawSlug,
    } =
      await context.params;

    const slug =
      decodeURIComponent(
        rawSlug,
      )
        .trim()
        .toLowerCase();

    if (
      !slug ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
        slug,
      )
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_SLUG",

          error:
            "The lottery address is invalid.",
        },
        400,
      );
    }
    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        await request.json();
    } catch {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_JSON",

          error:
            "The checkout request is invalid.",
        },
        400,
      );
    }

    const fullName =
      String(
        body.full_name ??
          "",
      ).trim();

    const email =
      String(
        body.email ??
          "",
      )
        .trim()
        .toLowerCase();

    const phone =
      String(
        body.phone ??
          "",
      ).trim();

    const quantity =
      Number(
        body.quantity ??
          0,
      );

    if (!fullName) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NAME_REQUIRED",

          error:
            "Your full name is required.",
        },
        400,
      );
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_EMAIL_INVALID",

          error:
            "Please enter a valid email address.",
        },
        400,
      );
    }

    if (
      !Number.isInteger(
        quantity,
      ) ||
      quantity < 1 ||
      quantity > 100
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_QUANTITY",

          error:
            "Ticket quantity must be between 1 and 100.",
        },
        400,
      );
    }

    if (
      body.age_confirmed !==
      true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_AGE_NOT_CONFIRMED",

          error:
            "You must confirm that you meet the minimum age requirement.",
        },
        400,
      );
    }

    if (
      body.eligibility_confirmed !==
      true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_ELIGIBILITY_NOT_CONFIRMED",

          error:
            "You must confirm that you meet the lottery eligibility requirements.",
        },
        400,
      );
    }

    if (
      body.terms_accepted !==
      true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_TERMS_NOT_ACCEPTED",

          error:
            "You must accept the lottery terms.",
        },
        400,
      );
    }
    const {
      data: lottery,
      error:
        lotteryError,
    } =
      await supabaseAdmin
        .from(
          "lotteries",
        )
        .select(
          `
          id,
          title,
          slug,
          status,
          ticket_price,
          ticket_price_pence,
          currency,
          minimum_age,
          max_tickets,
          sales_open_at,
          sales_close_at,
          draw_at,
          geographic_eligibility,
          terms_version,
          privacy_notice_version,
          show_in_directory,
          show_in_public_directory,
          is_active
          `,
        )
        .eq(
          "slug",
          slug,
        )
        .maybeSingle();

    if (
      lotteryError
    ) {
      console.error(
        "Lottery checkout slug lookup failed:",
        {
          code:
            lotteryError.code,

          message:
            lotteryError.message,

          details:
            lotteryError.details,

          hint:
            lotteryError.hint,

          slug,
        },
      );

      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_DATABASE_LOOKUP_FAILED",

          error:
            "Unable to load this lottery.",

          details: {
            slug,

            database_code:
              lotteryError.code ??
              null,

            database_message:
              lotteryError.message ??
              null,
          },
        },
        500,
      );
    }

    if (
      !lottery
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NOT_FOUND",

          error:
            "Lottery not found.",

          details: {
            slug,
          },
        },
        404,
      );
    }
    const publicVisible =
      lottery.show_in_directory ===
        true ||
      lottery.show_in_public_directory ===
        true;

    if (
      !publicVisible
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NOT_PUBLIC",

          error:
            "This lottery is not currently available to the public.",
        },
        409,
      );
    }
    if (
      lottery.status !==
        "live" ||
      lottery.is_active !==
        true
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NOT_OPEN",

          error:
            "This lottery is not currently accepting ticket purchases.",

          details: {
            status:
              lottery.status,

            is_active:
              lottery.is_active,
          },
        },
        409,
      );
    }
    const minimumAge =
      Number(
        lottery.minimum_age ??
          18,
      );

    if (
      minimumAge < 0
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_MINIMUM_AGE",

          error:
            "The lottery minimum age is not configured correctly.",
        },
        500,
      );
    }
    const now =
      Date.now();

    if (
      lottery.sales_open_at
    ) {
      const opens =
        new Date(
          lottery.sales_open_at,
        ).getTime();

      if (
        Number.isFinite(
          opens,
        ) &&
        now < opens
      ) {
        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_NOT_OPEN_YET",

            error:
              "Ticket sales have not opened yet.",

            details: {
              sales_open_at:
                lottery.sales_open_at,
            },
          },
          409,
        );
      }
    }

    if (
      lottery.sales_close_at
    ) {
      const closes =
        new Date(
          lottery.sales_close_at,
        ).getTime();

      if (
        Number.isFinite(
          closes,
        ) &&
        now >= closes
      ) {
        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_SALES_CLOSED",

            error:
              "Ticket sales have closed.",

            details: {
              sales_close_at:
                lottery.sales_close_at,
            },
          },
          409,
        );
      }
    }
    const unitPricePence =
      typeof lottery.ticket_price_pence ===
        "number"
        ? lottery.ticket_price_pence
        : Math.round(
            Number(
              lottery.ticket_price ??
                0,
            ) *
              100,
          );

    if (
      !Number.isFinite(
        unitPricePence,
      ) ||
      unitPricePence <=
        0
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_INVALID_PRICE",

          error:
            "The lottery ticket price is not configured correctly.",

          details: {
            ticket_price:
              lottery.ticket_price,

            ticket_price_pence:
              lottery.ticket_price_pence,
          },
        },
        500,
      );
    }
    if (
      typeof lottery.max_tickets ===
        "number" &&
      lottery.max_tickets >
        0
    ) {
      const {
        count,
        error:
          countError,
      } =
        await supabaseAdmin
          .from(
            "lottery_tickets",
          )
          .select(
            "id",
            {
              count:
                "exact",

              head:
                true,
            },
          )
          .eq(
            "lottery_id",
            lottery.id,
          )
          .in(
            "status",
            [
              "issued",
              "winner",
            ],
          );

      if (
        countError
      ) {
        console.error(
          "Lottery ticket availability check failed:",
          countError,
        );

        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_TICKET_COUNT_FAILED",

            error:
              "Unable to check ticket availability.",
          },
          500,
        );
      }

      const issued =
        count ??
        0;

      const remaining =
        Math.max(
          0,
          lottery.max_tickets -
            issued,
        );

      if (
        quantity >
        remaining
      ) {
        return response(
          {
            ok: false,

            code:
              "LOTTERY_CHECKOUT_NOT_ENOUGH_TICKETS",

            error:
              remaining ===
              0
                ? "This lottery has sold out."
                : `Only ${remaining} ticket${
                    remaining ===
                    1
                      ? ""
                      : "s"
                  } remain.`,

            details: {
              requested:
                quantity,

              remaining,
            },
          },
          409,
        );
      }
    }
    const totalPence =
      unitPricePence *
      quantity;

    const orderReference =
      createOrderReference();
    const {
      data: order,
      error:
        orderError,
    } =
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .insert({
          lottery_id:
            lottery.id,

          order_reference:
            orderReference,

          purchaser_name:
            fullName,

          purchaser_email:
            email,

          purchaser_phone:
            phone ||
            null,

          quantity,

          total_amount:
            totalPence /
            100,

          currency:
            lottery.currency ||
            "GBP",

          payment_status:
            "pending",

          eligibility_accepted:
            true,

          terms_version:
            lottery.terms_version,

          privacy_notice_version:
            lottery.privacy_notice_version,

          marketing_opt_in:
            body.marketing_opt_in ===
            true,
        })
        .select(
          "id",
        )
        .single();

    if (
      orderError ||
      !order
    ) {
      console.error(
        "Lottery order creation failed:",
        {
          orderError,
          slug,
          lotteryId:
            lottery.id,
        },
      );

      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_ORDER_CREATE_FAILED",

          error:
            "Unable to create your lottery order.",

          details: {
            database_code:
              orderError?.code ??
              null,

            database_message:
              orderError?.message ??
              null,
          },
        },
        500,
      );
    }

    orderId =
      order.id;
    await recordLotteryAcceptances({
      request,

      lotteryId:
        lottery.id,

      orderId:
        order.id,

      minimumAge,

      geographicEligibility:
        lottery.geographic_eligibility ??
        null,

      termsVersion:
        lottery.terms_version ??
        null,

      privacyNoticeVersion:
        lottery.privacy_notice_version ??
        null,

      ageConfirmed:
        body.age_confirmed ===
        true,

      eligibilityConfirmed:
        body.eligibility_confirmed ===
        true,

      termsAccepted:
        body.terms_accepted ===
        true,

      marketingOptIn:
        body.marketing_opt_in ===
        true,
    });
    const origin =
      new URL(
        request.url,
      ).origin;

    const session =
      await stripe.checkout.sessions.create(
        {
          mode:
            "payment",

          customer_email:
            email,

          success_url:
            `${origin}/Lottery/${encodeURIComponent(
              lottery.slug,
            )}/checkout?payment=success&session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${origin}/Lottery/${encodeURIComponent(
              lottery.slug,
            )}?payment=cancelled`,

          line_items: [
            {
              quantity,

              price_data: {
                currency:
                  (
                    lottery.currency ||
                    "GBP"
                  ).toLowerCase(),

                unit_amount:
                  unitPricePence,

                product_data: {
                  name:
                    `${lottery.title} Lottery Ticket`,

                  description:
                    "Burton Pride lottery ticket",
                },
              },
            },
          ],

          metadata: {
            type:
              "burton_pride_lottery",

            lottery_id:
              lottery.id,

            lottery_slug:
              lottery.slug,

            order_id:
              order.id,

            order_reference:
              orderReference,

            quantity:
              String(
                quantity,
              ),
          },

          payment_intent_data: {
            metadata: {
              type:
                "burton_pride_lottery",

              lottery_id:
                lottery.id,

              order_id:
                order.id,

              order_reference:
                orderReference,
            },
          },
        },
      );
    await supabaseAdmin
      .from(
        "lottery_orders",
      )
      .update({
        payment_reference:
          session.id,
      })
      .eq(
        "id",
        order.id,
      );

    if (
      !session.url
    ) {
      return response(
        {
          ok: false,

          code:
            "LOTTERY_CHECKOUT_NO_STRIPE_URL",

          error:
            "The payment service did not return a checkout page.",
        },
        500,
      );
    }
    return response({
      ok: true,

      lottery: {
        id:
          lottery.id,

        slug:
          lottery.slug,

        title:
          lottery.title,
      },

      order_id:
        order.id,

      order_reference:
        orderReference,

      quantity,

      amount_pence:
        totalPence,

      checkout_url:
        session.url,
    });
  } catch (
    error
  ) {
    console.error(
      "Lottery slug checkout error:",
      error,
    );
    if (
      orderId
    ) {
      await supabaseAdmin
        .from(
          "lottery_orders",
        )
        .update({
          payment_status:
            "failed",

          failed_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          orderId,
        );
    }

    return response(
      {
        ok: false,

        code:
          "LOTTERY_CHECKOUT_UNEXPECTED_ERROR",

        error:
          "Unable to start the secure lottery payment.",

        details: {
          error_name:
            error instanceof
            Error
              ? error.name
              : "UnknownError",

          error_message:
            error instanceof
            Error
              ? error.message
              : "Unknown error",
        },
      },
      500,
    );
  }
}
