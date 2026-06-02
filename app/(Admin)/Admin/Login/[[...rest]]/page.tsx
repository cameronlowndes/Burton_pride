"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase/supabaseClient";

type DebugDetails = {
  title: string;
  message: string;
  likelyFix?: string;
  extra?: unknown;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DebugDetails | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const loginResult = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginResult.error) {
        setError({
          title: "Login failed",
          message: loginResult.error.message,
          likelyFix:
            "Check the email/password in Supabase Authentication > Users. Make sure the user exists and has a confirmed email.",
          extra: {
            status: loginResult.error.status,
            code: loginResult.error.code,
            name: loginResult.error.name,
          },
        });
        return;
      }

      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error || !sessionResult.data.session) {
        setError({
          title: "Login worked, but no session was saved",
          message:
            sessionResult.error?.message ??
            "Supabase did not return a browser session after login.",
          likelyFix:
            "Check lib/supabase/supabaseClient.ts. For App Router auth, it should normally use createBrowserClient from @supabase/ssr.",
          extra: sessionResult.error ?? null,
        });
        return;
      }

      const permissionResponse = await fetch(
        `/api/admin/me/permissions?t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        }
      );

      const permissionText = await permissionResponse.text();

      let permissionJson: any = null;
      try {
        permissionJson = JSON.parse(permissionText);
      } catch {
        permissionJson = null;
      }

      if (!permissionResponse.ok) {
        setError({
          title: "Login worked, but admin permissions failed",
          message:
            permissionJson?.message ??
            permissionJson?.error ??
            `Permissions API returned HTTP ${permissionResponse.status}.`,
          likelyFix:
            permissionJson?.likelyFix ??
            "Check public.admin_users. Make sure supabase_user_id matches auth.users.id and is_active is true.",
          extra: permissionJson ?? permissionText,
        });
        return;
      }

      router.push("/Admin/Dashboard");
      router.refresh();
    } catch (err) {
      setError({
        title: "Unexpected login error",
        message:
          err instanceof Error
            ? err.message
            : "Something crashed while trying to sign in.",
        likelyFix:
          "Check the browser console and Vercel/terminal logs for the full error.",
        extra: err instanceof Error ? err.stack : err,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.28),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.24),transparent_34%),linear-gradient(180deg,#07111f_0%,#111827_50%,#020617_100%)]" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl" />
      <div className="absolute -right-24 bottom-20 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-white/75 backdrop-blur">
            <Sparkles className="h-4 w-4 text-pink-200" />
            Burton Pride Admin Portal
          </div>

          <h1 className="mt-6 max-w-2xl text-5xl font-black tracking-tight text-white xl:text-6xl">
            Welcome back to your admin dashboard.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-white/70">
            Sign in with your Supabase admin account to manage pages, money,
            donations, raffle tools, sponsors and portal settings.
          </p>

          <div className="mt-8 grid max-w-xl gap-4 sm:grid-cols-2">
            <InfoCard title="Secure access" text="Protected by Supabase login." />
            <InfoCard title="Admin controls" text="Permissions decide what each admin can access." />
          </div>
        </section>

        <section className="w-full">
          <div className="overflow-hidden rounded-[36px] border border-white/10 bg-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
            <div className="border-b border-white/10 bg-gradient-to-r from-pink-600/80 via-purple-600/80 to-blue-600/80 p-7">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/20 shadow-lg">
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>

                <div>
                  <h1 className="text-2xl font-black text-white">
                    Admin Login
                  </h1>
                  <p className="mt-1 text-sm font-medium text-white/75">
                    Supabase admin account required
                  </p>
                </div>
              </div>
            </div>

            <div className="p-7">
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-bold text-white/85">
                    Email address
                  </label>

                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/50 focus:bg-black/35"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-white/85">
                    Password
                  </label>

                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 transition focus-within:border-pink-300/50 focus-within:bg-black/35">
                    <Lock className="h-4 w-4 shrink-0 text-white/45" />

                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                      placeholder="Enter password"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="rounded-xl p-1 text-white/55 transition hover:bg-white/10 hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-400/30 bg-red-500/15 p-4 text-sm text-red-50">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />

                      <div className="min-w-0 flex-1">
                        <p className="font-black">{error.title}</p>
                        <p className="mt-1 leading-6 text-red-50/90">
                          {error.message}
                        </p>

                        {error.likelyFix ? (
                          <div className="mt-3 rounded-xl bg-black/25 p-3">
                            <p className="font-bold">Likely fix</p>
                            <p className="mt-1 text-red-100">
                              {error.likelyFix}
                            </p>
                          </div>
                        ) : null}

                        {error.extra ? (
                          <details className="mt-3 rounded-xl bg-black/25 p-3">
                            <summary className="cursor-pointer font-bold">
                              Technical details
                            </summary>
                            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-red-100">
                              {JSON.stringify(error.extra, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-black shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in to admin portal"}
                  {!loading ? <ArrowRight className="h-4 w-4" /> : null}
                </button>
              </form>

              <p className="mt-5 text-center text-xs leading-5 text-white/50">
                Access is checked against Supabase Admin Users & Permissions
                after login.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/60">{text}</p>
    </div>
  );
}