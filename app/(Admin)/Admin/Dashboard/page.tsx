"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "../components/providers/AdminProvider";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  ClipboardCheck,
  Download,
  Eye,
  LockKeyhole,
  Megaphone,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  Globe,
  Heart,
  LayoutDashboard,
  Mail,
  MessageSquare,
  MousePointerClick,
  PiggyBank,
  RefreshCcw,
  Search,
  Send,
  Star,
  StickyNote,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
  Wallet,
} from "lucide-react";

type DashEvent = {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  is_published: boolean;
};

type DashboardPriority = "low" | "medium" | "high" | "critical";

type DashboardResponse = {
  stats: {
    upcomingEvents: number;
    emailsSent30d: number | null;
    websiteMessages: number | null;
  };
  nextEvents: DashEvent[];
  commandCentre?: DashboardCommandCentre;
  actionItems?: DashboardActionItem[];
  securityWatch?: DashboardSecurityWatch;
  recentActivity?: RecentActivityItem[];
  announcements?: AdminAnnouncement[];
  emailHealth?: EmailHealth;
  formsInbox?: FormsInboxHealth;
  sponsorHealth?: SponsorHealth;
  dailyCheck?: DailyCheckResult;
};

type DashboardCommandCentre = {
  urgentMessages: number;
  unreadEmails: number;
  unpaidBalances: number;
  missingReceipts: number;
  highRiskAuditLogs: number;
  draftPages: number;
  failedSyncs: number;
};

type DashboardActionItem = {
  id: string;
  title: string;
  desc: string;
  href: string;
  area: "forms" | "money" | "events" | "audit" | "email" | "pages" | "donations" | "general";
  priority: DashboardPriority;
  count?: number;
};

type DashboardSecurityWatch = {
  failedLoginsToday: number;
  permissionDeniedToday: number;
  highRiskEventsToday: number;
  criticalEventsToday: number;
  activeAdminsToday: number;
  lastAdminActivityAt: string | null;
};

type DashboardMoneyHealth = {
  totalIn: number | null;
  totalOut: number | null;
  balance: number | null;
  missingReceipts: number;
  uncheckedTransactions: number;
  unpaidPersonalFunds: number;
  pendingRefunds: number;
};


type RecentActivityItem = {
  id: string;
  created_at: string;
  admin_email: string | null;
  action: string;
  area: string;
  risk_level: DashboardPriority;
};

type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  priority: DashboardPriority | "normal";
  created_at: string;
  expires_at?: string | null;
};

type EmailHealth = {
  unread: number;
  needsReply: number;
  drafts: number;
  failedSends: number;
  lastReceivedAt: string | null;
};

type FormsInboxHealth = {
  unread: number;
  stallEnquiries: number;
  volunteerApplications: number;
  complaints: number;
  sponsorEnquiries: number;
  olderThan7Days: number;
};

type SponsorHealth = {
  donationsThisMonth: number | null;
  monthlySupporters: number;
  sponsorApplicationsPending: number;
  sponsorPaymentsOutstanding: number;
  thankYouEmailsPending: number;
};

type DailyCheckResult = {
  ranAt: string;
  status: "good" | "attention" | "urgent";
  summary: string;
  items: DashboardActionItem[];
};

type CommandAction = {
  id: string;
  title: string;
  desc: string;
  href: string;
  keywords: string;
  priority?: DashboardPriority;
};

type QuickStartKey = "email" | "event" | "forms" | "money";

type QuickStartInfo = {
  title: string;
  desc: string;
  href: string;
  button: string;
  icon: ElementType;
};

type ModuleLink = {
  title: string;
  desc: string;
  href: string;
  icon: ElementType;
  badge?: string;
  keywords?: string;
};

type DashboardTask = {
  id: string;
  title: string;
  desc: string;
  href: string;
};

type AdminNote = {
  id: string;
  text: string;
  createdAt: string;
};

type SpotlightLink = {
  title: string;
  desc: string;
  href: string;
  icon: ElementType;
};

const DASHBOARD_TASKS: DashboardTask[] = [
  {
    id: "check-messages",
    title: "Check website messages",
    desc: "Reply to urgent contact forms, stall enquiries, and public questions.",
    href: "/Admin/Dashboard/Forms",
  },
  {
    id: "check-events",
    title: "Check upcoming events",
    desc: "Confirm dates, times, locations, and public event visibility.",
    href: "/Admin/Dashboard/Events",
  },
  {
    id: "check-email",
    title: "Check admin email",
    desc: "Review inbox, committee replies, sponsors, and performer updates.",
    href: "/Admin/Email/Sending",
  },
  {
    id: "check-money",
    title: "Check money tracker",
    desc: "Make sure spending, donations, receipts, and sponsorship are recorded.",
    href: "/Admin/MoneyManagement",
  },
];

const SPOTLIGHT_LINKS: SpotlightLink[] = [
  {
    title: "Launch public website",
    desc: "Open the website exactly as visitors see it.",
    href: "/",
    icon: Eye,
  },
  {
    title: "Send urgent update",
    desc: "Open email admin for committee or public announcements.",
    href: "/Admin/Email/Sending",
    icon: Megaphone,
  },
  {
    title: "Check forms",
    desc: "Review contact forms, stall enquiries, and submissions.",
    href: "/Admin/Dashboard/Forms",
    icon: ClipboardCheck,
  },
  {
    title: "Finance check",
    desc: "Review receipts, donations, sponsors, and spending.",
    href: "/Admin/MoneyManagement",
    icon: PiggyBank,
  },
];

const ADMIN_MODULES: ModuleLink[] = [
  {
    title: "Emails",
    desc: "Send updates, announcements, templates, and committee messages.",
    href: "/Admin/Email/Sending",
    icon: Mail,
    badge: "Comms",
    keywords: "email announcements committee inbox newsletter",
  },
  {
    title: "Events",
    desc: "Create, publish, and manage Burton Pride events.",
    href: "/Admin/Dashboard/Events",
    icon: CalendarDays,
    badge: "Planning",
    keywords: "events dates pride fundraising meetings",
  },
  {
    title: "Forms",
    desc: "Open public website forms and manage submissions.",
    href: "/Admin/Dashboard/Forms",
    icon: FileText,
    badge: "Website",
    keywords: "forms contact submissions applications messages",
  },
  {
    title: "Committee Team",
    desc: "Manage committee members and public team content.",
    href: "/Admin/Dashboard/CommitteeTeam",
    icon: Users,
    badge: "People",
    keywords: "team people committee volunteers",
  },
  {
    title: "Donations",
    desc: "View supporters, donations, and community support.",
    href: "/Admin/Dashboard/Donations",
    icon: Heart,
    badge: "Support",
    keywords: "donations support donate",
  },
  {
    title: "Money Management",
    desc: "Track money in, money out, sponsorship, receipts, and personal funds.",
    href: "/Admin/MoneyManagement",
    icon: Wallet,
    badge: "Finance",
    keywords: "money finance receipts transactions sponsors budget",
  },
  {
    title: "Page Editor",
    desc: "Edit navigation, sidebars, pages, and public website settings.",
    href: "/Admin/Dashboard/Settings/PageEditor",
    icon: LayoutDashboard,
    badge: "Editor",
    keywords: "pages navigation sidebar website editor",
  },
  {
    title: "Settings",
    desc: "Manage admin tools, delete passwords, permissions, and portal settings.",
    href: "/Admin/Dashboard/Settings",
    icon: Settings,
    badge: "Admin",
    keywords: "settings permissions password admin",
  },
];

const PUBLIC_LINKS: ModuleLink[] = [
  {
    title: "Public website",
    desc: "Open the main Burton Pride website.",
    href: "/",
    icon: Globe,
  },
  {
    title: "Donate page",
    desc: "Open the public donation page.",
    href: "/DonateToUs",
    icon: Gift,
  },
];

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatEventDate(value: string) {
  if (!value) return "Date not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not set";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}


function formatNoteDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Saved note";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "not yet";

  const date = new Date(value).getTime();
  if (!Number.isFinite(date)) return "unknown time";

  const diffMs = Date.now() - date;
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];

  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

  for (const [unit, secondsInUnit] of units) {
    if (absSeconds >= secondsInUnit || unit === "second") {
      return formatter.format(Math.round(-diffSeconds / secondsInUnit), unit);
    }
  }

  return "just now";
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}


function titleCase(value: unknown) {
  const text = String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim()
    .toLowerCase();

  if (!text) return "Unknown";

  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDisplayName(value: string) {
  const cleaned = String(value || "")
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nameFromEmail(email: string) {
  if (!email) return "";

  const localPart = email.split("@")[0] || "";

  return formatDisplayName(localPart);
}

const MAX_LOCAL_NOTE_LENGTH = 500;

type AuditRiskLevel = "low" | "medium" | "high" | "critical";

type AuditReportInput = {
  action: string;
  area?: string;
  route?: string | null;
  method?: string;
  status?: string;
  risk_level?: AuditRiskLevel;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown>;
};

function getRoutePermission(href: string) {
  const path = String(href || "").toLowerCase();

  if (!path.startsWith("/admin")) return null;

  if (
    path.includes("/admin/email") ||
    path.includes("/dashboard/email") ||
    path.includes("/dashboard/emails")
  ) {
    return "email:view";
  }

  if (path.includes("/moneymanagement") || path.includes("/admin/money")) {
    return "money:view";
  }

  if (path.includes("/dashboard/forms")) return "contacts:view";
  if (path.includes("/dashboard/donations")) return "donations:view";
  if (path.includes("/dashboard/logs")) return "audit_logs:view";

  if (path.includes("/dashboard/settings/pageeditor")) {
    return "site_pages:manage";
  }

  if (path.includes("/dashboard/settings")) return "admin:users:manage";
  if (path.includes("/dashboard/committeeteam")) return "admin:users:manage";

  if (
    path.includes("/dashboard/windowshowcase") ||
    path.includes("/dashboard/window-showcase") ||
    path.includes("/dashboard/windows-showcase")
  ) {
    return "site_pages:view";
  }

  if (path.includes("/dashboard/events")) return "admin:dashboard:view";
  if (path.includes("/burtonprideeventhub")) return "event_hub:view";
  if (path.includes("/dashboard")) return "admin:dashboard:view";

  return null;
}

function isSensitiveRoute(href: string) {
  const path = String(href || "").toLowerCase();

  return (
    path.includes("/moneymanagement") ||
    path.includes("/admin/money") ||
    path.includes("/dashboard/settings") ||
    path.includes("/dashboard/settings/pageeditor") ||
    path.includes("/dashboard/committeeteam") ||
    path.includes("/dashboard/donations") ||
    path.includes("/dashboard/logs")
  );
}

function canUseRouteWithPermissions(
  href: string,
  permissions: string[] | undefined,
  adminRole: string | null | undefined,
  isMainAdmin: boolean | undefined,
) {
  if (isMainAdmin || adminRole === "main_admin") return true;

  const requiredPermission = getRoutePermission(href);

  if (!requiredPermission) return true;

  return Array.isArray(permissions) && permissions.includes(requiredPermission);
}

async function reportDashboardAudit(input: AuditReportInput) {
  try {
    await fetch("/api/admin/audit-log/report", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        area: "dashboard",
        route: typeof window !== "undefined" ? window.location.pathname : null,
        method: "CLIENT",
        status: "success",
        risk_level: "low",
        ...input,
      }),
    });
  } catch {
    // Audit reporting should never break the dashboard UI.
  }
}


type AdminPopupTone = "warning" | "danger" | "info" | "success";

type AdminSecurityPopupOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  tone?: AdminPopupTone;
  details?: string[];
};

function getPopupToneStyles(tone: AdminPopupTone) {
  if (tone === "danger") {
    return {
      iconBackground: "rgba(239, 68, 68, 0.16)",
      iconBorder: "rgba(252, 165, 165, 0.35)",
      iconColor: "#fecaca",
      confirmBackground: "linear-gradient(135deg, #ef4444, #db2777)",
      confirmText: "#ffffff",
      label: "High security check",
      icon: "!",
    };
  }

  if (tone === "success") {
    return {
      iconBackground: "rgba(16, 185, 129, 0.16)",
      iconBorder: "rgba(110, 231, 183, 0.35)",
      iconColor: "#bbf7d0",
      confirmBackground: "linear-gradient(135deg, #10b981, #14b8a6)",
      confirmText: "#031712",
      label: "Confirmed action",
      icon: "✓",
    };
  }

  if (tone === "info") {
    return {
      iconBackground: "rgba(59, 130, 246, 0.16)",
      iconBorder: "rgba(147, 197, 253, 0.35)",
      iconColor: "#bfdbfe",
      confirmBackground: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
      confirmText: "#ffffff",
      label: "Admin notice",
      icon: "i",
    };
  }

  return {
    iconBackground: "rgba(245, 158, 11, 0.18)",
    iconBorder: "rgba(252, 211, 77, 0.4)",
    iconColor: "#fde68a",
    confirmBackground: "linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)",
    confirmText: "#ffffff",
    label: "Sensitive admin area",
    icon: "!",
  };
}

function showAdminSecurityPopup({
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  showCancel = true,
  tone = "warning",
  details = [],
}: AdminSecurityPopupOptions) {
  if (typeof document === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const toneStyles = getPopupToneStyles(tone);
    const previousOverflow = document.body.style.overflow;

    const overlay = document.createElement("div");
    overlay.setAttribute("role", "presentation");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "99999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "1rem";
    overlay.style.background = "rgba(2, 6, 23, 0.72)";
    overlay.style.backdropFilter = "blur(12px)";

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", title);
    dialog.tabIndex = -1;
    dialog.style.width = "min(34rem, calc(100vw - 2rem))";
    dialog.style.overflow = "hidden";
    dialog.style.borderRadius = "1.75rem";
    dialog.style.border = "1px solid rgba(255, 255, 255, 0.16)";
    dialog.style.background =
      "linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(49, 20, 75, 0.98), rgba(15, 23, 42, 0.98))";
    dialog.style.boxShadow = "0 35px 120px rgba(0, 0, 0, 0.55)";
    dialog.style.color = "white";

    const topBar = document.createElement("div");
    topBar.style.height = "0.35rem";
    topBar.style.background = toneStyles.confirmBackground;
    dialog.appendChild(topBar);

    const content = document.createElement("div");
    content.style.padding = "1.35rem";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.gap = "1rem";
    header.style.alignItems = "flex-start";

    const iconBox = document.createElement("div");
    iconBox.textContent = toneStyles.icon;
    iconBox.style.display = "flex";
    iconBox.style.height = "3rem";
    iconBox.style.width = "3rem";
    iconBox.style.flexShrink = "0";
    iconBox.style.alignItems = "center";
    iconBox.style.justifyContent = "center";
    iconBox.style.borderRadius = "1rem";
    iconBox.style.border = `1px solid ${toneStyles.iconBorder}`;
    iconBox.style.background = toneStyles.iconBackground;
    iconBox.style.color = toneStyles.iconColor;
    iconBox.style.fontSize = "1.4rem";
    iconBox.style.fontWeight = "900";
    header.appendChild(iconBox);

    const copy = document.createElement("div");
    copy.style.minWidth = "0";
    copy.style.flex = "1";

    const label = document.createElement("p");
    label.textContent = toneStyles.label;
    label.style.margin = "0";
    label.style.fontSize = "0.72rem";
    label.style.fontWeight = "900";
    label.style.letterSpacing = "0.18em";
    label.style.textTransform = "uppercase";
    label.style.color = "rgba(255, 255, 255, 0.52)";
    copy.appendChild(label);

    const heading = document.createElement("h2");
    heading.textContent = title;
    heading.style.margin = "0.45rem 0 0";
    heading.style.fontSize = "1.35rem";
    heading.style.lineHeight = "1.25";
    heading.style.fontWeight = "900";
    copy.appendChild(heading);

    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    paragraph.style.margin = "0.75rem 0 0";
    paragraph.style.fontSize = "0.92rem";
    paragraph.style.lineHeight = "1.6";
    paragraph.style.color = "rgba(255, 255, 255, 0.72)";
    copy.appendChild(paragraph);

    if (details.length > 0) {
      const list = document.createElement("ul");
      list.style.margin = "1rem 0 0";
      list.style.padding = "0";
      list.style.display = "grid";
      list.style.gap = "0.45rem";
      list.style.listStyle = "none";

      details.forEach((item) => {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        listItem.style.borderRadius = "0.9rem";
        listItem.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        listItem.style.background = "rgba(0, 0, 0, 0.18)";
        listItem.style.padding = "0.7rem 0.85rem";
        listItem.style.fontSize = "0.78rem";
        listItem.style.fontWeight = "700";
        listItem.style.lineHeight = "1.5";
        listItem.style.color = "rgba(255, 255, 255, 0.66)";
        list.appendChild(listItem);
      });

      copy.appendChild(list);
    }

    header.appendChild(copy);
    content.appendChild(header);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "0.75rem";
    actions.style.marginTop = "1.35rem";

    function makeButton(labelText: string, variant: "cancel" | "confirm") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = labelText;
      button.style.border = "0";
      button.style.borderRadius = "1rem";
      button.style.padding = "0.78rem 1rem";
      button.style.fontSize = "0.86rem";
      button.style.fontWeight = "900";
      button.style.cursor = "pointer";
      button.style.minWidth = "7rem";

      if (variant === "confirm") {
        button.style.background = toneStyles.confirmBackground;
        button.style.color = toneStyles.confirmText;
        button.style.boxShadow = "0 15px 35px rgba(0, 0, 0, 0.28)";
      } else {
        button.style.background = "rgba(255, 255, 255, 0.1)";
        button.style.color = "rgba(255, 255, 255, 0.82)";
      }

      button.addEventListener("mouseenter", () => {
        button.style.filter = "brightness(1.08)";
      });

      button.addEventListener("mouseleave", () => {
        button.style.filter = "none";
      });

      return button;
    }

    const cancelButton = makeButton(cancelLabel, "cancel");
    const confirmButton = makeButton(confirmLabel, "confirm");

    let settled = false;

    function cleanup(result: boolean) {
      if (settled) return;
      settled = true;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      overlay.remove();
      resolve(result);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(false);
      }
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && showCancel) {
        cleanup(false);
      }
    });

    cancelButton.addEventListener("click", () => cleanup(false));
    confirmButton.addEventListener("click", () => cleanup(true));

    if (showCancel) {
      actions.appendChild(cancelButton);
    }

    actions.appendChild(confirmButton);
    content.appendChild(actions);
    dialog.appendChild(content);
    overlay.appendChild(dialog);

    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    window.addEventListener("keydown", handleKeyDown);

    window.setTimeout(() => {
      confirmButton.focus();
      dialog.focus();
    }, 0);
  });
}

async function showNoPermissionPopup(requiredPermission: string | null) {
  await showAdminSecurityPopup({
    title: "Access blocked",
    message:
      "Your admin account does not have permission to open this area. Ask a main admin to update your permissions if you believe this is wrong.",
    confirmLabel: "OK",
    showCancel: false,
    tone: "danger",
    details: requiredPermission
      ? [`Required permission: ${requiredPermission}`]
      : ["This admin area is restricted."],
  });
}

function getSensitiveRouteLabel(href: string) {
  const path = href.toLowerCase();

  if (path.includes("money")) return "Money Management";
  if (path.includes("settings/pageeditor")) return "Page Editor";
  if (path.includes("settings")) return "Admin Settings";
  if (path.includes("committeeteam")) return "Committee Team";
  if (path.includes("donations")) return "Donations";
  if (path.includes("logs")) return "Audit Logs";

  return "Sensitive Admin Area";
}

async function confirmSensitiveRoute(href: string) {
  const routeLabel = getSensitiveRouteLabel(href);

  return showAdminSecurityPopup({
    title: `Open ${routeLabel}?`,
    message:
      "This area may contain sensitive Burton Pride admin records. Only continue if you are authorised and working on committee/admin business.",
    confirmLabel: "Open area",
    cancelLabel: "Stay here",
    tone: "warning",
    details: [
      "This action will be recorded in the admin audit logs.",
      "Do not open sensitive records on shared or public screens.",
      `Route: ${href}`,
    ],
  });
}

function isDashboardResponse(value: unknown): value is DashboardResponse {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  const stats = record.stats as Record<string, unknown> | undefined;

  return Boolean(
    stats && typeof stats === "object" && Array.isArray(record.nextEvents),
  );
}

function safeBooleanRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const output: Record<string, boolean> = {};

  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (typeof key === "string" && typeof item === "boolean") {
      output[key] = item;
    }
  });

  return output;
}

function safeAdminNotes(value: unknown): AdminNote[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const id = String(record.id || "").trim();
      const text = String(record.text || "")
        .trim()
        .slice(0, MAX_LOCAL_NOTE_LENGTH);
      const createdAt = String(record.createdAt || "").trim();

      if (!id || !text) return null;

      return {
        id,
        text,
        createdAt: createdAt || new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .slice(0, 8) as AdminNote[];
}

function readJsonFromLocalStorage(key: string) {
  try {
    const saved = window.localStorage.getItem(key);
    if (!saved) return null;
    return JSON.parse(saved) as unknown;
  } catch {
    return null;
  }
}

function safeNumberValue(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function safeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function fallbackCommandCentre(stats: DashboardResponse["stats"]): DashboardCommandCentre {
  return {
    urgentMessages: stats.websiteMessages || 0,
    unreadEmails: 0,
    unpaidBalances: 0,
    missingReceipts: 0,
    highRiskAuditLogs: 0,
    draftPages: 0,
    failedSyncs: 0,
  };
}

function fallbackSecurityWatch(): DashboardSecurityWatch {
  return {
    failedLoginsToday: 0,
    permissionDeniedToday: 0,
    highRiskEventsToday: 0,
    criticalEventsToday: 0,
    activeAdminsToday: 0,
    lastAdminActivityAt: null,
  };
}

function fallbackMoneyHealth(): DashboardMoneyHealth {
  return {
    totalIn: null,
    totalOut: null,
    balance: null,
    missingReceipts: 0,
    uncheckedTransactions: 0,
    unpaidPersonalFunds: 0,
    pendingRefunds: 0,
  };
}

function fallbackEmailHealth(): EmailHealth {
  return { unread: 0, needsReply: 0, drafts: 0, failedSends: 0, lastReceivedAt: null };
}

function fallbackFormsInbox(stats: DashboardResponse["stats"]): FormsInboxHealth {
  return {
    unread: stats.websiteMessages || 0,
    stallEnquiries: 0,
    volunteerApplications: 0,
    complaints: 0,
    sponsorEnquiries: 0,
    olderThan7Days: 0,
  };
}

function fallbackSponsorHealth(): SponsorHealth {
  return {
    donationsThisMonth: null,
    monthlySupporters: 0,
    sponsorApplicationsPending: 0,
    sponsorPaymentsOutstanding: 0,
    thankYouEmailsPending: 0,
  };
}

function buildActionItems(input: {
  stats: DashboardResponse["stats"];
  commandCentre: DashboardCommandCentre;
  securityWatch: DashboardSecurityWatch;
  moneyHealth: DashboardMoneyHealth;
  formsInbox: FormsInboxHealth;
  sponsorHealth: SponsorHealth;
}): DashboardActionItem[] {
  const items: DashboardActionItem[] = [];

  if (input.formsInbox.unread > 0) {
    items.push({ id: "forms-unread", title: "Review website messages", desc: `${input.formsInbox.unread} public messages may need a reply.`, href: "/Admin/Dashboard/Forms", area: "forms", priority: input.formsInbox.olderThan7Days > 0 ? "high" : "medium", count: input.formsInbox.unread });
  }

  if (input.moneyHealth.missingReceipts > 0) {
    items.push({ id: "money-missing-receipts", title: "Missing receipts", desc: `${input.moneyHealth.missingReceipts} finance records need receipts attached.`, href: "/Admin/MoneyManagement", area: "money", priority: "high", count: input.moneyHealth.missingReceipts });
  }

  if (input.moneyHealth.uncheckedTransactions > 0) {
    items.push({ id: "money-unchecked", title: "Unchecked transactions", desc: `${input.moneyHealth.uncheckedTransactions} transactions need checking.`, href: "/Admin/MoneyManagement", area: "money", priority: "medium", count: input.moneyHealth.uncheckedTransactions });
  }

  if (input.securityWatch.highRiskEventsToday > 0 || input.securityWatch.criticalEventsToday > 0) {
    items.push({ id: "security-risk", title: "Review security activity", desc: `${input.securityWatch.criticalEventsToday} critical and ${input.securityWatch.highRiskEventsToday} high-risk events today.`, href: "/Admin/Dashboard/Logs", area: "audit", priority: input.securityWatch.criticalEventsToday > 0 ? "critical" : "high", count: input.securityWatch.highRiskEventsToday + input.securityWatch.criticalEventsToday });
  }

  if (input.sponsorHealth.sponsorPaymentsOutstanding > 0) {
    items.push({ id: "sponsor-payments", title: "Sponsor payments outstanding", desc: `${input.sponsorHealth.sponsorPaymentsOutstanding} sponsor payments need checking.`, href: "/Admin/Dashboard/Donations", area: "donations", priority: "medium", count: input.sponsorHealth.sponsorPaymentsOutstanding });
  }

  return items.slice(0, 8);
}

function normalisePriority(value: unknown): DashboardPriority {
  const priority = String(value || "").toLowerCase();
  if (priority === "critical" || priority === "high" || priority === "medium" || priority === "low") return priority;
  return "low";
}

function getPriorityTone(priority: DashboardPriority | "normal") {
  if (priority === "critical") return "border-red-300/25 bg-red-500/15 text-red-50";
  if (priority === "high") return "border-amber-300/25 bg-amber-500/15 text-amber-50";
  if (priority === "medium" || priority === "normal") return "border-sky-300/25 bg-sky-500/15 text-sky-50";
  return "border-emerald-300/25 bg-emerald-500/15 text-emerald-50";
}

function SecureLink({
  href,
  className,
  children,
  onClick,
  ...props
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  [key: string]: any;
}) {
  const { permissions, adminRole, isMainAdmin } = useAdmin();
  const allowed = canUseRouteWithPermissions(
    href,
    permissions,
    adminRole,
    isMainAdmin,
  );
  const sensitive = isSensitiveRoute(href);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented) return;

    const requiredPermission = getRoutePermission(href);

    if (!allowed) {
      event.preventDefault();
      void reportDashboardAudit({
        action: "dashboard_route_blocked_client",
        status: "blocked",
        risk_level: "medium",
        target_type: "admin_route",
        target_label: href,
        metadata: {
          required_permission: requiredPermission,
        },
      });
      void showNoPermissionPopup(requiredPermission);
      return;
    }

    if (sensitive) {
      event.preventDefault();
      const confirmed = await confirmSensitiveRoute(href);

      if (!confirmed) {
        void reportDashboardAudit({
          action: "dashboard_sensitive_route_cancelled",
          status: "blocked",
          risk_level: "low",
          target_type: "admin_route",
          target_label: href,
        });
        return;
      }

      void reportDashboardAudit({
        action: "dashboard_sensitive_route_opened",
        status: "success",
        risk_level: "medium",
        target_type: href.startsWith("/Admin") ? "admin_route" : "public_route",
        target_label: href,
        metadata: {
          required_permission: requiredPermission,
        },
      });

      window.location.href = href;
      return;
    }

    void reportDashboardAudit({
      action: "dashboard_route_opened",
      status: "success",
      risk_level: "low",
      target_type: href.startsWith("/Admin") ? "admin_route" : "public_route",
      target_label: href,
      metadata: {
        required_permission: requiredPermission,
      },
    });
  }

  return (
    <Link
      href={allowed ? href : "#"}
      className={className}
      aria-disabled={!allowed}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const {
    admin,
    loading: adminLoading,
    permissions,
    adminRole,
    isMainAdmin,
  } = useAdmin();

  const emailAddress = admin?.email || "";
  const emailName = nameFromEmail(emailAddress);

  const displayName =
    formatDisplayName(admin?.full_name || "") ||
    emailName ||
    "Committee Member";

  const permissionList = useMemo(() => {
    return Array.isArray(permissions) ? permissions : [];
  }, [permissions]);

  const canUsePermission = useCallback(
    (permission: string | null) => {
      if (!permission) return true;
      if (isMainAdmin || adminRole === "main_admin") return true;
      return permissionList.includes(permission);
    },
    [adminRole, isMainAdmin, permissionList],
  );

  const canUseRoute = useCallback(
    (href: string) => {
      return canUseRouteWithPermissions(
        href,
        permissionList,
        adminRole,
        isMainAdmin,
      );
    },
    [adminRole, isMainAdmin, permissionList],
  );

  const secureNavigate = useCallback(
    async (href: string, metadata?: Record<string, unknown>) => {
      const requiredPermission = getRoutePermission(href);

      if (!canUsePermission(requiredPermission)) {
        void reportDashboardAudit({
          action: "dashboard_route_blocked_client",
          status: "blocked",
          risk_level: "medium",
          target_type: "admin_route",
          target_label: href,
          metadata: {
            required_permission: requiredPermission,
            ...metadata,
          },
        });
        void showNoPermissionPopup(requiredPermission);
        return;
      }

      const sensitive = isSensitiveRoute(href);

      if (sensitive) {
        const confirmed = await confirmSensitiveRoute(href);

        if (!confirmed) {
          void reportDashboardAudit({
            action: "dashboard_sensitive_route_cancelled",
            status: "blocked",
            risk_level: "low",
            target_type: "admin_route",
            target_label: href,
            metadata,
          });
          return;
        }
      }

      void reportDashboardAudit({
        action: sensitive
          ? "dashboard_sensitive_route_opened"
          : "dashboard_route_opened",
        status: "success",
        risk_level: sensitive ? "medium" : "low",
        target_type: href.startsWith("/Admin") ? "admin_route" : "public_route",
        target_label: href,
        metadata: {
          required_permission: requiredPermission,
          ...metadata,
        },
      });

      router.push(href);
    },
    [canUsePermission, router],
  );

  const storagePrefix = useMemo(() => {
    const raw = String(admin?.id || emailAddress || "guest").replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );

    return `burton-pride-dashboard-${raw}`;
  }, [admin?.id, emailAddress]);

  const storageKeys = useMemo(
    () => ({
      tasks: `${storagePrefix}-tasks`,
      notes: `${storagePrefix}-notes`,
      favourites: `${storagePrefix}-favourites`,
    }),
    [storagePrefix],
  );

  const [quickStart, setQuickStart] = useState<QuickStartKey>("email");
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(
    {},
  );
  const [now, setNow] = useState(new Date());
  const [adminNotes, setAdminNotes] = useState<AdminNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [favouriteTools, setFavouriteTools] = useState<Record<string, boolean>>(
    {},
  );
  const [privacyMode, setPrivacyMode] = useState(false);
  const [meetingMode, setMeetingMode] = useState(false);
  const [auditHealthy, setAuditHealthy] = useState<boolean | null>(null);
  const [dashboardLoadedAt, setDashboardLoadedAt] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [dailyCheck, setDailyCheck] = useState<DailyCheckResult | null>(null);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentSummary, setIncidentSummary] = useState("");
  const [incidentArea, setIncidentArea] = useState("dashboard");
  const [incidentSeverity, setIncidentSeverity] = useState<DashboardPriority>("medium");

  const [stats, setStats] = useState<DashboardResponse["stats"]>({
    upcomingEvents: 0,
    emailsSent30d: null,
    websiteMessages: null,
  });

  const [nextEvents, setNextEvents] = useState<DashEvent[]>([]);
  const [commandCentre, setCommandCentre] = useState<DashboardCommandCentre>(() => fallbackCommandCentre({ upcomingEvents: 0, emailsSent30d: null, websiteMessages: null }));
  const [securityWatch, setSecurityWatch] = useState<DashboardSecurityWatch>(() => fallbackSecurityWatch());
  const [moneyHealth, setMoneyHealth] = useState<DashboardMoneyHealth>(() => fallbackMoneyHealth());
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [emailHealth, setEmailHealth] = useState<EmailHealth>(() => fallbackEmailHealth());
  const [formsInbox, setFormsInbox] = useState<FormsInboxHealth>(() => fallbackFormsInbox({ upcomingEvents: 0, emailsSent30d: null, websiteMessages: null }));
  const [sponsorHealth, setSponsorHealth] = useState<SponsorHealth>(() => fallbackSponsorHealth());
  const [apiActionItems, setApiActionItems] = useState<DashboardActionItem[]>([]);

  const quickStartInfo: QuickStartInfo = useMemo(() => {
    switch (quickStart) {
      case "email":
        return {
          title: "Send an email",
          desc: "Send updates, announcements, sponsor messages, and committee emails from the admin email area.",
          href: "/Admin/Email/Sending",
          button: "Go to Emails",
          icon: Mail,
        };

      case "event":
        return {
          title: "Create an event",
          desc: "Create and manage Burton Pride events, fundraising days, meetings, and community activity.",
          href: "/Admin/Dashboard/Events",
          button: "Go to Events",
          icon: CalendarDays,
        };

      case "forms":
        return {
          title: "Website forms",
          desc: "Open contact messages, public forms, community submissions, and application enquiries.",
          href: "/Admin/Dashboard/Forms",
          button: "Open Forms",
          icon: FileText,
        };

      case "money":
        return {
          title: "Money management",
          desc: "Track donations, spending, sponsorship funds, personal funds, budgets, and receipts.",
          href: "/Admin/MoneyManagement",
          button: "Open Money Tracker",
          icon: Wallet,
        };
    }
  }, [quickStart]);

  const visibleAdminModules = useMemo(() => {
    return ADMIN_MODULES.filter((item) => canUseRoute(item.href));
  }, [canUseRoute]);

  const filteredModules = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const source = visibleAdminModules;

    if (!query) return source;

    return source.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query) ||
        item.badge?.toLowerCase().includes(query) ||
        item.keywords?.toLowerCase().includes(query)
      );
    });
  }, [searchTerm, visibleAdminModules]);

  const visibleTasks = useMemo(() => {
    return DASHBOARD_TASKS.filter((task) => canUseRoute(task.href));
  }, [canUseRoute]);

  const completedCount = useMemo(() => {
    return visibleTasks.filter((task) => completedTasks[task.id]).length;
  }, [completedTasks, visibleTasks]);

  const completionPercent = visibleTasks.length
    ? Math.round((completedCount / visibleTasks.length) * 100)
    : 0;


  const favouriteModules = useMemo(() => {
    return visibleAdminModules.filter((item) => favouriteTools[item.href]);
  }, [favouriteTools, visibleAdminModules]);

  const urgentCount = useMemo(() => {
    return [
      stats.websiteMessages || 0,
      stats.upcomingEvents || 0,
      commandCentre.urgentMessages,
      commandCentre.highRiskAuditLogs,
      moneyHealth.missingReceipts,
    ].filter((value) => value > 0).length;
  }, [commandCentre, moneyHealth.missingReceipts, stats]);

  const computedActionItems = useMemo(() => {
    const generated = buildActionItems({
      stats,
      commandCentre,
      securityWatch,
      moneyHealth,
      formsInbox,
      sponsorHealth,
    });

    return [...apiActionItems, ...generated]
      .filter((item, index, source) => source.findIndex((other) => other.id === item.id) === index)
      .filter((item) => canUseRoute(item.href))
      .slice(0, 10);
  }, [apiActionItems, canUseRoute, commandCentre, formsInbox, moneyHealth, securityWatch, sponsorHealth, stats]);

  const commandActions = useMemo<CommandAction[]>(() => {
    const core = [
      { id: "emails", title: "Send Email", desc: "Open the email centre", href: "/Admin/Email/Sending", keywords: "email send comms newsletter" },
      { id: "money", title: "Open Money Tracker", desc: "Finance, receipts and sponsorship", href: "/Admin/MoneyManagement", keywords: "money finance receipts sponsors" },
      { id: "forms", title: "Check Website Forms", desc: "Public messages and enquiries", href: "/Admin/Dashboard/Forms", keywords: "forms messages contact enquiries" },
      { id: "audit", title: "View Audit Logs", desc: "Security events and admin activity", href: "/Admin/Dashboard/Logs", keywords: "audit logs security" },
      { id: "events", title: "Manage Events", desc: "Event planning and public event pages", href: "/Admin/Dashboard/Events", keywords: "events pride planning" },
      { id: "page-editor", title: "Open Page Editor", desc: "Website navigation and pages", href: "/Admin/Dashboard/Settings/PageEditor", keywords: "pages editor navigation" },
      { id: "donations", title: "Check Donations", desc: "Supporters and donation records", href: "/Admin/Dashboard/Donations", keywords: "donations supporters" },
      { id: "incident", title: "Report Security Issue", desc: "Create a dashboard security incident record", href: "incident://new", keywords: "incident report security issue", priority: "high" as DashboardPriority },
    ];

    return core.filter((action) => action.href.startsWith("incident://") || canUseRoute(action.href));
  }, [canUseRoute]);

  const filteredCommandActions = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return commandActions;

    return commandActions.filter((action) =>
      [action.title, action.desc, action.href, action.keywords]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [commandActions, commandQuery]);

  const isDashboardDataStale = dashboardLoadedAt
    ? Date.now() - new Date(dashboardLoadedAt).getTime() > 10 * 60 * 1000
    : false;

  const QuickIcon = quickStartInfo.icon;

  const loadDash = useCallback(async () => {
    try {
      setDashLoading(true);
      setDashError(null);

      const res = await fetch(`/api/admin/dashboard?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const json = (await res.json().catch(() => null)) as
        DashboardResponse | { error?: string } | null;

      if (!res.ok) {
        const serverError =
          json && typeof json === "object" && "error" in json
            ? json.error
            : "Failed to load dashboard";

        throw new Error(serverError || "Failed to load dashboard");
      }

      if (!isDashboardResponse(json)) {
        throw new Error("Dashboard API returned an invalid response shape.");
      }

      setStats(
        json.stats || {
          upcomingEvents: 0,
          emailsSent30d: null,
          websiteMessages: null,
        },
      );

      setNextEvents(Array.isArray(json.nextEvents) ? json.nextEvents : []);
      setDashboardLoadedAt(new Date().toISOString());

      const nextStats = json.stats || {
        upcomingEvents: 0,
        emailsSent30d: null,
        websiteMessages: null,
      };

      const nextCommandCentre = json.commandCentre || fallbackCommandCentre(nextStats);
      const nextSecurityWatch = json.securityWatch || fallbackSecurityWatch();
      const nextFormsInbox = json.formsInbox || fallbackFormsInbox(nextStats);
      const nextSponsorHealth = json.sponsorHealth || fallbackSponsorHealth();

      setCommandCentre(nextCommandCentre);
      setSecurityWatch(nextSecurityWatch);

      setRecentActivity(Array.isArray(json.recentActivity) ? json.recentActivity.slice(0, 8) : []);
      setAnnouncements(Array.isArray(json.announcements) ? json.announcements.slice(0, 5) : []);
      setEmailHealth(json.emailHealth || fallbackEmailHealth());
      setFormsInbox(nextFormsInbox);
      setSponsorHealth(nextSponsorHealth);
      setApiActionItems(Array.isArray(json.actionItems) ? json.actionItems.slice(0, 10) : []);
      if (json.dailyCheck) setDailyCheck(json.dailyCheck);

      void reportDashboardAudit({
        action: "dashboard_data_loaded",
        status: "success",
        risk_level: "low",
        metadata: {
          upcoming_events: json.stats?.upcomingEvents ?? null,
          emails_sent_30d_visible: json.stats?.emailsSent30d !== null,
          website_messages_visible: json.stats?.websiteMessages !== null,
        },
      });
    } catch (e: unknown) {
      const safeMessage =
        process.env.NODE_ENV === "development" && e instanceof Error
          ? e.message
          : "Dashboard data could not be loaded. Please try again or contact a main admin.";

      setDashError(safeMessage);

      void reportDashboardAudit({
        action: "dashboard_data_load_failed",
        status: "error",
        risk_level: "medium",
        metadata: {
          error: e instanceof Error ? e.message : "Unknown dashboard API error",
        },
      });
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDash();
  }, [loadDash]);

  useEffect(() => {
    void reportDashboardAudit({
      action: "dashboard_viewed",
      status: "success",
      risk_level: "low",
      metadata: {
        admin_email_visible: Boolean(emailAddress),
        admin_role: adminRole || null,
        permissions_count: permissionList.length,
        is_main_admin: Boolean(isMainAdmin),
      },
    });
  }, [adminRole, emailAddress, isMainAdmin, permissionList.length]);

  useEffect(() => {
    async function checkAuditHealth() {
      try {
        const response = await fetch("/api/admin/audit-log?limit=1", {
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        setAuditHealthy(response.ok);
      } catch {
        setAuditHealthy(false);
      }
    }

    void checkAuditHealth();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleKeys(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.target instanceof HTMLTextAreaElement) return;

      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setCommandOpen(true);
        void reportDashboardAudit({
          action: "dashboard_command_palette_opened",
          status: "success",
          risk_level: "low",
        });
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (key === "escape") {
        setCommandOpen(false);
        setIncidentOpen(false);
        return;
      }

      if (key === "e") {
        secureNavigate("/Admin/Email/Sending", { keyboard_shortcut: "e" });
      }

      if (key === "m") {
        secureNavigate("/Admin/MoneyManagement", { keyboard_shortcut: "m" });
      }

      if (key === "f") {
        secureNavigate("/Admin/Dashboard/Forms", { keyboard_shortcut: "f" });
      }

      if (key === "r") {
        void reportDashboardAudit({
          action: "dashboard_keyboard_refresh_used",
          status: "success",
          risk_level: "low",
        });
        void loadDash();
      }
    }

    window.addEventListener("keydown", handleKeys);

    return () => window.removeEventListener("keydown", handleKeys);
  }, [loadDash, secureNavigate]);

  useEffect(() => {
    const savedTasks = readJsonFromLocalStorage(storageKeys.tasks);
    const savedNotes = readJsonFromLocalStorage(storageKeys.notes);
    const savedFavourites = readJsonFromLocalStorage(storageKeys.favourites);

    setCompletedTasks(safeBooleanRecord(savedTasks));
    setAdminNotes(safeAdminNotes(savedNotes));
    setFavouriteTools(safeBooleanRecord(savedFavourites));
  }, [storageKeys]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeys.tasks, JSON.stringify(completedTasks));
    } catch {
      // Ignore localStorage failures
    }
  }, [completedTasks, storageKeys.tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeys.notes, JSON.stringify(adminNotes));
    } catch {
      // Ignore localStorage failures
    }
  }, [adminNotes, storageKeys.notes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKeys.favourites,
        JSON.stringify(favouriteTools),
      );
    } catch {
      // Ignore localStorage failures
    }
  }, [favouriteTools, storageKeys.favourites]);

  function toggleTask(taskId: string) {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));

    void reportDashboardAudit({
      action: "dashboard_task_toggled",
      status: "success",
      risk_level: "low",
      target_type: "dashboard_task",
      target_id: taskId,
      target_label: taskId,
    });
  }

  function resetTasks() {
    setCompletedTasks({});

    void reportDashboardAudit({
      action: "dashboard_tasks_reset",
      status: "success",
      risk_level: "low",
    });
  }

  function toggleFavourite(href: string) {
    if (!canUseRoute(href)) {
      void reportDashboardAudit({
        action: "dashboard_favourite_blocked_no_permission",
        status: "blocked",
        risk_level: "medium",
        target_type: "admin_route",
        target_label: href,
        metadata: {
          required_permission: getRoutePermission(href),
        },
      });
      return;
    }

    setFavouriteTools((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));

    void reportDashboardAudit({
      action: "dashboard_favourite_toggled",
      status: "success",
      risk_level: "low",
      target_type: "admin_route",
      target_label: href,
      metadata: {
        required_permission: getRoutePermission(href),
      },
    });
  }

  function addNote() {
    const text = noteText.trim().slice(0, MAX_LOCAL_NOTE_LENGTH);

    if (!text) return;

    setAdminNotes((prev) =>
      [
        {
          id: `${Date.now()}`,
          text,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 8),
    );

    setNoteText("");

    void reportDashboardAudit({
      action: "dashboard_local_note_added",
      status: "success",
      risk_level: "medium",
      metadata: {
        note_length: text.length,
        note_saved_to: "localStorage",
        max_note_length: MAX_LOCAL_NOTE_LENGTH,
      },
    });
  }

  function deleteNote(noteId: string) {
    setAdminNotes((prev) => prev.filter((note) => note.id !== noteId));

    void reportDashboardAudit({
      action: "dashboard_local_note_deleted",
      status: "success",
      risk_level: "medium",
      target_type: "local_dashboard_note",
      target_id: noteId,
    });
  }

  function clearLocalDashboardData() {
    setCompletedTasks({});
    setAdminNotes([]);
    setFavouriteTools({});

    try {
      localStorage.removeItem(storageKeys.tasks);
      localStorage.removeItem(storageKeys.notes);
      localStorage.removeItem(storageKeys.favourites);
    } catch {
      // Ignore localStorage failures
    }

    void reportDashboardAudit({
      action: "dashboard_local_data_cleared",
      status: "success",
      risk_level: "medium",
    });
  }

  function runDailyCheck() {
    const items = computedActionItems.slice(0, 8);
    const criticalOrHigh = items.filter(
      (item) => item.priority === "critical" || item.priority === "high",
    ).length;

    const result: DailyCheckResult = {
      ranAt: new Date().toISOString(),
      status: criticalOrHigh > 0 ? "urgent" : items.length > 0 ? "attention" : "good",
      summary:
        items.length > 0
          ? `${items.length} dashboard checks need attention.`
          : "No urgent dashboard checks are showing from the loaded data.",
      items,
    };

    setDailyCheck(result);

    void reportDashboardAudit({
      action: "dashboard_daily_check_ran",
      status: "success",
      risk_level: criticalOrHigh > 0 ? "medium" : "low",
      metadata: {
        result_status: result.status,
        item_count: result.items.length,
        high_or_critical_count: criticalOrHigh,
      },
    });
  }

  async function submitIncident() {
    const summary = incidentSummary.trim();

    if (!summary) {
      await showAdminSecurityPopup({
        title: "Incident summary needed",
        message: "Please add a short summary before reporting a security issue.",
        confirmLabel: "OK",
        showCancel: false,
        tone: "danger",
      });
      return;
    }

    void reportDashboardAudit({
      action: "dashboard_security_incident_reported",
      status: "success",
      risk_level: incidentSeverity,
      target_type: "security_incident",
      target_label: incidentArea,
      metadata: {
        incident_area: incidentArea,
        incident_summary: summary.slice(0, 500),
        reported_from: "dashboard_incident_button",
      },
    });

    setIncidentSummary("");
    setIncidentArea("dashboard");
    setIncidentSeverity("medium");
    setIncidentOpen(false);

    await showAdminSecurityPopup({
      title: "Security issue reported",
      message: "This has been written to the admin audit logs. A main admin should review it.",
      confirmLabel: "OK",
      showCancel: false,
      tone: "success",
      details: [`Area: ${incidentArea}`, `Severity: ${incidentSeverity}`],
    });
  }

  function runCommand(action: CommandAction) {
    setCommandOpen(false);
    setCommandQuery("");

    if (action.href === "incident://new") {
      setIncidentOpen(true);
      void reportDashboardAudit({
        action: "dashboard_command_incident_opened",
        status: "success",
        risk_level: "medium",
      });
      return;
    }

    void secureNavigate(action.href, {
      command_palette_action: action.id,
    });
  }

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-hidden px-3 py-5 text-white sm:px-6 lg:px-8">
      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        actions={filteredCommandActions}
        onQueryChange={setCommandQuery}
        onClose={() => setCommandOpen(false)}
        onRun={runCommand}
      />

      <IncidentModal
        open={incidentOpen}
        summary={incidentSummary}
        area={incidentArea}
        severity={incidentSeverity}
        onSummaryChange={setIncidentSummary}
        onAreaChange={setIncidentArea}
        onSeverityChange={setIncidentSeverity}
        onClose={() => setIncidentOpen(false)}
        onSubmit={() => void submitIncident()}
      />

      <div className="mx-auto w-full max-w-[96rem] min-w-0 space-y-6 sm:space-y-8">
        <section className="relative w-full max-w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0d0d1a]/90 p-4 shadow-2xl backdrop-blur-xl sm:rounded-[2.25rem] sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-blue-500/20" />
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-pink-400/20 blur-3xl" />
          <div className="absolute -bottom-28 left-10 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative z-10 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] xl:items-end">
            <div>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/80">
                  <ShieldCheck className="h-4 w-4" />
                  Committee Admin Portal
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  Live Workspace
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-blue-100">
                  <LockKeyhole className="h-4 w-4" />
                  {isMainAdmin || adminRole === "main_admin"
                    ? "Main Admin"
                    : `${permissionList.length} permissions`}
                </div>
              </div>

              <h1 className="mt-6 max-w-5xl break-words text-3xl font-black leading-tight sm:text-5xl lg:text-7xl">
                {getGreeting()},{" "}
                <span className="bg-gradient-to-r from-pink-200 via-white to-blue-200 bg-clip-text text-transparent">
                  {adminLoading ? "Loading..." : displayName}
                </span>
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg">
                Your Burton Pride command centre for emails, events, forms,
                donations, money tracking, and community
                work — all in one clean dashboard.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-white/70">
                <span className="rounded-full bg-white/10 px-3 py-2">
                  {getTodayLabel()}
                </span>

                <span className="rounded-full bg-white/10 px-3 py-2">
                  {now.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                {emailAddress && (
                  <span className="max-w-full break-words rounded-full bg-white/10 px-3 py-2">
                    Signed in as{" "}
                    {privacyMode ? "Hidden for privacy" : emailAddress}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPrivacyMode((value) => !value);
                    void reportDashboardAudit({
                      action: privacyMode
                        ? "dashboard_privacy_mode_disabled"
                        : "dashboard_privacy_mode_enabled",
                      status: "success",
                      risk_level: "low",
                    });
                  }}
                  className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  {privacyMode ? "Show details" : "Privacy mode"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMeetingMode((value) => !value);
                    void reportDashboardAudit({
                      action: meetingMode
                        ? "dashboard_meeting_mode_disabled"
                        : "dashboard_meeting_mode_enabled",
                      status: "success",
                      risk_level: "low",
                    });
                  }}
                  className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  {meetingMode ? "Exit meeting mode" : "Meeting mode"}
                </button>

                <DataFreshnessPill loadedAt={dashboardLoadedAt} stale={isDashboardDataStale} />

                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  Ctrl + K command bar
                </button>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <TopButton href="/Admin/Email/Sending" icon={Send}>
                  Send Email
                </TopButton>

                <TopButton href="/Admin/Dashboard/Events" icon={CalendarDays}>
                  Create Event
                </TopButton>

                <TopButton href="/Admin/MoneyManagement" icon={Wallet}>
                  Money Tracker
                </TopButton>

                <TopButton href="/" icon={ExternalLink}>
                  Website
                </TopButton>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
                    Today’s progress
                  </p>
                  <h2 className="mt-2 text-3xl font-black">
                    {completedCount}/{visibleTasks.length} done
                  </h2>
                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-purple-700">
                  <Sparkles className="h-8 w-8" />
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>

              <p className="mt-4 text-sm leading-6 text-white/65">
                Start with messages, money, and event checks so the committee
                can see what needs attention today.
              </p>
            </div>
          </div>
        </section>

        {announcements.length > 0 ? (
          <AnnouncementPanel announcements={announcements} meetingMode={meetingMode} />
        ) : null}

        <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CommandCentreCard
            title="Urgent messages"
            value={commandCentre.urgentMessages}
            desc="Public messages that may need a reply."
            href="/Admin/Dashboard/Forms"
            icon={MessageSquare}
            priority={commandCentre.urgentMessages > 0 ? "medium" : "low"}
          />
          <CommandCentreCard
            title="Security watch"
            value={commandCentre.highRiskAuditLogs}
            desc="High-risk audit events needing review."
            href="/Admin/Dashboard/Logs"
            icon={LockKeyhole}
            priority={commandCentre.highRiskAuditLogs > 0 ? "high" : "low"}
          />
          <CommandCentreCard
            title="Missing receipts"
            value={commandCentre.missingReceipts || moneyHealth.missingReceipts}
            desc="Finance records that need receipts."
            href="/Admin/MoneyManagement"
            icon={PiggyBank}
            priority={(commandCentre.missingReceipts || moneyHealth.missingReceipts) > 0 ? "high" : "low"}
          />
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Needs action</h2>
                <p className="mt-1 text-sm text-white/60">
                  Real dashboard checks generated from loaded admin data.
                </p>
              </div>
              <button
                type="button"
                onClick={runDailyCheck}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
              >
                Run daily check
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {computedActionItems.length === 0 ? (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-50 md:col-span-2">
                  No urgent action items are showing from the loaded dashboard data.
                </div>
              ) : (
                computedActionItems.map((item) => (
                  <ActionItemCard key={item.id} item={item} />
                ))
              )}
            </div>
          </Card>

          <DailyCheckCard result={dailyCheck} onRun={runDailyCheck} />
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-3">
          <SecurityWatchCard data={securityWatch} />
          <CommunicationHealthCard
            emailHealth={emailHealth}
            formsInbox={formsInbox}
            sponsorHealth={sponsorHealth}
            meetingMode={meetingMode}
          />
        </section>

        <section className="grid min-w-0 gap-6">
          <RecentActivityCard activity={recentActivity} meetingMode={meetingMode} />
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <PermissionAccessPanel
            canUsePermission={canUsePermission}
            isMainAdmin={Boolean(isMainAdmin || adminRole === "main_admin")}
          />
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Incident and command tools</h2>
                <p className="mt-1 text-sm text-white/60">
                  Report security issues or open the command palette without using the sidebar.
                </p>
              </div>
              <ShieldCheck className="h-6 w-6 text-white/40" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIncidentOpen(true)}
                className="rounded-2xl border border-red-300/20 bg-red-500/10 p-5 text-left transition hover:bg-red-500/20"
              >
                <div className="font-black text-red-50">Report security issue</div>
                <p className="mt-2 text-xs leading-5 text-red-50/70">
                  Create a high-priority audit record for anything suspicious.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="rounded-2xl border border-white/10 bg-black/20 p-5 text-left transition hover:bg-black/30"
              >
                <div className="font-black">Open command bar</div>
                <p className="mt-2 text-xs leading-5 text-white/60">
                  Search tools, actions and secure routes. Shortcut: Ctrl + K.
                </p>
              </button>
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Emails sent"
            value={dashLoading ? "…" : safeNumber(stats.emailsSent30d)}
            sub="Last 30 days"
            icon={Mail}
            tone="pink"
            href="/Admin/Email/Sending"
          />

          <StatCard
            title="Upcoming events"
            value={dashLoading ? "…" : String(stats.upcomingEvents)}
            sub="Events in database"
            icon={CalendarDays}
            tone="blue"
            href="/Admin/Dashboard/Events"
          />

          <StatCard
            title="Website messages"
            value={dashLoading ? "…" : safeNumber(stats.websiteMessages)}
            sub="Contact submissions"
            icon={MessageSquare}
            tone="green"
            href="/Admin/Dashboard/Forms"
          />
        </section>

        <section className="grid min-w-0 gap-6">

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Command shortcuts</h2>
                <p className="mt-1 text-sm text-white/60">
                  Big action buttons for the jobs used most often.
                </p>
              </div>

              <Zap className="h-6 w-6 text-white/40" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SPOTLIGHT_LINKS.map((item) => (
                <SpotlightCard key={item.title} item={item} />
              ))}
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">What needs attention</h2>
                <p className="mt-1 text-sm text-white/60">
                  A simple snapshot of the areas that normally need checking
                  first.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadDash()}
                disabled={dashLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCcw
                  className={dashLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                />
                Refresh
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <AttentionCard
                title="Messages"
                value={dashLoading ? "…" : safeNumber(stats.websiteMessages)}
                desc="Public enquiries"
                href="/Admin/Dashboard/Forms"
                icon={MessageSquare}
              />
              <AttentionCard
                title="Events"
                value={dashLoading ? "…" : String(stats.upcomingEvents)}
                desc="Upcoming dates"
                href="/Admin/Dashboard/Events"
                icon={CalendarDays}
              />
              <AttentionCard
                title="Finance"
                value="Open"
                desc="Receipts and spending"
                href="/Admin/MoneyManagement"
                icon={Wallet}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/65">
              {dashError ? (
                <span className="font-bold text-red-100">
                  Dashboard API error: {dashError}
                </span>
              ) : (
                <span>
                  {urgentCount > 0
                    ? "There is live dashboard data to review. Open each area and check nothing urgent has been missed."
                    : "No urgent dashboard numbers are showing yet. Refresh after adding events, forms, or entries."}
                </span>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">System status</h2>
                <p className="mt-1 text-sm text-white/60">
                  Portal health and connection checks.
                </p>
              </div>

              <StatusPill loading={dashLoading} error={dashError} />
            </div>

            <div className="mt-6 space-y-3">
              <HealthRow
                title="Authentication"
                desc={
                  adminLoading
                    ? "Checking admin session"
                    : "Supabase admin loaded"
                }
                ok={!adminLoading && !!admin}
              />
              <HealthRow
                title="Dashboard API"
                desc={dashError ? dashError : "Dashboard API reachable"}
                ok={!dashError}
              />
              <HealthRow
                title="Events"
                desc={`${stats.upcomingEvents || 0} upcoming events`}
                ok={!dashError}
              />
              <HealthRow
                title="Admin routes"
                desc="Protected committee area"
                ok
              />
              <HealthRow
                title="Audit logs"
                desc={
                  auditHealthy === null
                    ? "Checking audit log system"
                    : auditHealthy
                      ? "Audit log API reachable"
                      : "Audit log API has a problem"
                }
                ok={auditHealthy === true}
              />
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Quick start</h2>
                <p className="mt-1 text-sm text-white/60">
                  Pick the work area you want and open it straight away.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/70">
                <Sparkles className="h-4 w-4" />
                Fast actions
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <QuickPick
                title="Emails"
                desc="Send updates and announcements"
                icon={Mail}
                active={quickStart === "email"}
                onClick={() => setQuickStart("email")}
                onOpen={() => secureNavigate("/Admin/Email/Sending")}
              />

              <QuickPick
                title="Events"
                desc="Create and manage events"
                icon={CalendarDays}
                active={quickStart === "event"}
                onClick={() => setQuickStart("event")}
                onOpen={() => secureNavigate("/Admin/Dashboard/Events")}
              />

              <QuickPick
                title="Forms"
                desc="Website forms and messages"
                icon={FileText}
                active={quickStart === "forms"}
                onClick={() => setQuickStart("forms")}
                onOpen={() => secureNavigate("/Admin/Dashboard/Forms")}
              />

              <QuickPick
                title="Money"
                desc="Track finance and receipts"
                icon={Wallet}
                active={quickStart === "money"}
                onClick={() => setQuickStart("money")}
                onOpen={() => secureNavigate("/Admin/MoneyManagement")}
              />
            </div>
          </Card>

          <Card>
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
              <QuickIcon className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-2xl font-black">{quickStartInfo.title}</h2>

            <p className="mt-3 text-sm leading-6 text-white/70">
              {quickStartInfo.desc}
            </p>

            <SecureLink
              href={quickStartInfo.href}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
            >
              {quickStartInfo.button}
              <ArrowRight className="h-4 w-4" />
            </SecureLink>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/60">
              Keyboard shortcuts: press E for Emails, M for Money, F for Forms,
              and R to refresh.
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Admin tools</h2>
                <p className="mt-1 text-sm text-white/60">
                  Search and open the main areas of the admin portal.
                </p>
              </div>

              <div className="relative w-full sm:w-96">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search emails, money, forms..."
                  className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:bg-black/30"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {filteredModules.map((item) => (
                <ModuleCard
                  key={item.title}
                  item={item}
                  isFavourite={favouriteTools[item.href] === true}
                  onToggleFavourite={() => toggleFavourite(item.href)}
                />
              ))}

              {filteredModules.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60 md:col-span-2">
                  No tools found for “{searchTerm}”.
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Today’s checklist</h2>
                <p className="mt-1 text-sm text-white/60">
                  {completedCount} of {visibleTasks.length} done
                </p>
              </div>

              <button
                type="button"
                onClick={resetTasks}
                className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                Reset
              </button>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-300 transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {visibleTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  checked={completedTasks[task.id] === true}
                  onToggle={() => toggleTask(task.id)}
                />
              ))}
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Upcoming events</h2>
                <p className="mt-1 text-sm text-white/60">
                  Next events pulled from the dashboard API.
                </p>
              </div>

              <SecureLink
                href="/Admin/Dashboard/Events"
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
              >
                Manage →
              </SecureLink>
            </div>

            <div className="mt-6 space-y-3">
              {dashError && <ListRow title="Error" meta={dashError} />}

              {!dashLoading && !dashError && nextEvents.length === 0 && (
                <ListRow title="No events yet" meta="Add your first event" />
              )}

              {dashLoading &&
                !dashError &&
                [0, 1, 2].map((i) => (
                  <ListRow key={i} title="Loading…" meta="Please wait" muted />
                ))}

              {!dashLoading &&
                !dashError &&
                nextEvents.map((ev) => (
                  <ListRow
                    key={ev.id}
                    title={ev.title}
                    meta={`${formatEventDate(ev.start_at)}${
                      ev.location ? ` • ${ev.location}` : ""
                    }`}
                    badge={ev.is_published ? "Published" : "Draft"}
                  />
                ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Quick actions</h2>
            <p className="mt-1 text-sm text-white/60">
              Common admin shortcuts.
            </p>

            <div className="mt-6 grid gap-3">
              <ActionButton
                href="/Admin/Email/Sending"
                title="Emails"
                desc="Send updates and announcements"
                icon={Mail}
              />

              <ActionButton
                href="/Admin/Dashboard/Events"
                title="Events"
                desc="Create and manage events"
                icon={CalendarDays}
              />

              <ActionButton
                href="/Admin/Dashboard/Forms"
                title="Forms"
                desc="Open all website forms"
                icon={FileText}
              />

              <ActionButton
                href="/Admin/MoneyManagement"
                title="Money Tracker"
                desc="Track income and spending"
                icon={Wallet}
              />
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Favourite tools</h2>
                <p className="mt-1 text-sm text-white/60">
                  Star tools in Admin tools and they appear here.
                </p>
              </div>

              <Bookmark className="h-6 w-6 text-white/40" />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {favouriteModules.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/60 md:col-span-2">
                  No favourite tools yet. Press the star beside any admin tool
                  to pin it here for faster access.
                </div>
              ) : (
                favouriteModules.map((item) => (
                  <ActionButton
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    desc={item.desc}
                    icon={item.icon}
                  />
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Local browser notes</h2>
                <p className="mt-1 text-sm text-white/60">
                  Do not save personal, financial, safeguarding or confidential
                  committee information here.
                </p>
              </div>

              <StickyNote className="h-6 w-6 text-white/40" />
            </div>

            <div className="mt-6 space-y-3">
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="Add a quick committee note..."
                maxLength={MAX_LOCAL_NOTE_LENGTH}
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:bg-black/30"
              />

              <div className="flex items-center justify-between gap-3 text-xs text-white/45">
                <span>Saved only in this browser for this admin account.</span>
                <span>
                  {noteText.length}/{MAX_LOCAL_NOTE_LENGTH}
                </span>
              </div>

              <button
                type="button"
                onClick={addNote}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
              >
                Save note
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={clearLocalDashboardData}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-50 transition hover:bg-red-500/20"
              >
                Clear local dashboard data
                <LockKeyhole className="h-4 w-4" />
              </button>

              <div className="space-y-2">
                {adminNotes.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/55">
                    No notes saved yet.
                  </div>
                ) : (
                  adminNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={() => deleteNote(note.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-3">
          <Card>
            <h2 className="text-2xl font-black">Finance centre</h2>
            <p className="mt-1 text-sm text-white/60">
              Fast links for money management.
            </p>

            <div className="mt-6 grid gap-3">
              <ActionButton
                href="/Admin/MoneyManagement"
                title="Money Home"
                desc="Open finance dashboard"
                icon={Wallet}
              />
              <ActionButton
                href="/Admin/Money/TrackingMoney"
                title="Tracking Money"
                desc="Add transactions and receipts"
                icon={PiggyBank}
              />
              <ActionButton
                href="/Admin/Dashboard/Donations"
                title="Donations"
                desc="View donation supporters"
                icon={Heart}
              />
              <ActionButton
                href="/Admin/Money/Cards"
                title="Cards"
                desc="Manage payment cards"
                icon={CreditCard}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Public pages</h2>
            <p className="mt-1 text-sm text-white/60">
              Open public website pages quickly.
            </p>

            <div className="mt-6 grid gap-3">
              {PUBLIC_LINKS.map((item) => (
                <ActionButton
                  key={item.title}
                  href={item.href}
                  title={item.title}
                  desc={item.desc}
                  icon={item.icon}
                />
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Best next steps</h2>
            <p className="mt-1 text-sm text-white/60">
              Useful things to check today.
            </p>

            <div className="mt-6 space-y-3">
              <NextStep
                title="Check messages"
                desc="Make sure no public enquiry has been missed."
                href="/Admin/Dashboard/Forms"
              />

              <NextStep
                title="Review money tracker"
                desc="Check all spending and sponsorship notes."
                href="/Admin/MoneyManagement"
              />

              <NextStep
                title="Check events"
                desc="Make sure published event details are correct."
                href="/Admin/Dashboard/Events"
              />
            </div>
          </Card>
        </section>

        <section className="grid min-w-0 gap-6 lg:grid-cols-3">
          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-100">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-black">Security reminder</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Check who is logged in before making money changes, deleting
              records, sending bulk emails, or changing public pages.
            </p>
          </Card>

          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-100">
              <Download className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-black">Export checks</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Before committee meetings, download finance reports, audit logs,
              donation records, and transaction exports.
            </p>
            <SecureLink
              href="/Admin/MoneyManagement"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              Open exports
              <ArrowRight className="h-4 w-4" />
            </SecureLink>
          </Card>

          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-black">Committee handover</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">
              Use this dashboard as the daily handover: messages, events,
              finance, notes, and urgent checks are all visible in one place.
            </p>
          </Card>
        </section>

        <section className="rounded-[2rem] border border-yellow-300/20 bg-[#17140d]/90 p-5 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-300/20 text-yellow-100">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-yellow-50">
                Admin Dashboard Beta
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                This dashboard is still in beta, but it is now built to feel
                more like a proper admin command centre. If you find an issue,
                report it to{" "}
                <span className="font-black text-white">
                  cameronlowndes@gmail.com
                </span>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="relative w-full max-w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#11111f]/85 p-4 shadow-2xl backdrop-blur-xl sm:rounded-[2rem] sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-blue-500/10" />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-pink-400/15 blur-3xl" />
          <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/70">
                <Users className="h-4 w-4" />
                Community First
              </div>

              <h2 className="mt-4 text-3xl font-black">
                Created by the community, for the community.
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
                Burton Pride is grassroots, community-led, and powered by local
                people. This dashboard keeps admin work organised so more time
                can go back into community benefit.
              </p>
            </div>

            <SecureLink
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
            >
              View public website
              <ExternalLink className="h-4 w-4" />
            </SecureLink>
          </div>
        </section>
      </div>
    </div>
  );
}


function DataFreshnessPill({ loadedAt, stale }: { loadedAt: string | null; stale: boolean }) {
  return (
    <span
      className={[
        "rounded-full px-3 py-2 text-xs font-black",
        stale ? "bg-amber-400/20 text-amber-100" : "bg-white/10 text-white/70",
      ].join(" ")}
    >
      {loadedAt ? `Refreshed ${formatRelativeTime(loadedAt)}` : "Not refreshed yet"}
      {stale ? " · stale" : ""}
    </span>
  );
}

function PriorityPill({ priority }: { priority: DashboardPriority | "normal" }) {
  return (
    <span
      className={[
        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
        getPriorityTone(priority),
      ].join(" ")}
    >
      {priority}
    </span>
  );
}

function CommandCentreCard({
  title,
  value,
  desc,
  href,
  icon: Icon,
  priority,
}: {
  title: string;
  value: number;
  desc: string;
  href: string;
  icon: ElementType;
  priority: DashboardPriority;
}) {
  return (
    <SecureLink
      href={href}
      className="group rounded-[1.5rem] border border-white/10 bg-[#11111f]/85 p-5 shadow-xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-[#171729]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-white/45">{title}</div>
          <div className="mt-3 text-4xl font-black text-white">{value}</div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white transition group-hover:bg-white group-hover:text-purple-700">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/60">{desc}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <PriorityPill priority={priority} />
        <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:text-white" />
      </div>
    </SecureLink>
  );
}

function ActionItemCard({ item }: { item: DashboardActionItem }) {
  return (
    <SecureLink
      href={item.href}
      className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:bg-black/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-black text-white">{item.title}</div>
          <p className="mt-1 text-xs leading-5 text-white/60">{item.desc}</p>
        </div>
        <PriorityPill priority={item.priority} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-black text-white/45">
        <span>{titleCase(item.area)}</span>
        <span>{item.count ?? "Open"} →</span>
      </div>
    </SecureLink>
  );
}

function DailyCheckCard({ result, onRun }: { result: DailyCheckResult | null; onRun: () => void }) {
  const tone = result?.status === "urgent" ? "border-red-300/20 bg-red-500/10" : result?.status === "attention" ? "border-amber-300/20 bg-amber-500/10" : "border-emerald-300/20 bg-emerald-500/10";

  return (
    <Card className={tone}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Daily admin check</h2>
          <p className="mt-1 text-sm text-white/60">One-click operational review for today.</p>
        </div>
        <button
          type="button"
          onClick={onRun}
          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 transition hover:scale-[1.01] active:scale-[0.99]"
        >
          Run
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="font-black">{result ? titleCase(result.status) : "Not run yet"}</div>
          {result ? <PriorityPill priority={result.status === "urgent" ? "high" : result.status === "attention" ? "medium" : "low"} /> : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-white/65">
          {result ? result.summary : "Run this at the start of an admin session to find what needs attention."}
        </p>
        {result?.ranAt ? (
          <p className="mt-2 text-xs font-bold text-white/35">Ran {formatRelativeTime(result.ranAt)}</p>
        ) : null}
      </div>
    </Card>
  );
}

function SecurityWatchCard({ data }: { data: DashboardSecurityWatch }) {
  const risky = data.criticalEventsToday > 0 || data.highRiskEventsToday > 0 || data.failedLoginsToday > 3;

  return (
    <Card className={risky ? "border-red-300/20 bg-red-500/10" : ""}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Security Watch</h2>
          <p className="mt-1 text-sm text-white/60">Live audit signals from today.</p>
        </div>
        <LockKeyhole className="h-6 w-6 text-white/40" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MiniStat title="Failed logins" value={data.failedLoginsToday} />
        <MiniStat title="Permission blocks" value={data.permissionDeniedToday} />
        <MiniStat title="High risk" value={data.highRiskEventsToday} />
        <MiniStat title="Active admins" value={data.activeAdminsToday} />
      </div>
      <p className="mt-4 text-xs leading-5 text-white/50">
        Last activity: {data.lastAdminActivityAt ? formatRelativeTime(data.lastAdminActivityAt) : "not available"}
      </p>
      <SecureLink
        href="/Admin/Dashboard/Settings/AdminAuditTracker"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/20 hover:text-white"
      >
        Open audit logs <ArrowRight className="h-4 w-4" />
      </SecureLink>
    </Card>
  );
}

function MiniStat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-bold text-white/45">{title}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}




function CommunicationHealthCard({
  emailHealth,
  formsInbox,
  sponsorHealth,
  meetingMode,
}: {
  emailHealth: EmailHealth;
  formsInbox: FormsInboxHealth;
  sponsorHealth: SponsorHealth;
  meetingMode: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Comms and Support</h2>
          <p className="mt-1 text-sm text-white/60">Emails, forms, sponsors and donations.</p>
        </div>
        <Mail className="h-6 w-6 text-white/40" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MiniStat title="Unread emails" value={emailHealth.unread} />
        <MiniStat title="Needs reply" value={emailHealth.needsReply} />
        <MiniStat title="Form messages" value={formsInbox.unread} />
        <MiniStat title="Donations month" value={meetingMode ? "Hidden" : formatCurrency(sponsorHealth.donationsThisMonth)} />
      </div>
    </Card>
  );
}

function RecentActivityCard({ activity, meetingMode }: { activity: RecentActivityItem[]; meetingMode: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Recent admin activity</h2>
          <p className="mt-1 text-sm text-white/60">Latest security and admin records.</p>
        </div>
        <Clock3 className="h-6 w-6 text-white/40" />
      </div>
      <div className="mt-6 space-y-3">
        {activity.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
            No recent activity returned by the dashboard API yet.
          </div>
        ) : (
          activity.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-black">{titleCase(item.action)}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {meetingMode ? "Admin hidden" : item.admin_email || "Unknown admin"} · {formatRelativeTime(item.created_at)}
                  </div>
                </div>
                <PriorityPill priority={normalisePriority(item.risk_level)} />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function PermissionAccessPanel({
  canUsePermission,
  isMainAdmin,
}: {
  canUsePermission: (permission: string | null) => boolean;
  isMainAdmin: boolean;
}) {
  const rows = [
    ["Dashboard", "admin:dashboard:view"],
    ["Email Centre", "email:view"],
    ["Money Management", "money:view"],
    ["Forms / Contacts", "contacts:view"],
    ["Donations", "donations:view"],
    ["Page Editor", "site_pages:manage"],
    ["Audit Logs", "audit_logs:view"],
    ["Admin Users", "admin:users:manage"],
  ];

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">My access</h2>
          <p className="mt-1 text-sm text-white/60">What this admin account can open.</p>
        </div>
        <ShieldCheck className="h-6 w-6 text-white/40" />
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, permission]) => {
          const allowed = isMainAdmin || canUsePermission(permission);
          return (
            <div key={permission} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-sm font-bold text-white/75">{label}</span>
              <span className={allowed ? "text-xs font-black text-emerald-200" : "text-xs font-black text-red-200"}>
                {allowed ? "Allowed" : "Blocked"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AnnouncementPanel({ announcements, meetingMode }: { announcements: AdminAnnouncement[]; meetingMode: boolean }) {
  return (
    <section className="grid gap-3">
      {announcements.map((item) => (
        <div
          key={item.id}
          className={[
            "rounded-[1.5rem] border p-5 shadow-xl backdrop-blur-xl",
            getPriorityTone(item.priority),
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] opacity-70">Admin announcement</div>
              <h2 className="mt-2 text-xl font-black">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 opacity-85">{meetingMode ? "Hidden in meeting mode." : item.body}</p>
            </div>
            <PriorityPill priority={item.priority} />
          </div>
        </div>
      ))}
    </section>
  );
}

function CommandPalette({
  open,
  query,
  actions,
  onQueryChange,
  onClose,
  onRun,
}: {
  open: boolean;
  query: string;
  actions: CommandAction[];
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onRun: (action: CommandAction) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-20 backdrop-blur-xl">
      <button type="button" aria-label="Close command palette" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#11111f] shadow-2xl">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <Search className="h-4 w-4 text-white/45" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              autoFocus
              placeholder="Search actions, tools and secure routes..."
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/35"
            />
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/60 hover:bg-white/20">
              Esc
            </button>
          </div>
        </div>
        <div className="max-h-[28rem] overflow-y-auto p-3">
          {actions.length === 0 ? (
            <div className="p-5 text-sm text-white/55">No commands found.</div>
          ) : (
            actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onRun(action)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left hover:bg-white/10"
              >
                <div className="min-w-0">
                  <div className="font-black text-white">{action.title}</div>
                  <div className="mt-1 text-xs text-white/50">{action.desc}</div>
                </div>
                {action.priority ? <PriorityPill priority={action.priority} /> : <ArrowRight className="h-4 w-4 text-white/35" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function IncidentModal({
  open,
  summary,
  area,
  severity,
  onSummaryChange,
  onAreaChange,
  onSeverityChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  summary: string;
  area: string;
  severity: DashboardPriority;
  onSummaryChange: (value: string) => void;
  onAreaChange: (value: string) => void;
  onSeverityChange: (value: DashboardPriority) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl">
      <button type="button" aria-label="Close incident modal" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#11111f] shadow-2xl">
        <div className="bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 p-1" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-100/70">Security incident</div>
              <h2 className="mt-2 text-2xl font-black">Report security issue</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                This creates a high-priority audit record for main admin review.
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/65 hover:bg-white/20">
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Area</span>
              <select value={area} onChange={(event) => onAreaChange(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none">
                <option className="text-slate-950" value="dashboard">Dashboard</option>
                <option className="text-slate-950" value="auth">Login / Auth</option>
                <option className="text-slate-950" value="money">Money</option>
                <option className="text-slate-950" value="email">Email</option>
                <option className="text-slate-950" value="public_pages">Public pages</option>
                <option className="text-slate-950" value="permissions">Permissions</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Severity</span>
              <select value={severity} onChange={(event) => onSeverityChange(event.target.value as DashboardPriority)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none">
                <option className="text-slate-950" value="low">Low</option>
                <option className="text-slate-950" value="medium">Medium</option>
                <option className="text-slate-950" value="high">High</option>
                <option className="text-slate-950" value="critical">Critical</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-white/45">Summary</span>
            <textarea
              value={summary}
              onChange={(event) => onSummaryChange(event.target.value.slice(0, 500))}
              placeholder="Briefly describe what happened..."
              className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-semibold text-white outline-none placeholder:text-white/35"
            />
          </label>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white/70 hover:bg-white/20">
              Cancel
            </button>
            <button type="button" onClick={onSubmit} className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400">
              Report issue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "w-full min-w-0 max-w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#11111f]/85 p-4 shadow-xl backdrop-blur-xl sm:rounded-[2rem] sm:p-6",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function TopButton({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <SecureLink
      href={href}
      className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-white/20 active:scale-[0.99] sm:w-auto sm:min-w-[150px]"
    >
      <Icon className="h-4 w-4" />
      {children}
    </SecureLink>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
  href,
}: {
  title: string;
  value: string | number;
  sub: string;
  icon: ElementType;
  tone: "pink" | "blue" | "yellow" | "green";
  href: string;
}) {
  const toneClass =
    tone === "pink"
      ? "bg-pink-500/15 text-pink-100"
      : tone === "blue"
        ? "bg-blue-500/15 text-blue-100"
        : tone === "yellow"
          ? "bg-yellow-500/15 text-yellow-100"
          : "bg-emerald-500/15 text-emerald-100";

  return (
    <SecureLink
      href={href}
      className="group w-full min-w-0 max-w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#11111f]/85 p-4 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:bg-[#171729] sm:rounded-[2rem] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-white/60">{title}</div>
          <div className="mt-3 text-4xl font-black">{value}</div>
          <div className="mt-2 text-xs text-white/50">{sub}</div>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-black text-white/45 transition group-hover:text-white">
        Open area
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </SecureLink>
  );
}

function StatusPill({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-2 text-xs font-black text-blue-100">
        <RefreshCcw className="h-4 w-4 animate-spin" />
        Loading
      </span>
    );
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-2 text-xs font-black text-red-100">
        <AlertTriangle className="h-4 w-4" />
        Error
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-100">
      <CheckCircle2 className="h-4 w-4" />
      Live
    </span>
  );
}

function ListRow({
  title,
  meta,
  muted,
  badge,
}: {
  title: string;
  meta: string;
  muted?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
        muted ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="truncate font-black">{title}</div>
        <div className="mt-1 truncate text-xs text-white/50">{meta}</div>
      </div>

      {badge && (
        <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
          {badge}
        </span>
      )}
    </div>
  );
}

function ActionButton({
  href,
  title,
  desc,
  icon: Icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: ElementType;
}) {
  return (
    <SecureLink
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-black/30"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-black">{title}</div>
        <div className="mt-1 text-xs text-white/60">{desc}</div>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-white/50" />
    </SecureLink>
  );
}

function ModuleCard({
  item,
  isFavourite,
  onToggleFavourite,
}: {
  item: ModuleLink;
  isFavourite: boolean;
  onToggleFavourite: () => void;
}) {
  const Icon = item.icon;

  return (
    <div className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:bg-black/30">
      <div className="flex items-start gap-4">
        <SecureLink
          href={item.href}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white transition group-hover:bg-white group-hover:text-purple-700"
        >
          <Icon className="h-6 w-6" />
        </SecureLink>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <SecureLink href={item.href} className="font-black hover:underline">
              {item.title}
            </SecureLink>

            <div className="flex shrink-0 items-center gap-2">
              {item.badge && (
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white/60">
                  {item.badge}
                </span>
              )}

              <button
                type="button"
                onClick={onToggleFavourite}
                className={[
                  "rounded-full p-2 transition",
                  isFavourite
                    ? "bg-yellow-300/20 text-yellow-100"
                    : "bg-white/10 text-white/45 hover:text-white",
                ].join(" ")}
                aria-label={isFavourite ? "Remove favourite" : "Add favourite"}
              >
                <Star className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs leading-5 text-white/60">{item.desc}</p>

          <SecureLink
            href={item.href}
            className="mt-3 inline-flex items-center gap-2 text-xs font-black text-white/45 transition hover:text-white"
          >
            Open tool
            <ArrowRight className="h-3.5 w-3.5" />
          </SecureLink>
        </div>
      </div>
    </div>
  );
}

function QuickPick({
  title,
  desc,
  icon: Icon,
  active,
  onClick,
  onOpen,
}: {
  title: string;
  desc: string;
  icon: ElementType;
  active: boolean;
  onClick: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={[
        "rounded-[1.5rem] border p-5 shadow-xl backdrop-blur-xl transition",
        active
          ? "border-white/30 bg-white/15"
          : "border-white/10 bg-white/10 hover:bg-white/15",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
        aria-label={`Select ${title}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex h-11 w-11 items-center justify-center rounded-2xl",
              active ? "bg-white text-purple-700" : "bg-white/10 text-white",
            ].join(" ")}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <div className="font-black">{title}</div>
            <div className="mt-1 text-xs text-white/70">{desc}</div>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onOpen}
        className={[
          "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.99]",
          active
            ? "bg-white text-purple-700 shadow-lg"
            : "border border-white/10 bg-black/20 text-white hover:bg-black/30",
        ].join(" ")}
      >
        Open
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function TaskItem({
  task,
  checked,
  onToggle,
}: {
  task: DashboardTask;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={[
        "rounded-2xl border transition",
        checked
          ? "border-emerald-300/20 bg-emerald-500/10"
          : "border-white/10 bg-black/20 hover:bg-black/30",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div
          className={[
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
            checked ? "bg-emerald-400 text-black" : "bg-white/10 text-white/60",
          ].join(" ")}
        >
          {checked ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Clock3 className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0">
          <div className="font-black">{task.title}</div>
          <div className="mt-1 text-xs leading-5 text-white/60">
            {task.desc}
          </div>
        </div>
      </button>

      <SecureLink
        href={task.href}
        className="mx-4 mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white/65 transition hover:bg-white/20 hover:text-white"
      >
        Open task
        <ArrowRight className="h-3.5 w-3.5" />
      </SecureLink>
    </div>
  );
}

function HealthRow({
  title,
  desc,
  ok,
}: {
  title: string;
  desc: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
          ok
            ? "bg-emerald-500/15 text-emerald-100"
            : "bg-red-500/15 text-red-100",
        ].join(" ")}
      >
        {ok ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <AlertTriangle className="h-5 w-5" />
        )}
      </div>

      <div className="min-w-0">
        <div className="font-black">{title}</div>
        <div className="mt-1 truncate text-xs text-white/55">{desc}</div>
      </div>
    </div>
  );
}

function AttentionCard({
  title,
  value,
  desc,
  href,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  desc: string;
  href: string;
  icon: ElementType;
}) {
  return (
    <SecureLink
      href={href}
      className="group rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:-translate-y-0.5 hover:bg-black/30"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white transition group-hover:bg-white group-hover:text-purple-700">
          <Icon className="h-6 w-6" />
        </div>
        <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:text-white" />
      </div>

      <div className="mt-5 text-3xl font-black">{value}</div>
      <div className="mt-1 text-sm font-black">{title}</div>
      <div className="mt-1 text-xs text-white/55">{desc}</div>
    </SecureLink>
  );
}

function SpotlightCard({ item }: { item: SpotlightLink }) {
  const Icon = item.icon;

  return (
    <SecureLink
      href={item.href}
      className="group rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:-translate-y-0.5 hover:bg-black/30"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-purple-700">
          <Icon className="h-6 w-6" />
        </div>
        <ArrowRight className="h-4 w-4 text-white/40 transition group-hover:text-white" />
      </div>

      <h3 className="mt-4 font-black">{item.title}</h3>
      <p className="mt-2 text-xs leading-5 text-white/60">{item.desc}</p>
    </SecureLink>
  );
}

function NoteCard({
  note,
  onDelete,
}: {
  note: AdminNote;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="whitespace-pre-wrap text-sm leading-6 text-white/75">
            {note.text}
          </p>
          <p className="mt-2 text-xs font-bold text-white/40">
            {formatNoteDate(note.createdAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/55 transition hover:bg-red-500/20 hover:text-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function NextStep({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <SecureLink
      href={href}
      className="group block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-black/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-black">{title}</div>
        <MousePointerClick className="h-4 w-4 text-white/40 transition group-hover:text-white" />
      </div>
      <p className="mt-2 text-xs leading-5 text-white/60">{desc}</p>
    </SecureLink>
  );
}
