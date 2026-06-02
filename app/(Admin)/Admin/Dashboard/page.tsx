"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "../components/providers/AdminProvider";
import {
  AlertTriangle,
  ArrowRight,
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
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

type DashEvent = {
  id: string;
  title: string;
  start_at: string;
  location: string | null;
  is_published: boolean;
};

type DashboardResponse = {
  stats: {
    upcomingEvents: number;
    emailsSent30d: number | null;
    competitionEntries: number | null;
    websiteMessages: number | null;
  };
  nextEvents: DashEvent[];
};

type QuickStartKey =
  | "email"
  | "event"
  | "forms"
  | "competition"
  | "raffle"
  | "money";

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
};

type DashboardTask = {
  id: string;
  title: string;
  desc: string;
};

const DASHBOARD_TASKS: DashboardTask[] = [
  {
    id: "check-messages",
    title: "Check website messages",
    desc: "Look at contact forms and reply to anything urgent.",
  },
  {
    id: "check-events",
    title: "Check upcoming events",
    desc: "Make sure event dates, locations, and public status are correct.",
  },
  {
    id: "check-email",
    title: "Check admin email",
    desc: "Review inbox, replies, and any committee updates.",
  },
  {
    id: "check-money",
    title: "Check money tracker",
    desc: "Make sure donations, spending, and sponsorship money are recorded.",
  },
];

const ADMIN_MODULES: ModuleLink[] = [
  {
    title: "Emails",
    desc: "Send updates, announcements, templates, and committee messages.",
    href: "/Admin/Dashboard/Emails",
    icon: Mail,
    badge: "Comms",
  },
  {
    title: "Events",
    desc: "Create, publish, and manage Burton Pride events.",
    href: "/Admin/Dashboard/Events",
    icon: CalendarDays,
    badge: "Planning",
  },
  {
    title: "Forms",
    desc: "Open public website forms and manage submissions.",
    href: "/Admin/Dashboard/Forms",
    icon: FileText,
    badge: "Website",
  },
  {
    title: "Committee Team",
    desc: "Manage committee members and public team content.",
    href: "/Admin/Dashboard/CommitteeTeam",
    icon: Users,
    badge: "People",
  },
  {
    title: "Donations",
    desc: "View supporters, donations, and community support.",
    href: "/Admin/Dashboard/Donations",
    icon: Heart,
    badge: "Support",
  },
  {
    title: "Money Management",
    desc: "Track money in, money out, sponsorship, and personal funds.",
    href: "/Admin/Money",
    icon: Wallet,
    badge: "Finance",
  },
  {
    title: "Raffle",
    desc: "View raffle entries, ticket numbers, and draw winners.",
    href: "/Admin/Dashboard/Raffle",
    icon: Ticket,
    badge: "Draw",
  },
  {
    title: "Window Showcase",
    desc: "Manage Windows of Hope competition entries.",
    href: "/Admin/Dashboard/WindowShowcase",
    icon: Trophy,
    badge: "Competition",
  },
  {
    title: "Page Editor",
    desc: "Edit navigation, sidebars, pages, and public website settings.",
    href: "/Admin/Dashboard/PageEditor",
    icon: LayoutDashboard,
    badge: "Editor",
  },
  {
    title: "Settings",
    desc: "Manage admin tools, delete passwords, and portal settings.",
    href: "/Admin/Dashboard/Settings",
    icon: Settings,
    badge: "Admin",
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
    desc: "Open the donation page.",
    href: "/DonateToUs",
    icon: Gift,
  },
  {
    title: "Raffle page",
    desc: "Open the public raffle page.",
    href: "/Raffle",
    icon: Ticket,
  },
  {
    title: "Competition vote page",
    desc: "Open the public voting page.",
    href: "/Competition/Vote",
    icon: Trophy,
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

  const lower = email.toLowerCase();

  if (lower.includes("cameronlowndes")) {
    return "Cameron Lowndes";
  }

  const localPart = email.split("@")[0] || "";

  return formatDisplayName(localPart);
}

export default function DashboardPage() {
  const router = useRouter();
  const { admin, loading: adminLoading } = useAdmin();

  const emailAddress = admin?.email || "";
  const emailName = nameFromEmail(emailAddress);

  const displayName =
    formatDisplayName(admin?.full_name || "") ||
    emailName ||
    "Committee Member";

  const [quickStart, setQuickStart] = useState<QuickStartKey>("email");
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(
    {}
  );

  const [stats, setStats] = useState<DashboardResponse["stats"]>({
    upcomingEvents: 0,
    emailsSent30d: null,
    competitionEntries: null,
    websiteMessages: null,
  });

  const [nextEvents, setNextEvents] = useState<DashEvent[]>([]);

  const quickStartInfo: QuickStartInfo = useMemo(() => {
    switch (quickStart) {
      case "email":
        return {
          title: "Send an email",
          desc: "Send updates, announcements, and committee messages from the admin email area.",
          href: "/Admin/Dashboard/Emails",
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
          desc: "Open website forms, community submissions, and contact messages.",
          href: "/Admin/Dashboard/Forms",
          button: "Open Forms",
          icon: FileText,
        };

      case "competition":
        return {
          title: "Competition entries",
          desc: "Manage Windows of Hope competition entries, images, votes, and payments.",
          href: "/Admin/Dashboard/WindowShowcase",
          button: "Open Competition",
          icon: Trophy,
        };

      case "raffle":
        return {
          title: "Raffle admin",
          desc: "View paid raffle entries, raffle ticket numbers, and draw winners.",
          href: "/Admin/Dashboard/Raffle",
          button: "Open Raffle",
          icon: Ticket,
        };

      case "money":
        return {
          title: "Money management",
          desc: "Track donations, spending, sponsorship funds, personal funds, and receipts.",
          href: "/Admin/Money",
          button: "Open Money Tracker",
          icon: Wallet,
        };
    }
  }, [quickStart]);

  const filteredModules = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return ADMIN_MODULES;

    return ADMIN_MODULES.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query) ||
        item.badge?.toLowerCase().includes(query)
      );
    });
  }, [searchTerm]);

  const completedCount = useMemo(() => {
    return DASHBOARD_TASKS.filter((task) => completedTasks[task.id]).length;
  }, [completedTasks]);

  const QuickIcon = quickStartInfo.icon;

  async function loadDash() {
    try {
      setDashLoading(true);
      setDashError(null);

      const res = await fetch(`/api/admin/dashboard?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const json = (await res.json()) as DashboardResponse | { error?: string };

      if (!res.ok) {
        throw new Error((json as any)?.error || "Failed to load dashboard");
      }

      const ok = json as DashboardResponse;

      setStats(
        ok.stats || {
          upcomingEvents: 0,
          emailsSent30d: null,
          competitionEntries: null,
          websiteMessages: null,
        }
      );

      setNextEvents(ok.nextEvents || []);
    } catch (e: any) {
      setDashError(e?.message || "Something went wrong");
    } finally {
      setDashLoading(false);
    }
  }

  useEffect(() => {
    loadDash();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("burton-pride-dashboard-tasks");
      if (saved) {
        setCompletedTasks(JSON.parse(saved));
      }
    } catch {
      setCompletedTasks({});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "burton-pride-dashboard-tasks",
        JSON.stringify(completedTasks)
      );
    } catch {
      // Ignore localStorage failures
    }
  }, [completedTasks]);

  function toggleTask(taskId: string) {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }

  function resetTasks() {
    setCompletedTasks({});
  }

  return (
    <div className="min-h-dvh px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#11111f]/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-blue-500/20" />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-pink-400/20 blur-3xl" />
          <div className="absolute -bottom-28 left-10 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/80">
                <ShieldCheck className="h-4 w-4" />
                Committee Admin Portal
              </div>

              <h1 className="mt-5 max-w-5xl break-words text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                {getGreeting()},{" "}
                <span className="bg-gradient-to-r from-pink-200 via-white to-blue-200 bg-clip-text text-transparent">
                  {adminLoading ? "Loading..." : displayName}
                </span>
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-white/75 sm:text-lg">
                Welcome to the Burton Pride committee admin portal. Manage
                emails, events, website forms, competition entries, donations,
                money tracking, and community work from one place.
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-white/70">
                <span className="rounded-full bg-white/10 px-3 py-2">
                  {getTodayLabel()}
                </span>

                {emailAddress && (
                  <span className="max-w-full break-words rounded-full bg-white/10 px-3 py-2">
                    Signed in as {emailAddress}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <TopButton href="/Admin/Dashboard/Emails" icon={Send}>
                Send Email
              </TopButton>

              <TopButton href="/Admin/Dashboard/Events" icon={CalendarDays}>
                Create Event
              </TopButton>

              <TopButton href="/" icon={ExternalLink}>
                Website
              </TopButton>
            </div>
          </div>
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
                This admin dashboard is currently in beta, so some features may
                still be changing. If you find an issue, please report it to{" "}
                <span className="font-black text-white">
                  cameronlowndes@gmail.com
                </span>
                .
              </p>
            </div>

            <button
              type="button"
              onClick={loadDash}
              disabled={dashLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCcw
                className={dashLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
              />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Emails sent"
            value={dashLoading ? "…" : safeNumber(stats.emailsSent30d)}
            sub="Last 30 days"
            icon={Mail}
            tone="pink"
          />

          <StatCard
            title="Upcoming events"
            value={dashLoading ? "…" : String(stats.upcomingEvents)}
            sub="Events in database"
            icon={CalendarDays}
            tone="blue"
          />

          <StatCard
            title="Competition entries"
            value={dashLoading ? "…" : safeNumber(stats.competitionEntries)}
            sub="Windows of Hope"
            icon={Trophy}
            tone="yellow"
          />

          <StatCard
            title="Website messages"
            value={dashLoading ? "…" : safeNumber(stats.websiteMessages)}
            sub="Contact submissions"
            icon={MessageSquare}
            tone="green"
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Quick start</h2>
                <p className="mt-1 text-sm text-white/60">
                  Choose what you want to work on first.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/70">
                <Sparkles className="h-4 w-4" />
                Pick a task
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <QuickPick
                title="Emails"
                desc="Send updates and announcements"
                icon={Mail}
                active={quickStart === "email"}
                onClick={() => setQuickStart("email")}
                onOpen={() => router.push("/Admin/Dashboard/Emails")}
              />

              <QuickPick
                title="Events"
                desc="Create and manage events"
                icon={CalendarDays}
                active={quickStart === "event"}
                onClick={() => setQuickStart("event")}
                onOpen={() => router.push("/Admin/Dashboard/Events")}
              />

              <QuickPick
                title="Forms"
                desc="Website forms and messages"
                icon={FileText}
                active={quickStart === "forms"}
                onClick={() => setQuickStart("forms")}
                onOpen={() => router.push("/Admin/Dashboard/Forms")}
              />

              <QuickPick
                title="Competition"
                desc="Windows of Hope entries"
                icon={Trophy}
                active={quickStart === "competition"}
                onClick={() => setQuickStart("competition")}
                onOpen={() => router.push("/Admin/Dashboard/WindowShowcase")}
              />

              <QuickPick
                title="Raffle"
                desc="Entries and ticket numbers"
                icon={Ticket}
                active={quickStart === "raffle"}
                onClick={() => setQuickStart("raffle")}
                onOpen={() => router.push("/Admin/Dashboard/Raffle")}
              />

              <QuickPick
                title="Money"
                desc="Track finance and receipts"
                icon={Wallet}
                active={quickStart === "money"}
                onClick={() => setQuickStart("money")}
                onOpen={() => router.push("/Admin/Money")}
              />
            </div>
          </Card>

          <Card>
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white">
              <QuickIcon className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-2xl font-black">
              {quickStartInfo.title}
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/70">
              {quickStartInfo.desc}
            </p>

            <Link
              href={quickStartInfo.href}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
            >
              {quickStartInfo.button}
              <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/60">
              Tip: if something does not load, refresh the dashboard first. If
              it still fails, report the issue.
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Admin tools</h2>
                <p className="mt-1 text-sm text-white/60">
                  Search and open the main areas of the admin portal.
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search admin tools..."
                  className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-white/25 focus:bg-black/30"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {filteredModules.map((item) => (
                <ModuleCard key={item.title} item={item} />
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
                  {completedCount} of {DASHBOARD_TASKS.length} done
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

            <div className="mt-6 space-y-3">
              {DASHBOARD_TASKS.map((task) => (
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

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Recent activity</h2>
                <p className="mt-1 text-sm text-white/60">
                  Quick system status for the admin portal.
                </p>
              </div>

              <StatusPill loading={dashLoading} error={dashError} />
            </div>

            <div className="mt-6 space-y-3">
              {dashError ? (
                <ActivityItem
                  title="Dashboard API error"
                  meta={dashError}
                  icon={AlertTriangle}
                  tone="red"
                />
              ) : (
                <>
                  <ActivityItem
                    title="Admin portal ready"
                    meta="Live"
                    icon={CheckCircle2}
                    tone="green"
                  />

                  <ActivityItem
                    title="Upcoming events loaded from Supabase"
                    meta={dashLoading ? "Loading…" : "Live"}
                    icon={CalendarDays}
                    tone="blue"
                  />

                  <ActivityItem
                    title="Supabase route protection enabled"
                    meta="Protected"
                    icon={ShieldCheck}
                    tone="purple"
                  />

                  <ActivityItem
                    title="Dashboard refreshed"
                    meta={dashLoading ? "Loading…" : "Ready"}
                    icon={RefreshCcw}
                    tone="blue"
                  />
                </>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black">Quick actions</h2>
            <p className="mt-1 text-sm text-white/60">
              Common admin shortcuts.
            </p>

            <div className="mt-6 grid gap-3">
              <ActionButton
                href="/Admin/Dashboard/Emails"
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
                href="/Admin/Dashboard/WindowShowcase"
                title="Window Showcase"
                desc="Manage competition entries"
                icon={Trophy}
              />

              <ActionButton
                href="/Admin/Money"
                title="Money Tracker"
                desc="Track income and spending"
                icon={Wallet}
              />
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Upcoming events</h2>
                <p className="mt-1 text-sm text-white/60">
                  Next events from the database.
                </p>
              </div>

              <Link
                href="/Admin/Dashboard/Events"
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20"
              >
                Manage →
              </Link>
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
                    meta={formatEventDate(ev.start_at)}
                    badge={ev.is_published ? "Published" : "Draft"}
                  />
                ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Public pages</h2>
                <p className="mt-1 text-sm text-white/60">
                  Open public website pages quickly.
                </p>
              </div>

              <ExternalLink className="h-5 w-5 text-white/40" />
            </div>

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
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card>
            <h2 className="text-2xl font-black">Finance overview</h2>
            <p className="mt-1 text-sm text-white/60">
              Fast links for money management.
            </p>

            <div className="mt-6 grid gap-3">
              <ActionButton
                href="/Admin/Money"
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
            <h2 className="text-2xl font-black">Portal health</h2>
            <p className="mt-1 text-sm text-white/60">
              Quick checks for admin systems.
            </p>

            <div className="mt-6 space-y-3">
              <HealthRow
                title="Authentication"
                desc="Supabase admin loaded"
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
                href="/Admin/Money"
              />

              <NextStep
                title="Check events"
                desc="Make sure published event details are correct."
                href="/Admin/Dashboard/Events"
              />
            </div>
          </Card>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#11111f]/85 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
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
                people. This dashboard helps keep admin work organised so more
                time can go back into community benefit.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
            >
              View public website
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </section>
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
        "rounded-[2rem] border border-white/10 bg-[#11111f]/85 p-6 shadow-xl backdrop-blur-xl",
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
    <Link
      href={href}
      className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-white/20 active:scale-[0.99]"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  sub: string;
  icon: ElementType;
  tone: "pink" | "blue" | "yellow" | "green";
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
    <div className="group rounded-[2rem] border border-white/10 bg-[#11111f]/85 p-5 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:bg-[#171729]">
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
    </div>
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

function ActivityItem({
  title,
  meta,
  icon: Icon,
  tone,
}: {
  title: string;
  meta: string;
  icon: ElementType;
  tone: "green" | "blue" | "purple" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-500/15 text-emerald-100"
      : tone === "blue"
        ? "bg-blue-500/15 text-blue-100"
        : tone === "purple"
          ? "bg-purple-500/15 text-purple-100"
          : "bg-red-500/15 text-red-100";

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="truncate font-black">{title}</div>
          <div className="mt-1 text-xs text-white/50">{meta}</div>
        </div>
      </div>
    </div>
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
        <div className="mt-1 text-xs text-white/50">{meta}</div>
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
    <Link
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
    </Link>
  );
}

function ModuleCard({ item }: { item: ModuleLink }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:bg-black/30"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white transition group-hover:bg-white group-hover:text-purple-700">
        <Icon className="h-6 w-6" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black">{item.title}</h3>

          {item.badge && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white/60">
              {item.badge}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs leading-5 text-white/60">{item.desc}</p>
      </div>
    </Link>
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
    <button
      type="button"
      onClick={onToggle}
      className={[
        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
        checked
          ? "border-emerald-300/20 bg-emerald-500/10"
          : "border-white/10 bg-black/20 hover:bg-black/30",
      ].join(" ")}
    >
      <div
        className={[
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl",
          checked
            ? "bg-emerald-400 text-black"
            : "bg-white/10 text-white/60",
        ].join(" ")}
      >
        {checked ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Clock3 className="h-4 w-4" />
        )}
      </div>

      <div>
        <div className="font-black">{task.title}</div>
        <div className="mt-1 text-xs leading-5 text-white/60">{task.desc}</div>
      </div>
    </button>
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
    <Link
      href={href}
      className="group block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-black/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-black">{title}</div>
        <MousePointerClick className="h-4 w-4 text-white/40 transition group-hover:text-white" />
      </div>
      <p className="mt-2 text-xs leading-5 text-white/60">{desc}</p>
    </Link>
  );
}