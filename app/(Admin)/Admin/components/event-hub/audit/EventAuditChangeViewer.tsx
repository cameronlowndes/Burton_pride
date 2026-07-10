import { ArrowRight, FileDiff } from "lucide-react";

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export default function EventAuditChangeViewer({
  changes,
}: {
  changes: Record<string, any> | null | undefined;
}) {
  const entries = Object.entries(changes || {});

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
        No field-level changes were recorded for this action.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([field, change]) => (
        <article key={field} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <FileDiff className="h-4 w-4 text-cyan-200" />
            <h4 className="break-all text-sm font-black text-white">
              {field.replaceAll("_", " ")}
            </h4>
          </header>
          <div className="grid gap-2 p-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
            <div className="min-w-0 rounded-xl border border-red-300/15 bg-red-500/10 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-100/70">Before</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-white/80">{display(change?.before)}</pre>
            </div>
            <div className="flex items-center justify-center px-2 py-1 text-white/35">
              <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
            </div>
            <div className="min-w-0 rounded-xl border border-emerald-300/15 bg-emerald-500/10 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/70">After</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-white/80">{display(change?.after)}</pre>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
