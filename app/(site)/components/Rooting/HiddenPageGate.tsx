"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";

type Props = {
  route: string;
  title: string;
  message: string;
  requiresPassword: boolean;
};

export default function HiddenPageGate({
  route,
  title,
  message,
  requiresPassword,
}: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setLoading(true);

    try {
      const res = await fetch("/api/site-pages/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route,
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to unlock page");
      }

      setNotice("Page unlocked. Loading...");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to unlock page");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-3xl rounded-[32px] border border-white/20 bg-white/10 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-12">
      <div className="mx-auto inline-flex rounded-full border border-rose-300/40 bg-rose-400/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-rose-100">
        Hidden by admin
      </div>

      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
        {title}
      </h1>

      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
        {message}
      </p>

      {requiresPassword ? (
        <form onSubmit={handleUnlock} className="mx-auto mt-8 max-w-md">
          <label className="block text-left">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/60">
              Enter password to view
            </span>
            <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-4 py-3">
              <Lock className="h-4 w-4 text-white/45" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                placeholder="Enter page password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/15 px-5 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? "Unlocking..." : "Unlock page"}
          </button>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
              {notice}
            </div>
          ) : null}
        </form>
      ) : null}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Go to homepage
        </a>

        <a
          href="/contact"
          className="inline-flex items-center justify-center rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-5 py-3 text-sm font-semibold text-yellow-50 transition hover:bg-yellow-400/20"
        >
          Contact us
        </a>
      </div>
    </div>
  );
}