"use client";
export default function ModerationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="space-y-4 p-6 text-white"><h2 className="text-xl font-bold">Moderation is temporarily unavailable</h2><p>The screen or its access checks could not be loaded. Try again, or sign in again if your session has expired.</p><button type="button" onClick={reset} className="min-h-11 rounded-xl border px-4 py-2">Try again</button><a className="ml-4 underline" href="/Admin/Login">Sign in again</a></section>;
}
