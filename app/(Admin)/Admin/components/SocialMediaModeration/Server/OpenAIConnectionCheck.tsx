"use client";

import { useActionState } from "react";
import { checkOpenAI, type OpenAICheck } from "./check-openai";

export default function OpenAIConnectionCheck() {
  const [result, runCheck, pending] = useActionState<OpenAICheck | null>(
    () => checkOpenAI(),
    null,
  );

  return (
    <div className="rounded-xl border border-white/15 bg-slate-950/50 p-4">
      <h3 className="font-semibold">Check the connection</h3>
      <p className="mt-1 text-sm text-slate-300">Supabase sends a fixed test phrase to OpenAI using its saved API key. The test uses no Facebook or Instagram comments.</p>
      <form action={runCheck} className="mt-4">
        <button type="submit" disabled={pending}
          className="min-h-11 rounded-lg border border-purple-300/45 bg-purple-500/25 px-4 py-2 text-sm font-semibold text-purple-100 hover:bg-purple-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:opacity-60">
          {pending ? "Checking OpenAI…" : "Connect to OpenAI · Run test"}
        </button>
      </form>
      <div role="status" className="mt-3 text-sm">
        {pending ? <p className="text-slate-300">Waiting for the Supabase check.</p> :
          result ? <div className={result.status === "success" ? "text-emerald-200" : "text-amber-200"}>
            <p>{result.message}</p>
            {result.checkedAt && <p className="mt-1 text-slate-300">Checked {result.checkedAt}</p>}
          </div> : <p className="text-slate-400">No test run on this page visit.</p>}
      </div>
    </div>
  );
}
