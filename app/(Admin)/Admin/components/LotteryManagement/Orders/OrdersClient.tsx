"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  LockKeyhole,
  Mail,
  PoundSterling,
  Pencil,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Ticket,
  Trophy,
  UserRound,
  X,
  XCircle,
  Beaker,
} from "lucide-react";

type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed";

type TicketRecord = {
  id: string;
  ticket_number: string;
  status: string;
  issued_at: string | null;
};

type HistoryRecord = {
  id: string;
  label: string;
  status?: string | null;
  detail?: string | null;
  created_at: string;
};

type OrderRecord = {
  id: string;
  order_reference: string;
  lottery_id: string;
  lottery_title: string;
  lottery_slug: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  quantity: number;
  total_amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  eligibility_accepted: boolean;
  terms_version: string | null;
  privacy_notice_version: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  ticket_count: number;
  active_ticket_count: number;
  winner_count: number;
  refunded_amount: number;
  tickets: TicketRecord[];
  acceptances: HistoryRecord[];
  refunds: HistoryRecord[];
  notifications: HistoryRecord[];
};

type EditOrderDraft = {
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string;
  marketing_opt_in: boolean;
};

type ApiResponse = {
  ok: boolean;
  items?: OrderRecord[];
  error?: string;
  message?: string;
  payment_status?: PaymentStatus;
  paid_at?: string;
  tickets?: TicketRecord[];
  email?: {
    sent?: boolean;
    recipient?: string | null;
    error?: string | null;
  };
};

type LotteryAuditEvent = {
  lottery_id: string;
  lottery_title: string;
  entity_type: "lottery_order";
  entity_id: string;
  action_code: string;
  action_label: string;
  action_group: "lottery" | "payment" | "ticket";
  risk_level: "low" | "medium" | "high" | "critical";
  reason?: string | null;
  metadata?: Record<string, unknown>;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
};

const API_ROUTE = "/api/admin/lotterymanagement/orders";
const AUDIT_LOGS_API =
  "/api/admin/lotterymanagement/audit-logs";
const MAIN_ADMIN_PASSWORD_API =
  "/api/admin/settings/delete-password/";

const PAYMENT_OPTIONS: Array<{ value: PaymentStatus | "all"; label: string }> = [
  { value: "all", label: "All payment statuses" },
  { value: "pending", label: "Waiting payment" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "disputed", label: "Disputed" },
];

function statusLabel(status: PaymentStatus) {
  return PAYMENT_OPTIONS.find((x) => x.value === status)?.label || status;
}

function statusClass(status: PaymentStatus) {
  const classes: Record<PaymentStatus, string> = {
    pending: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    processing: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    paid: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    failed: "border-red-400/25 bg-red-500/10 text-red-200",
    cancelled: "border-white/10 bg-white/5 text-white/50",
    refunded: "border-purple-400/25 bg-purple-500/10 text-purple-200",
    partially_refunded: "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200",
    disputed: "border-orange-400/25 bg-orange-500/10 text-orange-200",
  };

  return classes[status];
}

function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

async function readJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : { ok: false };
  } catch {
    return { ok: false, error: "The API returned invalid JSON." };
  }
}

async function reportLotteryAuditEvent(
  event: LotteryAuditEvent,
) {
  let lastError =
    "The audit log API did not accept the event.";

  // Retry once for a temporary network or server failure. The audit API
  // must derive the acting admin, IP address and device context from the
  // authenticated request; passwords are deliberately never included.
  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    try {
      const response =
        await fetch(
          AUDIT_LOGS_API,
          {
            method:
              "POST",

            cache:
              "no-store",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                ...event,

                metadata: {
                  source:
                    "lottery_management_orders",

                  route:
                    API_ROUTE,

                  ...(event.metadata || {}),
                },
              }),
          },
        );

      const data =
        await readJson(
          response,
        );

      if (
        response.ok &&
        data.ok
      ) {
        return true;
      }

      lastError =
        data.error ||
        data.message ||
        lastError;
    } catch (
      caught: any
    ) {
      lastError =
        caught?.message ||
        lastError;
    }
  }

  console.error(
    "Lottery Management audit event failed:",
    lastError,
  );

  return false;
}

export default function OrdersClient() {
  const [items, setItems] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderRecord | null>(null);
  const [testMode, setTestMode] = useState(false);

  const [markPaidOrder, setMarkPaidOrder] =
    useState<OrderRecord | null>(null);
  const [markPaidPassword, setMarkPaidPassword] = useState("");
  const [showMarkPaidPassword, setShowMarkPaidPassword] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [issueTicketOrder, setIssueTicketOrder] =
    useState<OrderRecord | null>(null);
  const [issueTicketPassword, setIssueTicketPassword] = useState("");
  const [showIssueTicketPassword, setShowIssueTicketPassword] = useState(false);
  const [issuingTickets, setIssuingTickets] = useState(false);
  const [issueTicketError, setIssueTicketError] = useState<string | null>(null);

  const [editOrder, setEditOrder] =
    useState<OrderRecord | null>(null);
  const [editDraft, setEditDraft] =
    useState<EditOrderDraft | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [lotteryId, setLotteryId] = useState("all");
  const [ticketState, setTicketState] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    loadOrders();
  }, []);

  function startFullFeatureTest() {
    const now = Date.now();

    const demoOrders: OrderRecord[] = [
      {
        id: "test-order-paid",
        order_reference: "TEST-ORD-0001",
        lottery_id: "test-lottery-1",
        lottery_title: "Test Summer Raffle 2026",
        lottery_slug: "test-summer-raffle-2026",
        purchaser_name: "Test Supporter One",
        purchaser_email: "test.one@example.test",
        purchaser_phone: "07123 000001",
        quantity: 5,
        total_amount: 5,
        currency: "GBP",
        payment_status: "paid",
        payment_reference: "TEST-PAY-PAID-001",
        eligibility_accepted: true,
        terms_version: "TEST-2026-v1",
        privacy_notice_version: "TEST-PRIVACY-v1",
        marketing_opt_in: false,
        created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 90 * 60 * 1000).toISOString(),
        paid_at: new Date(now - 110 * 60 * 1000).toISOString(),
        ticket_count: 5,
        active_ticket_count: 5,
        winner_count: 0,
        refunded_amount: 0,
        tickets: Array.from({ length: 5 }, (_, index) => ({
          id: `test-ticket-paid-${index + 1}`,
          ticket_number: `BP-TEST-${String(index + 1).padStart(6, "0")}`,
          status: "issued",
          issued_at: new Date(now - 100 * 60 * 1000).toISOString(),
        })),
        acceptances: [
          {
            id: "test-accept-1",
            label: "Eligibility declaration accepted",
            status: "accepted",
            detail: "Test declaration accepted during checkout.",
            created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-accept-2",
            label: "Terms accepted",
            status: "accepted",
            detail: "Terms version TEST-2026-v1.",
            created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          },
        ],
        refunds: [],
        notifications: [
          {
            id: "test-notify-1",
            label: "Purchase confirmation",
            status: "sent",
            detail: "Test confirmation email sent.",
            created_at: new Date(now - 95 * 60 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "test-order-winner",
        order_reference: "TEST-ORD-0002",
        lottery_id: "test-lottery-1",
        lottery_title: "Test Summer Raffle 2026",
        lottery_slug: "test-summer-raffle-2026",
        purchaser_name: "Test Winner",
        purchaser_email: "winner@example.test",
        purchaser_phone: null,
        quantity: 2,
        total_amount: 2,
        currency: "GBP",
        payment_status: "paid",
        payment_reference: "TEST-PAY-WINNER-002",
        eligibility_accepted: true,
        terms_version: "TEST-2026-v1",
        privacy_notice_version: "TEST-PRIVACY-v1",
        marketing_opt_in: true,
        created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 30 * 60 * 1000).toISOString(),
        paid_at: new Date(now - 23 * 60 * 60 * 1000).toISOString(),
        ticket_count: 2,
        active_ticket_count: 2,
        winner_count: 1,
        refunded_amount: 0,
        tickets: [
          {
            id: "test-ticket-winner-1",
            ticket_number: "BP-TEST-000104",
            status: "winner",
            issued_at: new Date(now - 23 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-ticket-winner-2",
            ticket_number: "BP-TEST-000105",
            status: "issued",
            issued_at: new Date(now - 23 * 60 * 60 * 1000).toISOString(),
          },
        ],
        acceptances: [
          {
            id: "test-accept-winner",
            label: "Eligibility declaration accepted",
            status: "accepted",
            detail: "Test winner order declaration.",
            created_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        refunds: [],
        notifications: [
          {
            id: "test-notify-winner-1",
            label: "Purchase confirmation",
            status: "sent",
            detail: "Test purchase confirmation sent.",
            created_at: new Date(now - 23 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-notify-winner-2",
            label: "Winner notification",
            status: "sent",
            detail: "Test winner email sent.",
            created_at: new Date(now - 20 * 60 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "test-order-failed",
        order_reference: "TEST-ORD-0003",
        lottery_id: "test-lottery-2",
        lottery_title: "Test Christmas Raffle 2026",
        lottery_slug: "test-christmas-raffle-2026",
        purchaser_name: "Test Failed Payment",
        purchaser_email: "failed@example.test",
        purchaser_phone: null,
        quantity: 10,
        total_amount: 20,
        currency: "GBP",
        payment_status: "failed",
        payment_reference: "TEST-PAY-FAILED-003",
        eligibility_accepted: true,
        terms_version: "TEST-2026-v1",
        privacy_notice_version: "TEST-PRIVACY-v1",
        marketing_opt_in: false,
        created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: null,
        ticket_count: 0,
        active_ticket_count: 0,
        winner_count: 0,
        refunded_amount: 0,
        tickets: [],
        acceptances: [
          {
            id: "test-accept-failed",
            label: "Eligibility declaration accepted",
            status: "accepted",
            detail: "Declaration accepted before payment failure.",
            created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        refunds: [],
        notifications: [
          {
            id: "test-notify-failed",
            label: "Payment failed",
            status: "sent",
            detail: "Test failed-payment notification.",
            created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "test-order-refund",
        order_reference: "TEST-ORD-0004",
        lottery_id: "test-lottery-2",
        lottery_title: "Test Christmas Raffle 2026",
        lottery_slug: "test-christmas-raffle-2026",
        purchaser_name: "Test Refund",
        purchaser_email: "refund@example.test",
        purchaser_phone: "07123 000004",
        quantity: 4,
        total_amount: 8,
        currency: "GBP",
        payment_status: "partially_refunded",
        payment_reference: "TEST-PAY-REFUND-004",
        eligibility_accepted: true,
        terms_version: "TEST-2026-v1",
        privacy_notice_version: "TEST-PRIVACY-v1",
        marketing_opt_in: false,
        created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: new Date(now - 5 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
        ticket_count: 4,
        active_ticket_count: 2,
        winner_count: 0,
        refunded_amount: 4,
        tickets: [
          {
            id: "test-ticket-refund-1",
            ticket_number: "BP-TEST-000201",
            status: "issued",
            issued_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-ticket-refund-2",
            ticket_number: "BP-TEST-000202",
            status: "issued",
            issued_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-ticket-refund-3",
            ticket_number: "BP-TEST-000203",
            status: "refunded",
            issued_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-ticket-refund-4",
            ticket_number: "BP-TEST-000204",
            status: "refunded",
            issued_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        acceptances: [
          {
            id: "test-accept-refund",
            label: "Terms accepted",
            status: "accepted",
            detail: "Test terms acceptance.",
            created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        refunds: [
          {
            id: "test-refund-1",
            label: "Partial refund",
            status: "completed",
            detail: "£4.00 test refund completed; two tickets refunded.",
            created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        notifications: [
          {
            id: "test-notify-refund",
            label: "Refund confirmation",
            status: "sent",
            detail: "Test refund confirmation sent.",
            created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      },
      {
        id: "test-order-disputed",
        order_reference: "TEST-ORD-0005",
        lottery_id: "test-lottery-3",
        lottery_title: "Test Community Fundraiser",
        lottery_slug: "test-community-fundraiser",
        purchaser_name: "Test Dispute",
        purchaser_email: "dispute@example.test",
        purchaser_phone: null,
        quantity: 3,
        total_amount: 3,
        currency: "GBP",
        payment_status: "disputed",
        payment_reference: "TEST-PAY-DISPUTE-005",
        eligibility_accepted: true,
        terms_version: "TEST-2026-v1",
        privacy_notice_version: "TEST-PRIVACY-v1",
        marketing_opt_in: false,
        created_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 60 * 60 * 1000).toISOString(),
        paid_at: new Date(now - 8 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
        ticket_count: 3,
        active_ticket_count: 3,
        winner_count: 0,
        refunded_amount: 0,
        tickets: [
          {
            id: "test-ticket-dispute-1",
            ticket_number: "BP-TEST-000301",
            status: "issued",
            issued_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-ticket-dispute-2",
            ticket_number: "BP-TEST-000302",
            status: "issued",
            issued_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "test-ticket-dispute-3",
            ticket_number: "BP-TEST-000303",
            status: "issued",
            issued_at: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        acceptances: [],
        refunds: [],
        notifications: [
          {
            id: "test-notify-dispute",
            label: "Admin dispute alert",
            status: "sent",
            detail: "Test dispute alert created for review.",
            created_at: new Date(now - 60 * 60 * 1000).toISOString(),
          },
        ],
      },
    ];

    setTestMode(true);
    setItems(demoOrders);
    setSelected(null);
    setError(null);
    setSearch("");
    setPaymentStatus("all");
    setLotteryId("all");
    setTicketState("all");
    setSort("newest");
    setLoading(false);
  }

  async function loadOrders() {
    setTestMode(false);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to load lottery orders.");
      }

      setItems(data.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load lottery orders.");
    } finally {
      setLoading(false);
    }
  }

  function requestEditOrder(
    order: OrderRecord,
  ) {
    if (
      testMode
    ) {
      setError(
        "Order editing is disabled while test-mode demo records are active.",
      );
      return;
    }

    setEditOrder(
      order,
    );

    setEditDraft({
      purchaser_name:
        order.purchaser_name ||
        "",

      purchaser_email:
        order.purchaser_email ||
        "",

      purchaser_phone:
        order.purchaser_phone ||
        "",

      marketing_opt_in:
        Boolean(
          order.marketing_opt_in,
        ),
    });

    setEditPassword(
      "",
    );

    setShowEditPassword(
      false,
    );

    setEditError(
      null,
    );

    setNotice(
      null,
    );
  }

  function closeEditOrder() {
    if (
      savingEdit
    ) {
      return;
    }

    setEditOrder(
      null,
    );

    setEditDraft(
      null,
    );

    setEditPassword(
      "",
    );

    setShowEditPassword(
      false,
    );

    setEditError(
      null,
    );
  }

  function updateEditDraft(
    patch: Partial<EditOrderDraft>,
  ) {
    setEditDraft(
      (
        current,
      ) =>
        current
          ? {
              ...current,
              ...patch,
            }
          : current,
    );
  }

  async function confirmEditOrder(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !editOrder ||
      !editDraft ||
      savingEdit
    ) {
      return;
    }

    const cleanName =
      editDraft
        .purchaser_name
        .trim();

    const cleanEmail =
      editDraft
        .purchaser_email
        .trim();

    const cleanPhone =
      editDraft
        .purchaser_phone
        .trim();

    if (
      !cleanName
    ) {
      setEditError(
        "Purchaser name is required.",
      );
      return;
    }

    if (
      !cleanEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail,
      )
    ) {
      setEditError(
        "Enter a valid purchaser email address.",
      );
      return;
    }

    if (
      !editPassword
        .trim()
    ) {
      setEditError(
        "Enter the main admin settings password before saving changes.",
      );
      return;
    }

    const changesMade =
      cleanName !==
        (
          editOrder.purchaser_name ||
          ""
        ).trim() ||
      cleanEmail.toLowerCase() !==
        (
          editOrder.purchaser_email ||
          ""
        )
          .trim()
          .toLowerCase() ||
      cleanPhone !==
        (
          editOrder.purchaser_phone ||
          ""
        ).trim() ||
      editDraft.marketing_opt_in !==
        Boolean(
          editOrder.marketing_opt_in,
        );

    if (
      !changesMade
    ) {
      setEditError(
        "No order details have been changed.",
      );
      return;
    }

    setSavingEdit(
      true,
    );

    setEditError(
      null,
    );

    setNotice(
      null,
    );

    try {
      /*
       * Step 1:
       * Verify the password through the existing Main Admin
       * Settings password endpoint.
       */
      const passwordResponse =
        await fetch(
          MAIN_ADMIN_PASSWORD_API,
          {
            method:
              "POST",

            cache:
              "no-store",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                password:
                  editPassword,
              }),
          },
        );

      const passwordData =
        await readJson(
          passwordResponse,
        );

      if (
        !passwordResponse.ok ||
        !passwordData.ok
      ) {
        throw new Error(
          passwordData.error ||
            passwordData.message ||
            "The main admin settings password is incorrect or could not be verified.",
        );
      }

      /*
       * Step 2:
       * Save the order edit.
       *
       * The Orders API verifies the same password again server-side,
       * so this browser check cannot be bypassed.
       */
      const response =
        await fetch(
          API_ROUTE,
          {
            method:
              "PATCH",

            cache:
              "no-store",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "edit_order",

                order_id:
                  editOrder.id,

                main_admin_password:
                  editPassword,

                changes: {
                  purchaser_name:
                    cleanName,

                  purchaser_email:
                    cleanEmail,

                  purchaser_phone:
                    cleanPhone ||
                    null,

                  marketing_opt_in:
                    editDraft
                      .marketing_opt_in,
                },
              }),
          },
        );

      const data =
        await readJson(
          response,
        );

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
            data.message ||
            "The order changes could not be saved.",
        );
      }

      const auditSaved =
        await reportLotteryAuditEvent({
          lottery_id:
            editOrder.lottery_id,

          lottery_title:
            editOrder.lottery_title,

          entity_type:
            "lottery_order",

          entity_id:
            editOrder.id,

          action_code:
            "order.updated",

          action_label:
            "Lottery order details updated",

          action_group:
            "lottery",

          risk_level:
            "high",

          metadata: {
            outcome:
              "success",

            order_reference:
              editOrder.order_reference,
          },

          before_data: {
            purchaser_name:
              editOrder.purchaser_name,

            purchaser_email:
              editOrder.purchaser_email,

            purchaser_phone:
              editOrder.purchaser_phone,

            marketing_opt_in:
              editOrder.marketing_opt_in,
          },

          after_data: {
            purchaser_name:
              cleanName,

            purchaser_email:
              cleanEmail,

            purchaser_phone:
              cleanPhone ||
              null,

            marketing_opt_in:
              editDraft.marketing_opt_in,
          },
        });

      setEditOrder(
        null,
      );

      setEditDraft(
        null,
      );

      setEditPassword(
        "",
      );

      setShowEditPassword(
        false,
      );

      setSelected(
        null,
      );

      setNotice(
        auditSaved
          ? data.message ||
            "The order details have been updated."
          : "The order details were updated, but the audit log could not be saved. Please report this to a main admin.",
      );

      await loadOrders();
    } catch (
      caught: any
    ) {
      const failureMessage =
        caught?.message ||
        "The order changes could not be saved.";

      await reportLotteryAuditEvent({
        lottery_id:
          editOrder.lottery_id,

        lottery_title:
          editOrder.lottery_title,

        entity_type:
          "lottery_order",

        entity_id:
          editOrder.id,

        action_code:
          "order.update_failed",

        action_label:
          "Lottery order update failed",

        action_group:
          "lottery",

        risk_level:
          "high",

        reason:
          failureMessage,

        metadata: {
          outcome:
            "failed",

          order_reference:
            editOrder.order_reference,
        },
      });

      setEditError(
        failureMessage,
      );
    } finally {
      setSavingEdit(
        false,
      );
    }
  }

  function requestMarkPaid(
    order: OrderRecord,
  ) {
    if (
      testMode
    ) {
      setError(
        "Manual payment changes are disabled while test-mode demo records are active.",
      );
      return;
    }

    if (
      order.payment_status !==
      "pending"
    ) {
      setError(
        "Only an order waiting for payment can be manually marked as paid.",
      );
      return;
    }

    setMarkPaidOrder(
      order,
    );
    setMarkPaidPassword(
      "",
    );
    setShowMarkPaidPassword(
      false,
    );
    setMarkPaidError(
      null,
    );
    setNotice(
      null,
    );
  }

  function closeMarkPaid() {
    if (
      markingPaid
    ) {
      return;
    }

    setMarkPaidOrder(
      null,
    );
    setMarkPaidPassword(
      "",
    );
    setShowMarkPaidPassword(
      false,
    );
    setMarkPaidError(
      null,
    );
  }

  async function confirmMarkPaid(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !markPaidOrder ||
      markingPaid
    ) {
      return;
    }

    if (
      !markPaidPassword
        .trim()
    ) {
      setMarkPaidError(
        "Enter the main admin password.",
      );
      return;
    }

    setMarkingPaid(
      true,
    );
    setMarkPaidError(
      null,
    );
    setNotice(
      null,
    );

    const orderToUpdate =
      markPaidOrder;

    try {
      /*
       * Step 1:
       * Verify the password using the existing Admin Settings API.
       * This API checks the bcrypt hash stored in admin_delete_settings.
       */
      const passwordResponse =
        await fetch(
          MAIN_ADMIN_PASSWORD_API,
          {
            method:
              "POST",

            cache:
              "no-store",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                password:
                  markPaidPassword,
              }),
          },
        );

      const passwordData =
        await readJson(
          passwordResponse,
        );

      if (
        !passwordResponse.ok ||
        !passwordData.ok
      ) {
        throw new Error(
          passwordData.error ||
            passwordData.message ||
            "The main admin password is incorrect or could not be verified.",
        );
      }

      /*
       * Step 2:
       * Send the protected order update.
       *
       * The Orders API checks admin_delete_settings again server-side,
       * so bypassing this browser check cannot bypass the password.
       */
      const res =
        await fetch(
          API_ROUTE,
          {
            method:
              "PATCH",

            cache:
              "no-store",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "mark_paid",

                order_id:
                  orderToUpdate.id,

                main_admin_password:
                  markPaidPassword,
              }),
          },
        );

      const data =
        await readJson(
          res,
        );

      if (
        !res.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
            data.message ||
            "The order could not be marked as paid.",
        );
      }

      const auditSaved =
        await reportLotteryAuditEvent({
          lottery_id:
            orderToUpdate.lottery_id,

          lottery_title:
            orderToUpdate.lottery_title,

          entity_type:
            "lottery_order",

          entity_id:
            orderToUpdate.id,

          action_code:
            "payment.manually_marked_paid",

          action_label:
            "Lottery order manually marked as paid",

          action_group:
            "payment",

          risk_level:
            "critical",

          metadata: {
            outcome:
              "success",

            order_reference:
              orderToUpdate.order_reference,

            confirmation_email_sent:
              data.email?.sent ??
              null,

            issued_ticket_numbers:
              (data.tickets || []).map(
                (
                  ticket,
                ) =>
                  ticket.ticket_number,
              ),
          },

          before_data: {
            payment_status:
              orderToUpdate.payment_status,

            paid_at:
              orderToUpdate.paid_at,

            ticket_count:
              orderToUpdate.ticket_count,
          },

          after_data: {
            payment_status:
              data.payment_status ||
              "paid",

            paid_at:
              data.paid_at ||
              null,

            ticket_count:
              data.tickets?.length ??
              orderToUpdate.ticket_count,
          },
        });

      setMarkPaidOrder(
        null,
      );
      setMarkPaidPassword(
        "",
      );
      setShowMarkPaidPassword(
        false,
      );
      setSelected(
        null,
      );

      setNotice(
        auditSaved
          ? data.message ||
            (
              data.email?.sent ===
              false
                ? "The order is paid and ticket numbers were issued, but the confirmation email needs attention."
                : "The order is now paid. Ticket numbers were issued and the confirmation email was sent."
            )
          : "The order was marked as paid, but the audit log could not be saved. Please report this to a main admin.",
      );

      await loadOrders();
    } catch (
      err: any
    ) {
      const failureMessage =
        err?.message ||
        "The order could not be marked as paid.";

      await reportLotteryAuditEvent({
        lottery_id:
          orderToUpdate.lottery_id,

        lottery_title:
          orderToUpdate.lottery_title,

        entity_type:
          "lottery_order",

        entity_id:
          orderToUpdate.id,

        action_code:
          "payment.manual_paid_failed",

        action_label:
          "Manual lottery payment confirmation failed",

        action_group:
          "payment",

        risk_level:
          "critical",

        reason:
          failureMessage,

        metadata: {
          outcome:
            "failed",

          order_reference:
            orderToUpdate.order_reference,
        },
      });

      setMarkPaidError(
        failureMessage,
      );
    } finally {
      setMarkingPaid(
        false,
      );
    }
  }

  function requestIssueMissingTickets(order: OrderRecord) {
    if (testMode) {
      setError(
        "Manual ticket issuing is disabled while test-mode demo records are active.",
      );
      return;
    }

    if (order.payment_status !== "paid") {
      setError(
        "Missing tickets can only be issued for an order that is already paid.",
      );
      return;
    }

    if (order.ticket_count >= Math.max(1, order.quantity || 1)) {
      setError("This order already has all of its ticket numbers.");
      return;
    }

    setIssueTicketOrder(order);
    setIssueTicketPassword("");
    setShowIssueTicketPassword(false);
    setIssueTicketError(null);
    setNotice(null);
  }

  function closeIssueMissingTickets() {
    if (issuingTickets) return;

    setIssueTicketOrder(null);
    setIssueTicketPassword("");
    setShowIssueTicketPassword(false);
    setIssueTicketError(null);
  }

  async function confirmIssueMissingTickets(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!issueTicketOrder || issuingTickets) return;

    if (!issueTicketPassword.trim()) {
      setIssueTicketError("Enter the main admin settings password.");
      return;
    }

    setIssuingTickets(true);
    setIssueTicketError(null);
    setNotice(null);

    const orderToUpdate =
      issueTicketOrder;

    try {
      const passwordResponse = await fetch(MAIN_ADMIN_PASSWORD_API, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ password: issueTicketPassword }),
      });

      const passwordData = await readJson(passwordResponse);

      if (!passwordResponse.ok || !passwordData.ok) {
        throw new Error(
          passwordData.error ||
            passwordData.message ||
            "The main admin settings password is incorrect or could not be verified.",
        );
      }

      const response = await fetch(API_ROUTE, {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "issue_missing_tickets",
          order_id: orderToUpdate.id,
          main_admin_password: issueTicketPassword,
        }),
      });

      const data = await readJson(response);

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
          data.message ||
            "The missing ticket could not be issued.",
        );
      }

      const auditSaved =
        await reportLotteryAuditEvent({
          lottery_id:
            orderToUpdate.lottery_id,

          lottery_title:
            orderToUpdate.lottery_title,

          entity_type:
            "lottery_order",

          entity_id:
            orderToUpdate.id,

          action_code:
            "ticket.missing_issued",

          action_label:
            "Missing lottery tickets issued",

          action_group:
            "ticket",

          risk_level:
            "high",

          metadata: {
            outcome:
              "success",

            order_reference:
              orderToUpdate.order_reference,

            confirmation_email_sent:
              data.email?.sent ??
              null,

            issued_ticket_numbers:
              (data.tickets || [])
                .filter(
                  (
                    ticket,
                  ) =>
                    !orderToUpdate.tickets.some(
                      (
                        existing,
                      ) =>
                        existing.id ===
                        ticket.id,
                    ),
                )
                .map(
                  (
                    ticket,
                  ) =>
                    ticket.ticket_number,
                ),
          },

          before_data: {
            ticket_count:
              orderToUpdate.ticket_count,

            ticket_numbers:
              orderToUpdate.tickets.map(
                (
                  ticket,
                ) =>
                  ticket.ticket_number,
              ),
          },

          after_data: {
            ticket_count:
              data.tickets?.length ??
              orderToUpdate.ticket_count,

            ticket_numbers:
              (data.tickets ||
                orderToUpdate.tickets).map(
                (
                  ticket,
                ) =>
                  ticket.ticket_number,
              ),
          },
        });

      setIssueTicketOrder(null);
      setIssueTicketPassword("");
      setShowIssueTicketPassword(false);
      setSelected(null);
      setNotice(
        auditSaved
          ? data.message ||
            "The missing ticket was issued and the order was updated."
          : "The missing ticket was issued, but the audit log could not be saved. Please report this to a main admin.",
      );

      await loadOrders();
    } catch (caught: any) {
      const failureMessage =
        caught?.message ||
        "The missing ticket could not be issued.";

      await reportLotteryAuditEvent({
        lottery_id:
          orderToUpdate.lottery_id,

        lottery_title:
          orderToUpdate.lottery_title,

        entity_type:
          "lottery_order",

        entity_id:
          orderToUpdate.id,

        action_code:
          "ticket.missing_issue_failed",

        action_label:
          "Missing lottery ticket issue failed",

        action_group:
          "ticket",

        risk_level:
          "high",

        reason:
          failureMessage,

        metadata: {
          outcome:
            "failed",

          order_reference:
            orderToUpdate.order_reference,
        },
      });

      setIssueTicketError(
        failureMessage,
      );
    } finally {
      setIssuingTickets(false);
    }
  }

  const lotteries = useMemo(() => {
    const map = new Map<string, string>();

    for (const item of items) {
      map.set(item.lottery_id, item.lottery_title);
    }

    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const ticketMatches = item.tickets.some((ticket) =>
        ticket.ticket_number.toLowerCase().includes(q),
      );

      const matchesSearch =
        !q ||
        item.order_reference.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.purchaser_name || "").toLowerCase().includes(q) ||
        (item.purchaser_email || "").toLowerCase().includes(q) ||
        (item.payment_reference || "").toLowerCase().includes(q) ||
        item.lottery_title.toLowerCase().includes(q) ||
        ticketMatches;

      const matchesPayment =
        paymentStatus === "all" || item.payment_status === paymentStatus;

      const matchesLottery =
        lotteryId === "all" || item.lottery_id === lotteryId;

      const matchesTickets =
        ticketState === "all" ||
        (ticketState === "issued" && item.active_ticket_count > 0) ||
        (ticketState === "none" && item.ticket_count === 0) ||
        (ticketState === "winner" && item.winner_count > 0);

      return matchesSearch && matchesPayment && matchesLottery && matchesTickets;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return +new Date(a.created_at) - +new Date(b.created_at);
        case "amount_high":
          return Number(b.total_amount) - Number(a.total_amount);
        case "amount_low":
          return Number(a.total_amount) - Number(b.total_amount);
        case "tickets_high":
          return Number(b.ticket_count) - Number(a.ticket_count);
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
  }, [items, search, paymentStatus, lotteryId, ticketState, sort]);

  const paidOrders = items.filter((x) => x.payment_status === "paid");
  const paidRevenue = paidOrders.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0,
  );
  const totalTickets = items.reduce((sum, item) => sum + item.ticket_count, 0);
  const problems = items.filter((x) =>
    ["failed", "disputed", "partially_refunded"].includes(x.payment_status),
  ).length;

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <ReceiptText className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Orders & Entries
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Review lottery purchasers, payments, issued tickets, declarations,
                notifications, refunds and winner links.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startFullFeatureTest}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
            >
              <Beaker className="h-4 w-4" />
              Test full feature
            </button>

            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {testMode ? (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <div className="flex items-start gap-3">
            <Beaker className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-bold">Test mode is active</div>
              <div className="mt-1 text-yellow-100/70">
                These are fake order and ticket records. You can test filters, winner orders,
                refunds, payment problems and the full order details modal without changing
                the real API or Supabase.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={<ReceiptText className="h-5 w-5" />}
          label="Total orders"
          value={String(items.length)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Paid orders"
          value={String(paidOrders.length)}
        />
        <StatCard
          icon={<PoundSterling className="h-5 w-5" />}
          label="Paid proceeds"
          value={formatMoney(paidRevenue)}
        />
        <StatCard
          icon={<Ticket className="h-5 w-5" />}
          label="Tickets issued"
          value={String(totalTickets)}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Needs attention"
          value={String(problems)}
        />
      </section>

      {notice ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">{notice}</div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-lg p-1 text-emerald-100/70 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />
          <h2 className="text-lg font-bold text-white">Search & filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, order, ticket or payment reference..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select value={paymentStatus} onChange={(v) => setPaymentStatus(v as PaymentStatus | "all")}>
            {PAYMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select value={lotteryId} onChange={setLotteryId}>
            <option value="all">All lotteries</option>
            {lotteries.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </Select>

          <Select value={ticketState} onChange={setTicketState}>
            <option value="all">All ticket states</option>
            <option value="issued">Has issued tickets</option>
            <option value="none">No tickets issued</option>
            <option value="winner">Winner orders</option>
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select value={sort} onChange={setSort}>
            <option value="newest">Newest orders</option>
            <option value="oldest">Oldest orders</option>
            <option value="amount_high">Highest amount</option>
            <option value="amount_low">Lowest amount</option>
            <option value="tickets_high">Most tickets</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Order register</h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} orders
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading orders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <ReceiptText className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-bold text-white">No orders found</h3>
            <p className="mt-1 text-sm text-white/50">
              There are no orders matching the selected filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <OrderRow
                key={item.id}
                item={item}
                onView={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <OrderDetailsModal
          order={selected}
          onClose={() => setSelected(null)}
          onMarkPaid={requestMarkPaid}
          onIssueMissingTickets={requestIssueMissingTickets}
          onEdit={requestEditOrder}
        />
      ) : null}

      {editOrder && editDraft ? (
        <EditOrderModal
          order={editOrder}
          draft={editDraft}
          password={editPassword}
          showPassword={showEditPassword}
          loading={savingEdit}
          error={editError}
          onDraftChange={updateEditDraft}
          onPasswordChange={setEditPassword}
          onTogglePassword={() =>
            setShowEditPassword((current) => !current)
          }
          onClose={closeEditOrder}
          onSubmit={confirmEditOrder}
        />
      ) : null}

      {markPaidOrder ? (
        <MarkPaidModal
          order={markPaidOrder}
          password={markPaidPassword}
          showPassword={showMarkPaidPassword}
          loading={markingPaid}
          error={markPaidError}
          onPasswordChange={setMarkPaidPassword}
          onTogglePassword={() =>
            setShowMarkPaidPassword((current) => !current)
          }
          onClose={closeMarkPaid}
          onSubmit={confirmMarkPaid}
        />
      ) : null}

      {issueTicketOrder ? (
        <IssueMissingTicketsModal
          order={issueTicketOrder}
          password={issueTicketPassword}
          showPassword={showIssueTicketPassword}
          loading={issuingTickets}
          error={issueTicketError}
          onPasswordChange={setIssueTicketPassword}
          onTogglePassword={() =>
            setShowIssueTicketPassword((current) => !current)
          }
          onClose={closeIssueMissingTickets}
          onSubmit={confirmIssueMissingTickets}
        />
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-3 text-white/55">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
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
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </div>
  );
}

function OrderRow({
  item,
  onView,
}: {
  item: OrderRecord;
  onView: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-white">
              {item.order_reference}
            </h3>

            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
                item.payment_status,
              )}`}
            >
              {statusLabel(item.payment_status)}
            </span>

            {item.winner_count > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/25 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold text-yellow-200">
                <Trophy className="h-3 w-3" />
                Winner
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-semibold text-white/75">
            {item.lottery_title}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Info label="Purchaser" value={item.purchaser_name || "Not provided"} />
            <Info label="Email" value={item.purchaser_email || "Not provided"} />
            <Info label="Amount" value={formatMoney(item.total_amount, item.currency)} />
            <Info label="Tickets" value={`${item.ticket_count} issued`} />
            <Info label="Ordered" value={formatDate(item.created_at)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
            <span>Payment ref: {item.payment_reference || "Not recorded"}</span>
            <span>Order ID: {item.id}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onView}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"
        >
          <Eye className="h-4 w-4" />
          View order
        </button>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </div>
      <div className="mt-1 break-words text-xs font-bold text-white/75">
        {value}
      </div>
    </div>
  );
}

function OrderDetailsModal({
  order,
  onClose,
  onMarkPaid,
  onIssueMissingTickets,
  onEdit,
}: {
  order: OrderRecord;
  onClose: () => void;
  onMarkPaid: (order: OrderRecord) => void;
  onIssueMissingTickets: (order: OrderRecord) => void;
  onEdit: (order: OrderRecord) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-details-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id="order-details-title" className="text-xl font-extrabold text-white">
              Order {order.order_reference}
            </h2>
            <p className="mt-1 text-sm text-white/55">{order.lottery_title}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-sm font-extrabold text-purple-100 transition hover:bg-purple-500/20"
            >
              <Pencil className="h-4 w-4" />
              Edit order
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10"
              aria-label="Close order details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          {order.payment_status === "pending" ? (
            <div className="mb-6 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 font-extrabold text-amber-100">
                    <AlertTriangle className="h-5 w-5" />
                    Waiting for payment
                  </div>

                  <p className="mt-2 text-sm leading-6 text-amber-100/70">
                    Only use the manual paid action when Burton Pride has confirmed
                    that this payment should be treated as received. A main admin
                    password is required. The action will issue the lottery number
                    and send the entrant a confirmation email.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onMarkPaid(order)}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-300"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Mark as paid
                </button>
              </div>
            </div>
          ) : null}

          {order.payment_status === "paid" &&
          order.ticket_count < Math.max(1, order.quantity || 1) ? (
            <div className="mb-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 font-extrabold text-red-100">
                    <AlertTriangle className="h-5 w-5" />
                    Paid order has missing tickets
                  </div>

                  <p className="mt-2 text-sm leading-6 text-red-100/70">
                    This order is paid for {Math.max(1, order.quantity || 1)} ticket
                    {Math.max(1, order.quantity || 1) === 1 ? "" : "s"}, but only{" "}
                    {order.ticket_count} {order.ticket_count === 1 ? "has" : "have"} been
                    issued. A main admin can safely issue only the missing ticket
                    {Math.max(1, order.quantity || 1) - order.ticket_count === 1
                      ? ""
                      : "s"}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onIssueMissingTickets(order)}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-red-400 px-5 py-3 text-sm font-extrabold text-red-950 transition hover:bg-red-300"
                >
                  <Ticket className="h-5 w-5" />
                  Issue missing ticket
                  {Math.max(1, order.quantity || 1) - order.ticket_count === 1
                    ? ""
                    : "s"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard
              icon={<UserRound className="h-4 w-4" />}
              label="Purchaser"
              value={order.purchaser_name || "Not provided"}
            />
            <DetailCard
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={order.purchaser_email || "Not provided"}
            />
            <DetailCard
              icon={<CreditCard className="h-4 w-4" />}
              label="Payment"
              value={statusLabel(order.payment_status)}
            />
            <DetailCard
              icon={<PoundSterling className="h-4 w-4" />}
              label="Order total"
              value={formatMoney(order.total_amount, order.currency)}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Order & payment details">
              <DetailRows
                rows={[
                  ["Order reference", order.order_reference],
                  ["Payment reference", order.payment_reference || "Not recorded"],
                  ["Quantity ordered", String(order.quantity)],
                  ["Order created", formatDate(order.created_at)],
                  ["Paid at", formatDate(order.paid_at)],
                  ["Refunded amount", formatMoney(order.refunded_amount, order.currency)],
                  ["Phone", order.purchaser_phone || "Not provided"],
                  ["Winner records", String(order.winner_count)],
                ]}
              />
            </Panel>

            <Panel title="Declarations & consent">
              <DetailRows
                rows={[
                  ["Eligibility accepted", order.eligibility_accepted ? "Yes" : "No"],
                  ["Terms version", order.terms_version || "Not recorded"],
                  ["Privacy notice version", order.privacy_notice_version || "Not recorded"],
                  ["Marketing opt-in", order.marketing_opt_in ? "Yes" : "No"],
                ]}
              />

              <HistoryList items={order.acceptances} empty="No declaration history recorded." />
            </Panel>

            <Panel title="Issued tickets">
              {order.tickets.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {order.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-white/60" />
                        <span className="font-bold text-white">
                          {ticket.ticket_number}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {ticket.status} · {formatDate(ticket.issued_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No ticket numbers have been issued for this order." />
              )}
            </Panel>

            <Panel title="Refund / void history">
              <HistoryList items={order.refunds} empty="No refund history recorded." />
            </Panel>

            <Panel title="Email & notification history">
              <HistoryList
                items={order.notifications}
                empty="No notification history recorded."
              />
            </Panel>

            <Panel title="Integrity summary">
              <div className="space-y-3">
                <IntegrityRow
                  ok={order.payment_status === "paid" ? order.ticket_count > 0 : true}
                  text={
                    order.payment_status === "paid"
                      ? order.ticket_count > 0
                        ? "Paid order has issued ticket records."
                        : "Paid order has no issued tickets and needs reconciliation."
                      : "Order is not marked paid."
                  }
                />
                <IntegrityRow
                  ok={order.payment_status !== "failed" || order.ticket_count === 0}
                  text={
                    order.payment_status === "failed" && order.ticket_count > 0
                      ? "Failed payment has ticket records and needs investigation."
                      : "No failed-payment ticket conflict detected."
                  }
                />
                <IntegrityRow
                  ok={order.refunded_amount <= order.total_amount}
                  text={
                    order.refunded_amount <= order.total_amount
                      ? "Recorded refunds do not exceed the order total."
                      : "Refund history exceeds the recorded order total."
                  }
                />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}



function EditOrderModal({
  order,
  draft,
  password,
  showPassword,
  loading,
  error,
  onDraftChange,
  onPasswordChange,
  onTogglePassword,
  onClose,
  onSubmit,
}: {
  order: OrderRecord;
  draft: EditOrderDraft;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  onDraftChange: (patch: Partial<EditOrderDraft>) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-order-title"
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-purple-300/20 bg-[#15172a] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-200">
              <Pencil className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-purple-300">
                Protected order edit
              </p>

              <h2
                id="edit-order-title"
                className="mt-1 text-xl font-extrabold text-white"
              >
                Edit {order.order_reference}
              </h2>

              <p className="mt-1 text-sm text-white/50">
                Every save requires the Main Admin Settings password.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 disabled:opacity-40"
            aria-label="Close order editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="edit-order-name"
                className="text-sm font-extrabold text-white"
              >
                Purchaser name
              </label>

              <input
                id="edit-order-name"
                type="text"
                value={draft.purchaser_name}
                onChange={(event) =>
                  onDraftChange({
                    purchaser_name:
                      event.target.value,
                  })
                }
                disabled={loading}
                maxLength={200}
                className="mt-2 h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-purple-400/60 focus:ring-4 focus:ring-purple-400/10 disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="edit-order-email"
                className="text-sm font-extrabold text-white"
              >
                Purchaser email
              </label>

              <input
                id="edit-order-email"
                type="email"
                value={draft.purchaser_email}
                onChange={(event) =>
                  onDraftChange({
                    purchaser_email:
                      event.target.value,
                  })
                }
                disabled={loading}
                maxLength={320}
                className="mt-2 h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-purple-400/60 focus:ring-4 focus:ring-purple-400/10 disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="edit-order-phone"
                className="text-sm font-extrabold text-white"
              >
                Phone
              </label>

              <input
                id="edit-order-phone"
                type="tel"
                value={draft.purchaser_phone}
                onChange={(event) =>
                  onDraftChange({
                    purchaser_phone:
                      event.target.value,
                  })
                }
                disabled={loading}
                maxLength={50}
                placeholder="Optional"
                className="mt-2 h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-white outline-none placeholder:text-white/30 focus:border-purple-400/60 focus:ring-4 focus:ring-purple-400/10 disabled:opacity-50"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-extrabold text-white">
                Marketing preference
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.marketing_opt_in}
                  onChange={(event) =>
                    onDraftChange({
                      marketing_opt_in:
                        event.target.checked,
                    })
                  }
                  disabled={loading}
                  className="h-5 w-5 rounded border-white/20 bg-black/30 accent-purple-500"
                />

                <span className="text-sm text-white/70">
                  Marketing opt-in recorded
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100/75">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />
              <div>
                <div className="font-extrabold text-blue-100">
                  Protected fields
                </div>

                <p className="mt-1">
                  Order reference, lottery, payment status, payment reference,
                  amount, quantity, paid date, declarations and ticket numbers
                  are not changed through this general editor. Use their
                  dedicated payment, refund or ticket actions instead.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info
                label="Payment status"
                value={statusLabel(order.payment_status)}
              />
              <Info
                label="Order total"
                value={formatMoney(order.total_amount, order.currency)}
              />
              <Info
                label="Quantity"
                value={String(order.quantity)}
              />
              <Info
                label="Tickets issued"
                value={String(order.ticket_count)}
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="edit-order-main-admin-password"
              className="text-sm font-extrabold text-white"
            >
              Main admin password
            </label>

            <div className="relative mt-2">
              <input
                id="edit-order-main-admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  onPasswordChange(
                    event.target.value,
                  )
                }
                autoComplete="current-password"
                disabled={loading}
                placeholder="Enter the main admin password"
                className="h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 pr-12 text-base text-white outline-none placeholder:text-white/30 focus:border-purple-400/60 focus:ring-4 focus:ring-purple-400/10 disabled:opacity-50"
              />

              <button
                type="button"
                onClick={onTogglePassword}
                disabled={loading}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-semibold text-red-100"
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-purple-400 px-5 py-3 text-sm font-extrabold text-purple-950 transition hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


function IssueMissingTicketsModal({
  order,
  password,
  showPassword,
  loading,
  error,
  onPasswordChange,
  onTogglePassword,
  onClose,
  onSubmit,
}: {
  order: OrderRecord;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const required = Math.max(1, order.quantity || 1);
  const missing = Math.max(0, required - order.ticket_count);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-missing-tickets-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-red-400/20 bg-[#15172a] shadow-2xl"
      >
        <div className="border-b border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-400/15 text-red-300">
                <Ticket className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-red-300">
                  Protected ticket recovery
                </p>
                <h2
                  id="issue-missing-tickets-title"
                  className="mt-1 text-xl font-extrabold text-white"
                >
                  Issue missing ticket{missing === 1 ? "" : "s"}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Order" value={order.order_reference} />
              <Info label="Payment" value={statusLabel(order.payment_status)} />
              <Info label="Quantity paid for" value={String(required)} />
              <Info label="Missing tickets" value={String(missing)} />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/80">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <p>
                This action keeps the order marked as paid and issues only the
                missing ticket number{missing === 1 ? "" : "s"}. Existing ticket
                numbers are preserved. A confirmation email will be sent to{" "}
                <strong className="text-amber-100">
                  {order.purchaser_email || "the entrant"}
                </strong>.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="issue-ticket-main-admin-password"
              className="text-sm font-extrabold text-white"
            >
              Main admin settings password
            </label>

            <div className="relative mt-2">
              <input
                id="issue-ticket-main-admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="Enter the password set in Admin Settings"
                className="h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 pr-12 text-base text-white outline-none placeholder:text-white/30 focus:border-red-400/60 focus:ring-4 focus:ring-red-400/10 disabled:opacity-50"
              />

              <button
                type="button"
                onClick={onTogglePassword}
                disabled={loading}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-semibold text-red-100"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/10 disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !password.trim() || missing < 1}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-400 px-5 py-3 text-sm font-extrabold text-red-950 transition hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Issuing...
                </>
              ) : (
                <>
                  <Ticket className="h-5 w-5" />
                  Issue {missing} missing ticket{missing === 1 ? "" : "s"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MarkPaidModal({
  order,
  password,
  showPassword,
  loading,
  error,
  onPasswordChange,
  onTogglePassword,
  onClose,
  onSubmit,
}: {
  order: OrderRecord;
  password: string;
  showPassword: boolean;
  loading: boolean;
  error: string | null;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-paid-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-emerald-400/20 bg-[#15172a] shadow-2xl"
      >
        <div className="border-b border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                <LockKeyhole className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">
                  Main admin confirmation
                </p>

                <h2
                  id="mark-paid-title"
                  className="mt-1 text-xl font-extrabold text-white"
                >
                  Mark order as paid
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info
                label="Order"
                value={order.order_reference}
              />
              <Info
                label="Entrant"
                value={order.purchaser_name || "Not provided"}
              />
              <Info
                label="Amount"
                value={formatMoney(order.total_amount, order.currency)}
              />
              <Info
                label="Tickets to issue"
                value={String(Math.max(1, order.quantity || 1))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/80">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <p>
                This overrides the waiting-payment status. After confirmation,
                the order becomes paid, lottery number(s) are issued and a
                confirmation email is sent to{" "}
                <strong className="text-amber-100">
                  {order.purchaser_email || "the entrant"}
                </strong>.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="main-admin-payment-password"
              className="text-sm font-extrabold text-white"
            >
              Main admin settings password
            </label>

            <div className="relative mt-2">
              <input
                id="main-admin-payment-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  onPasswordChange(event.target.value)
                }
                autoComplete="current-password"
                disabled={loading}
                placeholder="Enter the password set in Admin Settings"
                className="h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 pr-12 text-base text-white outline-none placeholder:text-white/30 focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10 disabled:opacity-50"
              />

              <button
                type="button"
                onClick={onTogglePassword}
                disabled={loading}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-semibold text-red-100"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-extrabold text-white hover:bg-white/10 disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Confirm paid & send email
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/40">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-extrabold text-white">{value}</div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 font-extrabold text-white">{title}</h3>
      {children}
    </section>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="divide-y divide-white/10">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between"
        >
          <span className="text-sm text-white/45">{label}</span>
          <span className="break-all text-sm font-semibold text-white/80">{value}</span>
        </div>
      ))}
    </div>
  );
}

function HistoryList({
  items,
  empty,
}: {
  items: HistoryRecord[];
  empty: string;
}) {
  if (!items.length) return <Empty text={empty} />;

  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-white">{item.label}</span>
            {item.status ? (
              <span className="text-xs text-white/50">{item.status}</span>
            ) : null}
          </div>
          {item.detail ? (
            <p className="mt-1 text-xs leading-5 text-white/55">{item.detail}</p>
          ) : null}
          <p className="mt-1 text-xs text-white/35">{formatDate(item.created_at)}</p>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
      {text}
    </div>
  );
}

function IntegrityRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        ok
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/20 bg-red-500/10 text-red-100"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="text-sm leading-5">{text}</span>
    </div>
  );
}