export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Dashboard</h1>
          <p className="text-white/80">
            Welcome to the Burton Pride committee admin portal.
          </p>
        </div>

        <div className="flex gap-3">
          <a
            href="/admin/dashboard/email"
            className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition"
          >
            Send email
          </a>
          <a
            href="/admin/dashboard/events"
            className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition"
          >
            Create event
          </a>
        </div>
      </div>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Emails sent (30 days)" value="—" sub="Connect backend to show live data" />
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
            <ActivityItem title="Login page ready (test button)" meta="Today" />
          </div>
        </Card>

        {/* Right: Quick actions */}
        <Card>
          <h2 className="text-lg font-extrabold">Quick actions</h2>

          <div className="mt-5 grid gap-3">
            <ActionButton href="/admin/dashboard/email" title="Emails" desc="Send updates + announcements" />
            <ActionButton href="/admin/dashboard/events" title="Events" desc="Create & manage events" />
            <ActionButton href="/admin/dashboard" title="Reports (soon)" desc="Stats & exports later" disabled />
          </div>
        </Card>
      </section>

      {/* Secondary grid */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Upcoming events</h2>
            <a
              href="/admin/dashboard/events"
              className="text-sm font-semibold text-white/70 hover:text-white transition"
            >
              Manage →
            </a>
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
            <a
              href="/admin/dashboard/email"
              className="text-sm font-semibold text-white/70 hover:text-white transition"
            >
              Open →
            </a>
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
    <a
      href={href}
      className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 hover:bg-black/30 transition"
    >
      <div className="font-extrabold">{title}</div>
      <div className="text-xs text-white/60 mt-1">{desc}</div>
    </a>
  );
}
