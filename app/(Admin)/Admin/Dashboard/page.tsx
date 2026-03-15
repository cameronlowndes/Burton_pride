"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

type QuickStartKey = "email" | "event" | "entries" | "forms";

type QuickStartInfo = {
  title: string;
  desc: string;
  href: string;
  button: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Committee Member";

  const [quickStart, setQuickStart] = useState<QuickStartKey>("email");

  const quickStartInfo: QuickStartInfo = useMemo(() => {
    switch (quickStart) {
      case "email":
        return {
          title: "Send an email",
          desc: "Send updates, announcements, and committee comms.",
          href: "/admin/dashboard/email", // change if your Email route is capitalised too
          button: "Go to Emails",
        };

      case "event":
        return {
          title: "Create an event",
          desc: "Create & manage events for Burton Pride.",
          href: "/Admin/Dashboard/Events",
          button: "Go to Events",
        };

      case "entries":
        return {
          title: "Competition entries",
          desc: "View and manage Windows of Hope entries.",
          href: "/admin/dashboard/windows-of-hope", // change if route folder name differs
          button: "Open Windows of Hope",
        };

      case "forms":
        return {
          title: "Website forms",
          desc: "Open and manage every form on the website.",
          href: "/admin/Dashboard/Forms",
          button: "Open Forms",
        };
    }
  }, [quickStart]);

  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardResponse["stats"]>({
    upcomingEvents: 0,
    emailsSent30d: null,
    competitionEntries: null,
    websiteMessages: null,
  });
  const [nextEvents, setNextEvents] = useState<DashEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDash() {
      try {
        setDashLoading(true);
        setDashError(null);

        const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
        const json = (await res.json()) as DashboardResponse | { error?: string };

        if (!res.ok) throw new Error((json as any)?.error || "Failed to load");

        if (!cancelled) {
          const ok = json as DashboardResponse;
          setStats(ok.stats);
          setNextEvents(ok.nextEvents || []);
        }
      } catch (e: any) {
        if (!cancelled) setDashError(e?.message || "Something went wrong");
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    }

    loadDash();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Dashboard</h1>
          <p className="text-white/80">
            Welcome{" "}
            <span className="font-semibold">
              {isLoaded ? displayName : "Loading..."}
            </span>{" "}
            to the Burton Pride committee admin portal.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/admin/dashboard/email"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            Send email
          </Link>
          <Link
            href="/Admin/Dashboard/Events"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            Create event
          </Link>
          <Link
            href="/"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            Go back to the website
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="text-lg font-extrabold">Admin Dashboard (BETA)</div>
        <p className="mt-2 text-sm text-white/75">
          This admin dashboard is currently in beta. You can expect bugs.
          <br />
          If you find an issue, please report it to{" "}
          <span className="font-semibold text-white">cameronlowndes@gmail.com</span>.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Quick start</h2>
            <span className="text-xs text-white/60">Pick a task</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <QuickPick
              title="Emails"
              desc="Send updates + announcements"
              active={quickStart === "email"}
              onClick={() => setQuickStart("email")}
              onOpen={() => router.push("/admin/dashboard/email")}
            />
            <QuickPick
              title="Events"
              desc="Create & manage events"
              active={quickStart === "event"}
              onClick={() => setQuickStart("event")}
              onOpen={() => router.push("/Admin/Dashboard/Events")}
            />
            <QuickPick
              title="Entries"
              desc="Windows of Hope entries"
              active={quickStart === "entries"}
              onClick={() => setQuickStart("entries")}
              onOpen={() => router.push("/admin/dashboard/windows-of-hope")}
            />
            <QuickPick
              title="Forms"
              desc="All website forms"
              active={quickStart === "forms"}
              onClick={() => setQuickStart("forms")}
              onOpen={() => router.push("/admin/Dashboard/Forms")}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">{quickStartInfo.title}</h2>
          <p className="mt-2 text-sm text-white/75">{quickStartInfo.desc}</p>

          <div className="mt-5">
            <Link
              href={quickStartInfo.href}
              className="block rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-extrabold transition hover:bg-white/20"
            >
              {quickStartInfo.button}
            </Link>
          </div>

          <div className="mt-6 text-xs text-white/60">
            Tip: if something looks wrong, refresh the page first.
          </div>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Emails sent (30 days)"
          value={stats.emailsSent30d ?? "—"}
          sub="Connect backend to show live data"
        />
        <StatCard
          title="Upcoming events"
          value={dashLoading ? "…" : String(stats.upcomingEvents)}
          sub="Pulled from database"
        />
        <StatCard
          title="Competition entries"
          value={stats.competitionEntries ?? "—"}
          sub="Windows of Hope entries"
        />
        <StatCard
          title="Website messages"
          value={stats.websiteMessages ?? "—"}
          sub="Contact form submissions"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Recent activity</h2>
            <span className="text-xs text-white/60">
              {dashLoading ? "Loading…" : dashError ? "Error" : "Live"}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {dashError ? (
              <ActivityItem title="Dashboard API error" meta={dashError} />
            ) : (
              <>
                <ActivityItem title="Admin portal ready" meta="Now" />
                <ActivityItem
                  title="Upcoming events loaded from Supabase"
                  meta={dashLoading ? "Loading…" : "Live"}
                />
                <ActivityItem title="Committee route protection enabled" meta="Live" />
              </>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Quick actions</h2>

          <div className="mt-5 grid gap-3">
            <ActionButton
              href="/admin/dashboard/email"
              title="Emails"
              desc="Send updates + announcements"
            />
            <ActionButton
              href="/Admin/Dashboard/Events"
              title="Events"
              desc="Create & manage events"
            />
            <ActionButton
              href="/admin/Dashboard/Forms"
              title="Forms"
              desc="Open all website forms"
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Upcoming events</h2>
            <Link
              href="/Admin/Dashboard/Events"
              className="text-sm font-semibold text-white/70 transition hover:text-white"
            >
              Manage →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
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
                  meta={new Date(ev.start_at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
              ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Emails queue</h2>
            <Link
              href="/admin/dashboard/email"
              className="text-sm font-semibold text-white/70 transition hover:text-white"
            >
              Open →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            <ListRow title="No scheduled emails" meta="Create a campaign" />
            <ListRow title="—" meta="—" muted />
            <ListRow title="—" meta="—" muted />
          </div>
        </Card>
      </section>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="text-xs text-white/70">{title}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
      <div className="mt-2 text-xs text-white/60">{sub}</div>
    </div>
  );
}

function ActivityItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="font-semibold">{title}</div>
      <div className="break-words text-right text-xs text-white/60">{meta}</div>
    </div>
  );
}

function ListRow({
  title,
  meta,
  muted,
}: {
  title: string;
  meta: string;
  muted?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
        muted ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="font-semibold">{title}</div>
      <div className="text-right text-xs text-white/60">{meta}</div>
    </div>
  );
}

function ActionButton({
  href,
  title,
  desc,
  disabled,
}: {
  href: string;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 opacity-60">
        <div className="font-extrabold">{title}</div>
        <div className="mt-1 text-xs text-white/60">{desc}</div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-black/30"
    >
      <div className="font-extrabold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{desc}</div>
    </Link>
  );
}

function QuickPick({
  title,
  desc,
  active,
  onClick,
  onOpen,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 shadow-xl backdrop-blur-xl transition",
        active
          ? "border-white/25 bg-white/15"
          : "border-white/10 bg-white/10 hover:bg-white/15",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
        aria-label={`Select ${title}`}
      >
        <div className="font-extrabold">{title}</div>
        <div className="mt-1 text-xs text-white/70">{desc}</div>
      </button>

      <button
        type="button"
        onClick={onOpen}
        className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-extrabold transition hover:bg-black/30"
      >
        Open
      </button>
    </div>
  );
} 