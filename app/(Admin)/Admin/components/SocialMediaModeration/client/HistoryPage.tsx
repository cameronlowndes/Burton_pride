import Link from "next/link";
import HistoryEventDialog from "../Server/HistoryEventDialog";
import { db, evidenceAdmin, londonDate, PAGE as DOCUMENTS } from "../Server/Documents/evidence";
import {
  FIELDS, HISTORY, PAGE_SIZE, PLATFORMS, SOURCES, TABS,
  filters, historyLink, loadHistory, relatedHistory,
  type HistoryEvent, type Parameters,
} from "../Server/HistoryServer";

export const dynamic = "force-dynamic";

const panel = "min-w-0 rounded-2xl border border-white/15 bg-slate-900/70 p-4 sm:p-5";
const control = "min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300";
const link = "inline-flex min-h-11 items-center font-medium text-purple-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2";
const results = {
  review: "Awaiting review", confirmed: "Confirmed", approved: "Approved", requested: "Requested",
  failed: "Failed", denied: "Denied", unknown: "Outcome unknown", done: "Job completed",
} as const;

function label(value: string | null) {
  if (!value) return "Unavailable";
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function outcome(event: HistoryEvent) {
  return results[event.outcome as keyof typeof results] ?? label(event.outcome);
}

async function loadAdminNames(events: HistoryEvent[]) {
  const ids = [...new Set(events.flatMap(event => event.admin_id ? [event.admin_id] : []))];
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const { data, error } = await db.from("admin_users").select("id,full_name,name").in("id", ids);
  if (error) return names;

  for (const admin of data ?? []) {
    const name = [admin.full_name?.trim(), admin.name?.trim()]
      .find(value => value && !value.includes("@"));
    if (name) names.set(String(admin.id), name);
  }
  return names;
}

function actor(event: HistoryEvent, adminNames: ReadonlyMap<string, string>) {
  if (event.admin_id) return adminNames.get(event.admin_id) ?? "Admin name unavailable";
  if (event.actor_kind === "reviewer" || event.actor_kind === "admin") return "Admin not recorded";
  if (event.actor_kind === "unrecorded") return "Actor unavailable";
  return label(event.actor_kind);
}

const serviceActions: Record<string, string> = {
  start: "Start moderation",
  stop: "Stop moderation",
  restart: "Restart moderation",
  refresh: "Refresh moderation",
};

function eventLabel(event: HistoryEvent) {
  if (event.source === "job") return "Comment processing";
  if (event.source === "service" && event.kind === "automatic") return "Automatic service activity";
  if (event.source === "service" || event.source === "audit") {
    return serviceActions[event.kind] ?? `Moderation service · ${label(event.kind)}`;
  }
  if (event.source === "decision") return `Comment review · ${label(event.kind)}`;
  return label(event.kind);
}

function explanation(event: HistoryEvent) {
  const auditOutcomes: Record<string, string> = {
    attempt: "The app logged a request to change the moderation service. This entry records the attempt.",
    accepted: "The app accepted the admin’s request. Look for a service entry to see the recorded execution result.",
    password_verified: "The Main Admin password check passed for this request.",
    password_rejected: "The Main Admin password check failed for this request.",
    totp_verified: "The authenticator check passed for this request.",
    proof_rejected: "The app rejected the verification for this request.",
    command_rejected: "The app rejected the service command.",
  };
  if (event.source === "audit") return auditOutcomes[event.outcome] ?? "The app recorded this outcome for an admin request.";
  if (event.source === "service") return event.kind === "automatic"
    ? "The moderation service logged an automatic action. The result below is what the service recorded."
    : "The moderation service logged the execution result for this action.";
  if (event.source === "job") return "The worker recorded the processing status for this comment. Open the job for its processing details.";
  if (event.source === "decision") return "This entry records the moderation decision and its saved action status.";
  if (event.outcome === "approved") return "This action was approved. Look for a separate confirmed event to verify that it happened.";
  if (event.outcome === "unknown") return "The result could not be verified. Check related activity for a later outcome.";
  if (event.kind === "platform_action" && event.outcome === "confirmed") return "The platform confirmed this moderation action.";
  return "This entry shows the outcome recorded by the moderation app.";
}

function Options({ values }: { values: Record<string, string> }) {
  return Object.entries(values).map(([value, name]) => <option key={value} value={value}>{name}</option>);
}

async function EventDetails({ event, actorName }: { event: HistoryEvent; actorName: string }) {
  const related = await relatedHistory(event);
  const fields = [
    ["Source", SOURCES[event.source]],
    ["Platform", event.platform && (PLATFORMS[event.platform] ?? label(event.platform))],
    ["Connected account", event.account_ref],
    ["Before", event.before_state], ["After", event.after_state],
    ["Reason", event.reason_code ? label(event.reason_code) : "Unavailable"],
  ] as const;
  const references = [
    ["Event ID", event.event_id], ["Case reference", event.case_ref],
    ["Job ID", event.job_id], ["Comment ID", event.comment_id],
    ["Attempts", event.attempts], ["Linked event", event.related_event_key],
  ] as const;
  const jobQuery = new URLSearchParams(event.job_id ? { job: event.job_id } : {}).toString();

  return (
    <section className="p-5 sm:p-6">
      <h2 id="event-detail-heading" className="mt-1 text-xl font-semibold">{eventLabel(event)}</h2>
      <p className="mt-1 text-sm text-slate-300">
        {outcome(event)} · {actorName} · {londonDate.format(new Date(event.occurred_at))}
      </p>
      <p className="mt-4 rounded-lg border border-purple-300/20 bg-purple-500/10 p-3 text-sm leading-relaxed text-slate-100">{explanation(event)}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {fields.filter(([, value]) => value !== null).map(([name, value]) => (
          <div key={name} className="min-w-0">
            <dt className="text-slate-300">{name}</dt><dd className="break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-4 rounded-lg border border-white/15 p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Technical details</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {references.filter(([, value]) => value !== null).map(([name, value]) => (
            <div key={name}><dt className="text-slate-300">{name}</dt><dd className="break-all">{value}</dd></div>
          ))}
        </dl>
      </details>
      {event.job_id && <div className="mt-3 flex flex-wrap gap-x-5">
        <Link className={link} href={`/Admin/SocialMediaModeration/Jobs?${jobQuery}`}>Open job</Link>
        <Link className={link} href={`${DOCUMENTS}?${jobQuery}`}>Open evidence in Documents</Link>
      </div>}
      {related && <div className="mt-4 border-t border-white/15 pt-4">
        <h3 className="font-semibold">Related activity</h3>
        {related.error ? <p role="alert">Related activity could not load.</p> :
          <ol className="mt-2 space-y-2 text-sm text-slate-200">
            {(related.data ?? []).filter(row => row.event_id !== event.event_id).slice(0, 20).map(row => <li key={row.event_id}>
              {londonDate.format(new Date(row.occurred_at))} · {eventLabel(row)} · {outcome(row)}
            </li>)}
          </ol>}
        {(related.data?.length ?? 0) > 20 && <Link className={link} href={historyLink(filters({
          days: "all", field: event.case_ref ? "case_ref" : "job_id", q: event.case_ref ?? event.job_id ?? "",
        }))}>See all related activity</Link>}
      </div>}
    </section>
  );
}

export default async function ModerationHistoryPage({ searchParams }: { searchParams: Promise<Parameters> }) {
  if (!(await evidenceAdmin())) {
    return <main className="p-6"><h1>Moderation History</h1><p>History is restricted to main admins.</p></main>;
  }

  const params = await searchParams;
  const f = filters(params);
  const data = f.invalid ? null : await loadHistory(f).catch(() => null);
  const [feed, review, failed, confirmed] = data ?? [];
  const rows = feed?.data?.slice(0, PAGE_SIZE) ?? [];
  const selected = typeof params.event === "string" ? rows.find(row => row.event_id === params.event) : undefined;
  const adminNames = await loadAdminNames(rows);
  const groups = [
    { name: "Awaiting review now", value: review?.count, href: historyLink(filters({ tab: "social", days: "all", source: "decision", result: "review" })) },
    { name: "Confirmed actions in period", value: confirmed?.count, href: historyLink(filters({ tab: "social", days: f.days, source: "event", kind: "platform_action", result: "confirmed" })) },
    { name: "Failed jobs now", value: failed?.count, href: historyLink(filters({ tab: "social", days: "all", source: "job", result: "failed" })) },
  ];

  return (
    <main className="w-full min-w-0 space-y-5 px-3 py-6 text-white sm:px-4">
      <header className="border-b border-white/15 pb-5">
        <p className="text-sm font-semibold text-purple-200">Burton Pride · Social Media Moderation</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Moderation History</h1>
        <p className="mt-2 text-slate-300">Follow Facebook and Instagram actions, worker runs and changes made by admins.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {groups.map(item => <div key={item.name} className={panel}>
          <p className="text-2xl font-semibold tabular-nums">{item.value ?? "Unavailable"}</p>
          {item.href ? <Link href={item.href} className={link}>{item.name}</Link> :
            <p className="py-2 text-sm text-slate-300">{item.name}</p>}
        </div>)}
      </div>

      <nav aria-label="Activity views" className="flex flex-wrap gap-2 border-b border-white/15 pb-3">
        {Object.entries(TABS).map(([tab, name]) => {
          const active = f.tab === tab;
          const appearance = active
            ? "border-purple-400/60 bg-purple-500/25 text-purple-100"
            : "border-white/15 bg-slate-900 text-slate-300 hover:border-purple-300/50 hover:bg-slate-800 hover:text-white";

          return (
            <Link
              key={tab}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 ${appearance}`}
              href={historyLink(f, { tab: tab as keyof typeof TABS, page: 1 })}
            >
              {name}
            </Link>
          );
        })}
      </nav>

      <form action={HISTORY} className={`${panel} grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4`}>
        <input type="hidden" name="tab" value={f.tab} />
        <label className="grid gap-1">Search by
          <select name="field" defaultValue={f.field} className={control}><Options values={FIELDS} /></select>
        </label>
        <label className="grid gap-1">Exact reference or name
          <input name="q" maxLength={120} defaultValue={f.q} className={control} />
        </label>
        <label className="grid gap-1">Platform
          <select name="platform" defaultValue={f.platform ?? ""} className={control}>
            <option value="">All platforms</option><Options values={PLATFORMS} />
          </select>
        </label>
        <label className="grid gap-1">Period
          <select name="days" defaultValue={f.days} className={control}>
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option><option value="all">All dates</option>
          </select>
        </label>
        <label className="grid gap-1">Event source
          <select name="source" defaultValue={f.source ?? ""} className={control}>
            <option value="">All sources</option><Options values={SOURCES} />
          </select>
        </label>
        <label className="grid gap-1">Connected account reference
          <input name="account" maxLength={120} pattern={"[a-zA-Z0-9:_\\-]+"} defaultValue={f.account} className={control} />
        </label>
        <label className="grid gap-1">Event type code
          <input name="kind" maxLength={80} pattern="[a-z][a-z0-9_]*" placeholder="e.g. restart" defaultValue={f.kind} className={control} />
        </label>
        <label className="grid gap-1">Result
          <select name="result" defaultValue={f.result} className={control}>
            <option value="">All results</option><Options values={results} />
            {f.result && !(f.result in results) && <option value={f.result}>{label(f.result)}</option>}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-x-4 sm:col-span-2">
          <button type="submit" className={`${control} w-auto font-semibold hover:bg-slate-800`}>Apply filters</button>
          <Link href={`${HISTORY}?tab=${f.tab}`} className={link}>Clear filters</Link>
        </div>
      </form>

      {selected && <HistoryEventDialog key={selected.event_id} closeHref={historyLink(f)}>
        <EventDetails event={selected} actorName={actor(selected, adminNames)} />
      </HistoryEventDialog>}

      <section aria-labelledby="history-feed">
        <h2 id="history-feed" className="text-xl font-semibold">Recorded activity</h2>
        <p className="mb-3 text-sm text-slate-300">Newest first · UK local time · Older records may have limited detail.</p>
        {f.invalid ? <p className={panel} role="alert">Enter a valid name or reference for the selected search field.</p> :
          (!data || feed?.error) ? <p className={panel} role="alert">History could not load. Refresh the page to try again.</p> :
          rows.length === 0 ? <p className={panel}>{f.q || f.platform || f.source || f.result || f.account || f.kind
            ? "No activity matches these filters." : "No activity recorded for this view and period."}</p> :
          <ul className="divide-y divide-white/15 overflow-hidden rounded-xl border border-white/15 bg-slate-900/60">
            {rows.map(row => {
              const href = historyLink(f) + "&event=" + encodeURIComponent(row.event_id);
              const attention = ["failed", "denied", "unknown", "command_rejected", "password_rejected"].includes(row.outcome);
              return <li key={row.event_id}>
                <Link
                  href={href}
                  scroll={false}
                  aria-haspopup="dialog"
                  className="grid gap-2 px-4 py-3 text-sm hover:bg-purple-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-300 md:grid-cols-[11rem_minmax(0,1fr)_minmax(8rem,16rem)_minmax(7rem,10rem)_auto] md:items-center md:gap-3"
                >
                  <time className="text-xs text-slate-300" dateTime={row.occurred_at}>{londonDate.format(new Date(row.occurred_at))}</time>
                  <div className="min-w-0 break-words">
                    <p className="font-semibold text-white">{eventLabel(row)}</p>
                    <p className="mt-0.5 text-xs text-slate-300">{row.platform ? PLATFORMS[row.platform] ?? label(row.platform) : SOURCES[row.source]}</p>
                  </div>
                  <p className="min-w-0 break-words text-slate-200">{actor(row, adminNames)}</p>
                  <span className={`w-fit rounded-md border px-2 py-1 text-xs font-medium ${attention
                    ? "border-amber-400/35 bg-amber-400/10 text-amber-100"
                    : "border-white/15 bg-white/5 text-slate-200"}`}>{outcome(row)}</span>
                  <span aria-hidden="true" className="text-xs font-semibold text-purple-200">View details →</span>
                </Link>
              </li>;
            })}
          </ul>}
        {!feed?.error && !f.invalid && (f.page > 1 || (feed?.data?.length ?? 0) > PAGE_SIZE) &&
          <nav aria-label="History pages" className="mt-3 flex items-center gap-4 text-sm">
            {f.page > 1 && <Link className={link} href={historyLink(f, { page: f.page - 1 })}>Previous</Link>}
            <span>Page {f.page}</span>
            {(feed?.data?.length ?? 0) > PAGE_SIZE && f.page < 9999 &&
              <Link className={link} href={historyLink(f, { page: f.page + 1 })}>Next</Link>}
          </nav>}
      </section>
    </main>
  );
}
