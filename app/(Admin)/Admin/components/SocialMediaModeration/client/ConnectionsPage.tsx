import OpenAIConnectionCheck from "../Server/OpenAIConnectionCheck";
import { db, evidenceAdmin, londonDate } from "../Server/Documents/evidence";

export const dynamic = "force-dynamic";

const providers = [
  { platform: "facebook", name: "Facebook Page", description: "Receives comment events from the Burton Pride Page." },
  { platform: "instagram", name: "Instagram", description: "Receives comments from Burton Pride’s connected professional account." },
] as const;
const card = "min-w-0 rounded-2xl border border-white/15 bg-slate-900/70 p-5";

function diagnostic(error: string | null) {
  if (!error) return null;
  if (/missing|not configured/i.test(error)) return "The worker reports missing configuration.";
  if (/expired|invalid.*token/i.test(error)) return "The worker reports a credential problem.";
  if (/permission|scope/i.test(error)) return "The worker reports a permission problem. Check the app permissions, token and account access.";
  return "The worker reported a connection issue. Check its private logs.";
}

export default async function ModerationConnectionsPage() {
  if (!(await evidenceAdmin())) {
    return <main className="p-6"><h1>Connections</h1><p>Connections are restricted to main admins.</p></main>;
  }

  const result = await db.from("moderation_connections").select("platform,status,checked_at,error")
    .in("platform", providers.map(provider => provider.platform));

  return (
    <main className="w-full min-w-0 space-y-5 px-3 py-6 text-white sm:px-4">
      <header className="border-b border-white/15 pb-5">
        <p className="text-sm font-semibold text-purple-200">Burton Pride · Social Media Moderation</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Connections</h1>
        <p className="mt-2 text-slate-300">Check what the moderation worker last reported for Meta and see how OpenAI fits into the review process.</p>
      </header>
      {result.error && <p role="alert" className={card}>Saved connection checks could not load. Refresh to try again.</p>}
      <section aria-label="Moderation providers" className="grid gap-4 lg:grid-cols-2">
        {providers.map(provider => {
          const check = result.data?.find(row => row.platform === provider.platform);
          const checked = check?.checked_at ? new Date(check.checked_at) : null;
          const warning = diagnostic(check?.error ?? null);
          return <article key={provider.platform} className={card}>
            <h2 className="text-lg font-semibold">{provider.name}</h2>
            <p className="mt-1 text-sm text-slate-300">{provider.description}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-300">Last saved status</dt>
                <dd className="font-semibold">{result.error ? "Unavailable" : check?.status ?? "No check recorded"}</dd></div>
              <div><dt className="text-slate-300">Last checked · UK time</dt>
                <dd>{checked && Number.isFinite(checked.getTime()) ? londonDate.format(checked) : "Unavailable"}</dd></div>
            </dl>
            {warning && <p className="mt-4 rounded-lg border border-amber-300/25 bg-amber-400/10 p-3 text-sm text-amber-100">{warning}</p>}
          </article>;
        })}
      </section>
      <section className={card} aria-labelledby="openai-heading">
        <h2 id="openai-heading" className="text-xl font-semibold">OpenAI Moderation</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">OpenAI can flag potentially harmful comment text for review. Burton Pride’s moderation policy and review process determine what happens next.</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-white/15 p-4">
            <dt className="text-slate-300">Requested model</dt>
            <dd className="mt-1 break-words font-mono text-purple-200">omni-moderation-latest</dd>
            <dd className="mt-2 text-slate-300">The connection test also shows the model name returned by OpenAI.</dd>
          </div>
          <div className="rounded-xl border border-white/15 p-4">
            <dt className="text-slate-300">OpenAI API pricing</dt>
            <dd className="mt-1 font-semibold text-emerald-200">Free moderation endpoint</dd>
            <dd className="mt-2 text-slate-300">An OpenAI API key is required. Hosting and other API features have separate pricing.</dd>
          </div>
          <div className="rounded-xl border border-white/15 p-4">
            <dt className="text-slate-300">Purpose</dt>
            <dd className="mt-1 font-semibold">Comment text classification</dd>
            <dd className="mt-2 text-slate-300">Returns a flag and categories such as hate or harassment. The current adapter sends text only.</dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <OpenAIConnectionCheck />
          <div className="rounded-xl border border-white/15 p-4 text-sm text-slate-300">
            <h3 className="font-semibold text-white">What a successful test means</h3>
            <p className="mt-2">Supabase reached the OpenAI moderation endpoint and received a valid response. The test does not activate comment processing or take any action on Meta.</p>
            <h3 className="mt-4 font-semibold text-white">When the worker is wired in</h3>
            <p className="mt-2">The worker can send the comment text needed for classification and use the result to route items into Queue. If classification is unavailable, the worker should retry or leave the item for manual review.</p>
            <a className="mt-4 inline-block text-purple-200 underline" href="https://developers.openai.com/api/docs/guides/moderation">OpenAI model and pricing documentation</a>
          </div>
        </div>
      </section>
      <section className={card} aria-labelledby="next-steps">
        <h2 id="next-steps" className="text-lg font-semibold">Connection checklist</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-200">
          <li>Verify account access and comment permissions separately for Facebook and Instagram.</li>
          <li>Send a test comment on each platform and check that a matching job reaches the worker.</li>
          <li>Test OpenAI from the worker using synthetic text and keep the first rollout in review mode.</li>
          <li>Use a test comment to verify a staff-approved platform action and its outcome in History.</li>
        </ol>
      </section>
    </main>
  );
}
