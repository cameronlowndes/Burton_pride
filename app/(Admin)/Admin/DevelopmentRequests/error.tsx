"use client";
export default function DevelopmentRequestsError({ reset }: { error: Error; reset: () => void }) {
  return <section role="alert" className="space-y-4 p-6 text-white"><h1 className="text-2xl font-bold">Development Requests could not be loaded</h1><p>The page or secure account checks are unavailable. Check the installation, then try again or sign in again.</p><button type="button" onClick={reset} className="rounded-xl border px-4 py-3">Try again</button><a className="ml-4 underline" href="/Admin/Login">Sign in again</a></section>;
}
