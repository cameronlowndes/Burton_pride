"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Lock, Eye, EyeOff, Clock3, Loader2 } from "lucide-react";

type Props = {
  mode: string;
  pageId: string;
  route: string;
  badge: string;
  title: string;
  message: string;
  iconName: "lock" | "clock" | "hidden";
};

function StatusIcon({ iconName }: { iconName: Props["iconName"] }) {
  if (iconName === "lock") return <Lock className="h-3.5 w-3.5" />;
  if (iconName === "clock") return <Clock3 className="h-3.5 w-3.5" />;
  return <EyeOff className="h-3.5 w-3.5" />;
}

export default function PageStatusCard({
  mode,
  pageId,
  route,
  badge,
  title,
  message,
  iconName,
}: Props) {
  const router = useRouter();
  const isLocked = mode === "locked";

  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();

    if (!password.trim()) {
      setError("Please enter the page password.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const res = await fetch("/api/admin/site-pages/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          pageId,
          route,
          password: password.trim(),
        }),
      });

      const text = await res.text();

      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        console.error("Unlock API returned non-JSON response:", {
          status: res.status,
          statusText: res.statusText,
          responseText: text,
        });

        throw new Error(
          `Unlock API did not return JSON. Status: ${res.status}. Check that app/api/admin/site-pages/unlock/route.ts exists and that the fetch URL matches.`
        );
      }

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Incorrect password.");
      }

      router.push(route);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-2xl rounded-[30px] border border-white/15 bg-white/10 px-6 py-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:px-10 sm:py-12">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
        <StatusIcon iconName={iconName} />
        {badge}
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
        {title}
      </h1>

      <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
        {message}
      </p>

      {isLocked ? (
        <form onSubmit={handleUnlock} className="mx-auto mt-8 max-w-md">
          <label className="block text-left">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Page password
            </span>

            <div className="flex items-center gap-2">
              <input
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);

                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Enter page password"
                disabled={submitting}
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                disabled={submitting}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPasswordVisible((current) => !current)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                title={passwordVisible ? "Hide password" : "Show password"}
              >
                {passwordVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>

          {error ? (
            <div className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="submit"
              disabled={submitting || !password.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Unlock page
                </>
              )}
            </button>

            <Link
              href="/"
              prefetch={false}
              className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              Go to homepage
            </Link>
          </div>

          <p className="mt-4 text-xs leading-5 text-white/45">
            If this shows “Unlock API did not return JSON”, check that your API
            file is exactly at app/api/admin/site-pages/unlock/route.ts and that
            there is no old fetch still using /api/site-pages/unlock.
          </p>
        </form>
      ) : (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Go to homepage
          </Link>

          <Link
            href="/Contact"
            prefetch={false}
            className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Contact us
          </Link>
        </div>
      )}
    </div>
  );
}