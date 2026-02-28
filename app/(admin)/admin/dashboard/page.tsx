"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Committee Member";

  const [quickStart, setQuickStart] = useState<
    "email" | "event" | "entries" | "messages"
  >("email");

  const quickStartInfo = useMemo(() => {
    switch (quickStart) {
      case "email":
        return {
          title: "Send an email",
          desc: "Send updates, announcements, and committee comms.",
          href: "/admin/dashboard/email",
          button: "Go to Emails",
        };
      case "event":
        return {
          title: "Create an event",
          desc: "Create & manage events for Burton Pride.",
          href: "/admin/dashboard/events",
          button: "Go to Events",
        };
      case "entries":
        return {
          title: "Competition entries",
          desc: "View Windows of Hope entries (coming soon).",
          href: "/admin/dashboard",
          button: "Coming soon",
          disabled: true,
        };
      case "messages":
        return {
          title: "Website messages",
          desc: "View contact form messages (coming soon).",
          href: "/admin/dashboard",
          button: "Coming soon",
          disabled: true,
        };
      default:
        return null;
    }
  }, [quickStart]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Dashboard</h1>
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
            className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition"
          >
            Send email
          </Link>
          <Link
            href="/admin/dashboard/events"
            className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition"
          >
            Create event
          </Link>
        </div>
      </div>

   {/* Beta notice */}
<div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl p-6">
  <div>
    <div className="font-extrabold text-lg">Admin Dashboard (BETA)</div>
    <p className="text-sm text-white/75 mt-2">
      This admin dashboard is currently in beta. You can expect bugs.
      <br />
      If you find an issue, please report it to{" "}
      <span className="font-semibold text-white">
       cameronlowndes@gmail.com
      </span>.
    </p>
  </div>
</div>

      {/* Quick start selector */}
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
            />
            <QuickPick
              title="Events"
              desc="Create & manage events"
              active={quickStart === "event"}
              onClick={() => setQuickStart("event")}
            />
            <QuickPick
              title="Entries"
              desc="Windows of Hope (soon)"
              active={quickStart === "entries"}
              onClick={() => setQuickStart("entries")}
            />
            <QuickPick
              title="Messages"
              desc="Contact form (soon)"
              active={quickStart === "messages"}
              onClick={() => setQuickStart("messages")}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">{quickStartInfo?.title}</h2>
          <p className="text-sm text-white/75 mt-2">{quickStartInfo?.desc}</p>

          <div className="mt-5">
            {quickStartInfo?.disabled ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 opacity-60">
                <div className="font-semibold">{quickStartInfo.button}</div>
                <div className="text-xs text-white/60 mt-1">
                  This section isn’t connected yet.
                </div>
              </div>
            ) : (
              <Link
                href={quickStartInfo?.href || "/admin/dashboard"}
                className="block text-center rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-sm font-extrabold hover:bg-white/20 transition"
              >
                {quickStartInfo?.button}
              </Link>
            )}
          </div>

          <div className="mt-6 text-xs text-white/60">
            Tip: if something looks wrong, refresh the page first.
          </div>
        </Card>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Emails sent (30 days)"
          value="—"
          sub="Connect backend to show live data"
        />
        <StatCard title="Upcoming events" value="—" sub="Pull from database later" />
        <StatCard title="Competition entries" value="—" sub="Windows of Hope entries" />
        <StatCard title="Website messages" value="—" sub="Contact form submissions" />
      </section>

      {/* Main grid */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Left: Activity */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Recent activity</h2>
            <span className="text-xs text-white/60">UI only for now</span>
          </div>

          <div className="mt-5 space-y-3">
            <ActivityItem title="Admin portal created" meta="Today" />
            <ActivityItem title="Dashboard layout added" meta="Today" />
            <ActivityItem title="Login page ready (Clerk)" meta="Today" />
          </div>
        </Card>

        {/* Right: Quick actions */}
        <Card>
          <h2 className="text-lg font-extrabold">Quick actions</h2>

          <div className="mt-5 grid gap-3">
            <ActionButton
              href="/admin/dashboard/email"
              title="Emails"
              desc="Send updates + announcements"
            />
            <ActionButton
              href="/admin/dashboard/events"
              title="Events"
              desc="Create & manage events"
            />
            <ActionButton
              href="/admin/dashboard"
              title="Reports (soon)"
              desc="Stats & exports later"
              disabled
            />
          </div>
        </Card>
      </section>

      {/* Secondary grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Upcoming events</h2>
            <Link
              href="/admin/dashboard/events"
              className="text-sm font-semibold text-white/70 hover:text-white transition"
            >
              Manage →
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            <ListRow title="No events yet" meta="Add your first event" />
            <ListRow title="—" meta="—" muted />
            <ListRow title="—" meta="—" muted />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Emails queue</h2>
            <Link
              href="/admin/dashboard/email"
              className="text-sm font-semibold text-white/70 hover:text-white transition"
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
        "rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl p-6",
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
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl p-5">
      <div className="text-xs text-white/70">{title}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
      <div className="mt-2 text-xs text-white/60">{sub}</div>
    </div>
  );
}

function ActivityItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-white/60">{meta}</div>
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
        "flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3",
        muted ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-white/60">{meta}</div>
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
        <div className="text-xs text-white/60 mt-1">{desc}</div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 hover:bg-black/30 transition"
    >
      <div className="font-extrabold">{title}</div>
      <div className="text-xs text-white/60 mt-1">{desc}</div>
    </Link>
  );
}

function QuickPick({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left rounded-3xl border backdrop-blur-xl shadow-xl p-5 transition",
        active
          ? "border-white/25 bg-white/15"
          : "border-white/10 bg-white/10 hover:bg-white/15",
      ].join(" ")}
    >
      <div className="font-extrabold">{title}</div>
      <div className="text-xs text-white/70 mt-1">{desc}</div>
    </button>
  );
}