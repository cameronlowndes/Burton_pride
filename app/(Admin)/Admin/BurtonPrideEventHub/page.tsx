import Link from "next/link";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Construction,
  FileSpreadsheet,
  HandHeart,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Map,
  Settings,
  ShieldCheck,
  Star,
  Store,
  User,
  Users,
} from "lucide-react";

import { getCurrentAdmin } from "@/lib/adminPermissions";

export const dynamic = "force-dynamic";

const EVENTS_API = "/api/admin/burton-pride-event-hub/events";

/**
 * Keep your real working routes here.
 * Anything with available: false will show as "Coming soon" and will NOT be clickable.
 */
const ROUTES = {
  eventManagement: "/Admin/BurtonPrideEventHub/BurtonPrideEventManagement",
  moneyTracking: "/Admin/MoneyManagement/TrackingMoney",
  contacts: "/Admin/BurtonPrideEventHub/Contacts",
  emailCentre: "/Admin/Email/Sending",
  adminUsers: "/Admin/Users",

  // Not built / not accessible yet
  stalls: "",
  sponsors: "",
  volunteers: "",
  siteMap: "",
  reports: "",
  settings: "",
} as const;

type Admin = Awaited<ReturnType<typeof getCurrentAdmin>>;

type HubEvent = {
  id: string;
  event_name: string;
  event_year: number;
  event_date: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  setup_start_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  theme: string | null;
  status: string;
  is_active: boolean;
  is_locked?: boolean | null;
  is_archived?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EventsApiResponse = {
  ok: boolean;
  error?: string;
  events?: HubEvent[];
  event?: HubEvent;
};

type EventFetchResult = {
  events: HubEvent[];
  error?: string;
};

type AlertItem = {
  type: "danger" | "warning" | "info" | "success";
  title: string;
  message: string;
  href?: string;
  action?: string;
};

type DashboardCard = {
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  cta: string;
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
  available: boolean;
  primary?: boolean;
  newTab?: boolean;
};

async function getEventHubEvents(admin: Admin): Promise<EventFetchResult> {
  if (!admin) return { events: [] };

  try {
    const requestHeaders = await headers();
    const cookieStore = await cookies();

    const host = requestHeaders.get("host");

    if (!host) {
      return {
        events: [],
        error: "Could not check active event because the request host was missing.",
      };
    }

    const protocol =
      requestHeaders.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "development" ? "http" : "https");

    const res = await fetch(`${protocol}://${host}${EVENTS_API}`, {
      cache: "no-store",
      headers: {
        cookie: cookieStore.toString(),
      },
    });

    const text = await res.text();

    let data: EventsApiResponse;

    try {
      data = text
        ? JSON.parse(text)
        : { ok: false, error: "Event API returned an empty response." };
    } catch {
      return {
        events: [],
        error: text
          ? `Event API returned invalid JSON: ${text.slice(0, 300)}`
          : "Event API returned invalid JSON.",
      };
    }

    if (!res.ok || !data.ok) {
      return {
        events: [],
        error:
          data.error ||
          `Event API returned status ${res.status}. Check the Event Hub events API route.`,
      };
    }

    return {
      events: Array.isArray(data.events) ? data.events : [],
    };
  } catch (error) {
    return {
      events: [],
      error:
        error instanceof Error
          ? error.message
          : "Could not load Event Hub event records.",
    };
  }
}

function formatRole(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Admin user";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAdminRole(admin: Admin) {
  if (!admin) return "Not signed in";
  return formatRole((admin as { role?: unknown }).role);
}

function getPermissionCount(admin: Admin) {
  if (!admin) return null;

  const permissions = (admin as { permissions?: unknown }).permissions;

  if (!permissions || typeof permissions !== "object") return null;

  return Object.values(permissions as Record<string, unknown>).filter(Boolean)
    .length;
}

function formatDate(value?: string | null) {
  if (!value) return "No date set";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "Not set";
  return value.slice(0, 5);
}

function getCountdownLabel(value?: string | null) {
  if (!value) return "No date set";

  const eventDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(eventDate.getTime())) return "Date needs checking";

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const eventStart = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  );

  const diffMs = eventStart.getTime() - todayStart.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1) return `${diffDays} days away`;
  if (diffDays === -1) return "Yesterday";

  return `${Math.abs(diffDays)} days ago`;
}

function getSortedEvents(events: HubEvent[]) {
  return [...events].sort((a, b) => {
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;

    return Number(b.event_year || 0) - Number(a.event_year || 0);
  });
}

function getHubAlerts({
  admin,
  activeEvent,
  eventError,
  events,
}: {
  admin: Admin;
  activeEvent: HubEvent | null;
  eventError?: string;
  events: HubEvent[];
}): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (!admin) {
    alerts.push({
      type: "warning",
      title: "Sign in needed",
      message:
        "You need to sign in with your Supabase admin account before using the Event Hub.",
      href: "/Admin/Login",
      action: "Sign in",
    });

    return alerts;
  }

  if (eventError) {
    alerts.push({
      type: "warning",
      title: "Event data could not be loaded",
      message: eventError,
      href: ROUTES.eventManagement,
      action: "Check events",
    });
  }

  if (!activeEvent) {
    alerts.push({
      type: "danger",
      title: "No active event selected",
      message:
        events.length > 0
          ? "Choose which Burton Pride event the Event Hub should use."
          : "Create your first Burton Pride event record before using the rest of the Event Hub.",
      href: ROUTES.eventManagement,
      action: events.length > 0 ? "Set active event" : "Create event",
    });
  }

  if (activeEvent?.is_archived) {
    alerts.push({
      type: "danger",
      title: "Active event is archived",
      message:
        "Archived events should not normally be used as the live Event Hub context.",
      href: ROUTES.eventManagement,
      action: "Restore or change event",
    });
  }

  if (activeEvent?.is_locked) {
    alerts.push({
      type: "warning",
      title: "Active event is locked",
      message:
        "Some Event Hub pages may block editing until the active event is unlocked by a main admin.",
      href: ROUTES.eventManagement,
      action: "Manage lock",
    });
  }

  if (activeEvent && !activeEvent.event_date) {
    alerts.push({
      type: "warning",
      title: "Event date missing",
      message:
        "Add the event date so contacts, emails and money records can use the correct event context.",
      href: ROUTES.eventManagement,
      action: "Add date",
    });
  }

  if (activeEvent && !activeEvent.venue_name) {
    alerts.push({
      type: "warning",
      title: "Venue missing",
      message:
        "Add the venue name so setup emails and event records have the right location.",
      href: ROUTES.eventManagement,
      action: "Add venue",
    });
  }

  if (activeEvent && !activeEvent.event_start_time) {
    alerts.push({
      type: "info",
      title: "Opening time missing",
      message:
        "Add the public opening time so Event Hub messages can use the right event time.",
      href: ROUTES.eventManagement,
      action: "Add time",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: "success",
      title: "Event Hub ready",
      message:
        "Your active event is set and the key event details look ready to use.",
      href: ROUTES.eventManagement,
      action: "View event",
    });
  }

  return alerts;
}

function getCards(hasUsableActiveEvent: boolean): DashboardCard[] {
  const needsEvent = !hasUsableActiveEvent;

  return [
    {
      title: "Event Management",
      description:
        "Create, edit, clone, lock and activate each Burton Pride event year.",
      href: ROUTES.eventManagement,
      icon: CalendarDays,
      cta: "Manage Events",
      badge: "Available",
      available: true,
      primary: needsEvent,
    },
    {
      title: "Money Tracking",
      description:
        "Open the Money Management App to track income, spending, cash tins, refunds, suppliers and event budgets.",
      href: ROUTES.moneyTracking,
      icon: Banknote,
      cta: "Open Money App",
      badge: "Opens new tab",
      available: true,
      newTab: true,
      disabled: needsEvent,
      disabledReason: needsEvent ? "Set active event first" : undefined,
    },
    {
      title: "Contacts",
      description:
        "Manage business contacts, charity contacts, vendor records and follow-ups.",
      href: ROUTES.contacts,
      icon: Users,
      cta: "Open Contacts",
      badge: "Available",
      available: true,
      disabled: needsEvent,
      disabledReason: needsEvent ? "Set active event first" : undefined,
    },
    {
      title: "Email Centre",
      description:
        "Send Event Hub emails, contact vendors and prepare messages for the team.",
      href: ROUTES.emailCentre,
      icon: Mail,
      cta: "Open Emailing App",
      badge: "Opens new tab",
      available: true,
      newTab: true,
      disabled: needsEvent,
      disabledReason: needsEvent ? "Set active event first" : undefined,
    },
    {
      title: "Stalls & Vendors",
      description:
        "Future area for stall bookings, food vendors, pitches and setup details.",
      icon: Store,
      cta: "Coming soon",
      badge: "Coming soon",
      available: false,
      disabledReason: "Page not built yet",
    },
    {
      title: "Sponsors",
      description:
        "Future area for sponsor applications, packages, payments and visibility.",
      icon: HandHeart,
      cta: "Coming soon",
      badge: "Coming soon",
      available: false,
      disabledReason: "Page not built yet",
    },
    {
      title: "Volunteers",
      description:
        "Future area for volunteer roles, availability and event-day support.",
      icon: ClipboardList,
      cta: "Coming soon",
      badge: "Coming soon",
      available: false,
      disabledReason: "Page not built yet",
    },
    {
      title: "Site Map",
      description:
        "Future area for layout planning, pitch locations and event sections.",
      icon: Map,
      cta: "Coming soon",
      badge: "Coming soon",
      available: false,
      disabledReason: "Page not built yet",
    },
    {
      title: "Reports & Exports",
      description:
        "Future area for reports, committee packs and accountant exports.",
      icon: FileSpreadsheet,
      cta: "Coming soon",
      badge: "Coming soon",
      available: false,
      disabledReason: "Page not built yet",
    },
    {
      title: "Settings",
      description:
        "Future area for Event Hub settings, access controls and admin options.",
      icon: Settings,
      cta: "Coming soon",
      badge: "Coming soon",
      available: false,
      disabledReason: "Page not built yet",
    },
  ];
}

export default async function BurtonPrideEventHubHomePage() {
  const admin = await getCurrentAdmin();
  const { events, error: eventError } = await getEventHubEvents(admin);

  const sortedEvents = getSortedEvents(events);

  const activeEvent = sortedEvents.find((event) => event.is_active) || null;
  const usableActiveEvent =
    activeEvent && !activeEvent.is_archived ? activeEvent : null;

  const latestEvent = sortedEvents.find((event) => !event.is_archived) || null;
  const displayEvent = usableActiveEvent || activeEvent || latestEvent;

  const alerts = getHubAlerts({
    admin,
    activeEvent,
    eventError,
    events,
  });

  const cards = getCards(Boolean(usableActiveEvent));
  const userName = admin?.email || "Event Hub user";
  const adminRole = getAdminRole(admin);
  const permissionCount = getPermissionCount(admin);

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.14),_transparent_32%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
                <LayoutDashboard className="h-4 w-4" />
                Burton Pride Event Hub
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Welcome back to Event Hub
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                Manage Burton Pride event planning, money tracking, contacts,
                emails and admin records in one secure place. Other areas are
                shown as coming soon until their pages are ready.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {admin ? (
                <>
                  <Link
                    href={
                      usableActiveEvent
                        ? ROUTES.moneyTracking
                        : ROUTES.eventManagement
                    }
                    target={usableActiveEvent ? "_blank" : undefined}
                    rel={usableActiveEvent ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-black shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300"
                  >
                    {usableActiveEvent ? "Open money app" : "Set active event"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <Link
                    href="/Admin/Logout"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Link>
                </>
              ) : (
                <Link
                  href="/Admin/Login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-white/90"
                >
                  <Lock className="h-4 w-4" />
                  Sign in to Event Hub
                </Link>
              )}
            </div>
          </div>
        </header>

        {!admin ? (
          <LoggedOutPanel />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
            <section className="grid gap-6">
              <AdminPanel
                email={userName}
                role={adminRole}
                permissionCount={permissionCount}
              />

              <EventSummaryPanel
                event={displayEvent}
                hasUsableActiveEvent={Boolean(usableActiveEvent)}
              />

              <AlertsPanel alerts={alerts} />

              <QuickAccessGrid cards={cards} />
            </section>

            <aside className="grid content-start gap-6">
              <EventRecordsPanel events={sortedEvents} />

              <HelpfulLinksPanel hasUsableActiveEvent={Boolean(usableActiveEvent)} />

              <SecurityPanel />
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function LoggedOutPanel() {
  return (
    <section className="mx-auto flex min-h-[58vh] max-w-4xl items-center justify-center">
      <div className="w-full rounded-[2rem] border border-amber-300/20 bg-amber-500/10 p-7 text-center shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/20">
          <Lock className="h-8 w-8" />
        </div>

        <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-200">
          Secure admin area
        </p>

        <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
          Please sign in first
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-amber-100/75 sm:text-base">
          You need to be signed in with your Supabase admin account before using
          Burton Pride Event Hub.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/Admin/Login"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-white/90"
          >
            <Lock className="h-4 w-4" />
            Sign in to Event Hub
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/20"
          >
            Back to public website
          </Link>
        </div>
      </div>
    </section>
  );
}

function AdminPanel({
  email,
  role,
  permissionCount,
}: {
  email: string;
  role: string;
  permissionCount: number | null;
}) {
  return (
    <section className="rounded-[2rem] border border-emerald-300/20 bg-emerald-500/10 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/20">
            <User className="h-7 w-7" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
              Logged in as
            </p>

            <p className="mt-1 break-words text-base font-black text-white">
              {email}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill
                type="success"
                icon={ShieldCheck}
                label={`Role: ${role}`}
              />

              {permissionCount !== null ? (
                <StatusPill
                  type="info"
                  icon={CheckCircle2}
                  label={`${permissionCount} permissions enabled`}
                />
              ) : (
                <StatusPill
                  type="info"
                  icon={CheckCircle2}
                  label="Permission details unavailable"
                />
              )}
            </div>
          </div>
        </div>

        <Link
          href={ROUTES.adminUsers}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
        >
          Manage admins
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function EventSummaryPanel({
  event,
  hasUsableActiveEvent,
}: {
  event: HubEvent | null;
  hasUsableActiveEvent: boolean;
}) {
  if (!event) {
    return (
      <section className="rounded-[2rem] border border-red-300/20 bg-red-500/10 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-100">
              <AlertTriangle className="h-4 w-4" />
              No event found
            </div>

            <h2 className="text-2xl font-black">Create your first event</h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-red-100/75">
              The Event Hub needs an event record before the rest of the admin
              pages can use the correct year, date, venue and planning context.
            </p>
          </div>

          <Link
            href={ROUTES.eventManagement}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black hover:bg-white/90"
          >
            Create event
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-[2rem] border p-6 shadow-2xl backdrop-blur-xl ${
        hasUsableActiveEvent
          ? "border-emerald-300/20 bg-emerald-500/10"
          : "border-amber-300/20 bg-amber-500/10"
      }`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
              hasUsableActiveEvent
                ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                : "border-amber-300/20 bg-amber-500/10 text-amber-100"
            }`}
          >
            <Star className="h-4 w-4" />
            {hasUsableActiveEvent ? "Active event" : "Event needs checking"}
          </div>

          <h2 className="text-3xl font-black tracking-tight">
            {event.event_name} {event.event_year}
          </h2>

          <p className="mt-2 text-sm font-semibold text-white/70">
            {formatDate(event.event_date)} · {getCountdownLabel(event.event_date)}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoBox
              label="Public time"
              value={`${formatTime(event.event_start_time)} - ${formatTime(
                event.event_end_time
              )}`}
            />

            <InfoBox label="Setup starts" value={formatTime(event.setup_start_time)} />

            <InfoBox label="Venue" value={event.venue_name || "No venue set"} />

            <InfoBox label="Theme" value={event.theme || "No theme set"} />
          </div>

          {event.venue_address ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-white/70">
              <span className="font-black text-white">Address:</span>{" "}
              {event.venue_address}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {event.is_active ? (
            <StatusPill type="success" icon={Star} label="Active" />
          ) : (
            <StatusPill type="warning" icon={AlertTriangle} label="Not active" />
          )}

          {event.is_locked ? (
            <StatusPill type="danger" icon={Lock} label="Locked" />
          ) : (
            <StatusPill type="info" icon={CheckCircle2} label="Open" />
          )}

          {event.is_archived ? (
            <StatusPill type="danger" icon={AlertTriangle} label="Archived" />
          ) : null}

          <StatusPill type="info" icon={Activity} label={event.status || "Status unknown"} />

          <Link
            href={ROUTES.eventManagement}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white hover:bg-white/20"
          >
            Edit event
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
            Attention
          </p>

          <h2 className="mt-1 text-xl font-black">Things to check</h2>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-black text-white/70">
          {alerts.length}
        </div>
      </div>

      <div className="grid gap-3">
        {alerts.map((alert) => (
          <AlertCard key={`${alert.title}-${alert.message}`} alert={alert} />
        ))}
      </div>
    </section>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const style =
    alert.type === "danger"
      ? "border-red-300/20 bg-red-500/10 text-red-100"
      : alert.type === "warning"
      ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
      : alert.type === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : "border-sky-300/20 bg-sky-500/10 text-sky-100";

  const Icon =
    alert.type === "danger" || alert.type === "warning"
      ? AlertTriangle
      : alert.type === "success"
      ? CheckCircle2
      : Activity;

  const content = (
    <div className={`rounded-3xl border p-4 ${style}`}>
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/15">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-black">{alert.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{alert.message}</p>

          {alert.href && alert.action ? (
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-black">
              {alert.action}
              <ArrowRight className="h-4 w-4" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (alert.href) {
    return (
      <Link href={alert.href} className="block transition hover:scale-[1.01]">
        {content}
      </Link>
    );
  }

  return content;
}

function QuickAccessGrid({ cards }: { cards: DashboardCard[] }) {
  const availableCards = cards.filter((card) => card.available);
  const comingSoonCards = cards.filter((card) => !card.available);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
          Quick access
        </p>

        <h2 className="mt-1 text-xl font-black">Open Event Hub tools</h2>

        <p className="mt-2 text-sm leading-6 text-white/55">
          Only working pages are clickable. Pages you have not built yet are
          shown as coming soon so they do not cause 404 errors.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {availableCards.map((card) => (
          <QuickAccessCard key={card.title} card={card} />
        ))}
      </div>

      {comingSoonCards.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-white/65">
            <Construction className="h-4 w-4 text-amber-200" />
            Coming soon
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {comingSoonCards.map((card) => (
              <QuickAccessCard key={card.title} card={card} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function QuickAccessCard({ card }: { card: DashboardCard }) {
  const Icon = card.icon;
  const isUnavailable = !card.available || card.disabled;

  const content = (
    <div
      className={`h-full rounded-3xl border p-5 shadow-xl transition ${
        card.primary
          ? "border-emerald-300/25 bg-emerald-500/15"
          : "border-white/10 bg-black/20"
      } ${
        isUnavailable
          ? "opacity-70"
          : "hover:-translate-y-0.5 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
          <Icon className="h-6 w-6" />
        </div>

        {card.badge ? (
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-black ${
              card.available
                ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                : "border-amber-300/20 bg-amber-500/10 text-amber-100"
            }`}
          >
            {card.badge}
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-black">{card.title}</h3>

      <p className="mt-2 text-sm leading-6 text-white/60">{card.description}</p>

      {card.disabledReason ? (
        <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
          {card.disabledReason}
        </p>
      ) : null}

      <div
        className={`mt-5 inline-flex items-center gap-2 text-sm font-black ${
          isUnavailable ? "text-white/45" : "text-emerald-200"
        }`}
      >
        {card.available && !card.disabled ? card.cta : card.cta}
        {card.newTab && card.available && !card.disabled ? (
          <span className="text-xs text-white/45">(new tab)</span>
        ) : null}
        {card.available && !card.disabled ? <ArrowRight className="h-4 w-4" /> : null}
      </div>
    </div>
  );

  if (!card.available || card.disabled || !card.href) {
    return <div aria-disabled="true">{content}</div>;
  }

  return (
    <Link
      href={card.href}
      target={card.newTab ? "_blank" : undefined}
      rel={card.newTab ? "noopener noreferrer" : undefined}
      className="block h-full"
    >
      {content}
    </Link>
  );
}

function EventRecordsPanel({ events }: { events: HubEvent[] }) {
  const visibleEvents = events.slice(0, 5);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
            Event records
          </p>

          <h2 className="mt-1 text-xl font-black">Recent event years</h2>
        </div>

        <Link
          href={ROUTES.eventManagement}
          className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
        >
          Manage
        </Link>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-5 text-sm leading-6 text-white/55">
          No event records have been found yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-3xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">
                    {event.event_name} {event.event_year}
                  </p>

                  <p className="mt-1 text-sm text-white/55">
                    {formatDate(event.event_date)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {event.is_active ? (
                    <MiniBadge tone="success">Active</MiniBadge>
                  ) : null}

                  {event.is_locked ? (
                    <MiniBadge tone="danger">Locked</MiniBadge>
                  ) : null}

                  {event.is_archived ? (
                    <MiniBadge tone="muted">Archived</MiniBadge>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HelpfulLinksPanel({
  hasUsableActiveEvent,
}: {
  hasUsableActiveEvent: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
        Working shortcuts
      </p>

      <h2 className="mt-1 text-xl font-black">Useful admin links</h2>

      <div className="mt-4 grid gap-3">
        <SmallLink href={ROUTES.eventManagement} icon={CalendarDays}>
          Manage active event
        </SmallLink>

        {hasUsableActiveEvent ? (
          <>
            <SmallLink href={ROUTES.moneyTracking} icon={Banknote} newTab>
              Open money app
            </SmallLink>

            <SmallLink href={ROUTES.contacts} icon={Users}>
              Open contacts
            </SmallLink>

            <SmallLink href={ROUTES.emailCentre} icon={Mail} newTab>
              Send Event Hub email
            </SmallLink>
          </>
        ) : (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/80">
            Set an active event first, then the working Event Hub shortcuts will
            appear here.
          </div>
        )}
      </div>
    </section>
  );
}

function SecurityPanel() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/20">
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div>
          <p className="font-black">Secure admin reminder</p>

          <p className="mt-2 text-sm leading-6 text-white/55">
            Always log out when using a shared computer. Main admin actions such
            as locking, archiving and deleting events should require password
            confirmation on the Event Management page.
          </p>
        </div>
      </div>
    </section>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}

function StatusPill({
  type,
  icon: Icon,
  label,
}: {
  type: "success" | "warning" | "danger" | "info";
  icon: LucideIcon;
  label: string;
}) {
  const className =
    type === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : type === "warning"
      ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
      : type === "danger"
      ? "border-red-300/20 bg-red-500/10 text-red-100"
      : "border-sky-300/20 bg-sky-500/10 text-sky-100";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black capitalize ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function MiniBadge({
  tone,
  children,
}: {
  tone: "success" | "danger" | "muted";
  children: ReactNode;
}) {
  const className =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "danger"
      ? "border-red-300/20 bg-red-500/10 text-red-100"
      : "border-white/10 bg-white/10 text-white/60";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] font-black ${className}`}
    >
      {children}
    </span>
  );
}

function SmallLink({
  href,
  icon: Icon,
  children,
  newTab = false,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  newTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-emerald-200" />
        {children}
      </span>

      <ArrowRight className="h-4 w-4 text-white/40" />
    </Link>
  );
}
