"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartHandshake,
  Lock,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

type LoginResponse = {
  ok?: boolean;
  message?: string;
  error?: string;
};

type LoginError = {
  title: string;
  message: string;
};

function parseLoginError(status: number, json: LoginResponse | null): LoginError {
  if (status === 403) {
    return {
      title: "Access not approved",
      message:
        json?.message ||
        "This admin area is for approved committee members only. Access must be approved by the Burton Pride committee.",
    };
  }

  if (status === 401) {
    return {
      title: "Incorrect login details",
      message: "Please check your email address and password, then try again.",
    };
  }

  return {
    title: "Login failed",
    message:
      json?.message ||
      "We could not sign you in right now. Please check your details and try again.",
  };
}

const communityPoints = [
  {
    title: "Community led",
    text: "Built by community, for the community.",
    icon: Users,
  },
  {
    title: "Committee members only",
    text: "Only approved committee members can access this portal.",
    icon: ShieldCheck,
  },
  {
    title: "Admin tools",
    text: "Manage key portal work safely in one place.",
    icon: HeartHandshake,
  },
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!cleanEmail || !password) {
        setError({
          title: "Missing details",
          message: "Please enter your email address and password.",
        });
        return;
      }

      const response = await fetch("/api/admin/settings/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      let json: LoginResponse | null = null;

      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (!response.ok || !json?.ok) {
        setError(parseLoginError(response.status, json));
        return;
      }

      router.push("/Admin/Dashboard");
      router.refresh();
    } catch {
      setError({
        title: "Something went wrong",
        message: "Please refresh the page and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] px-4 py-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(236,72,153,0.34),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(59,130,246,0.3),transparent_32%),linear-gradient(135deg,#050816_0%,#160b2d_45%,#06152e_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl" />
      <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur-2xl lg:grid-cols-[1fr_0.95fr] lg:rounded-[2.75rem]">
          <section className="relative hidden min-h-[760px] overflow-hidden p-12 xl:p-14 lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/25 via-purple-500/15 to-blue-500/20" />
            <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-pink-400/30 blur-3xl" />
            <div className="absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-blue-400/25 blur-3xl" />

            <div className="relative z-10 flex h-full flex-col justify-between gap-12">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-white/80">
                  <Sparkles className="h-4 w-4 text-pink-100" />
                  Burton Pride Admin Portal
                </div>

                <h1 className="mt-10 max-w-xl text-5xl font-black leading-[1.2] tracking-tight">
                  Burton Pride
                  <span className="block bg-gradient-to-r from-pink-200 via-purple-100 to-blue-200 bg-clip-text text-transparent">
                    built by community, for the community.
                  </span>
                </h1>

                <p className="mt-8 max-w-lg text-lg leading-9 text-white/72">
                  Sign in to continue managing the Burton Pride admin portal.
                  This space helps the team keep community work organised,
                  protected, and easier to manage.
                </p>

                <div className="mt-10 grid gap-5">
                  {communityPoints.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="flex gap-4 rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-xl"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                          <Icon className="h-6 w-6 text-pink-100" />
                        </div>

                        <div>
                          <p className="font-black text-white">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-white/60">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 backdrop-blur-xl">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-white/55">
                  Approved access only
                </p>
                <p className="mt-3 text-2xl font-black text-white">
                  Committee member only
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Access is for approved Burton Pride committee members only and
                  must be approved by the committee.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-[#111827]/85 p-8 sm:p-10 lg:p-12 xl:p-14">
            <div className="mx-auto flex min-h-[650px] max-w-md flex-col justify-center">
              <div className="mb-8">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 shadow-lg">
                  <ShieldCheck className="h-8 w-8" />
                </div>

                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-pink-200/80">
                  Burton Pride
                </p>

                <h2 className="text-3xl font-black">Admin Login</h2>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  Built by community, for the community. Sign in with your
                  approved committee member account.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="mb-3 block text-sm font-bold text-white/85">
                    Email address
                  </label>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4 transition focus-within:border-pink-300/60 focus-within:bg-white/[0.1]">
                    <Mail className="h-4 w-4 shrink-0 text-white/45" />

                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-bold text-white/85">
                    Password
                  </label>

                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4 transition focus-within:border-pink-300/60 focus-within:bg-white/[0.1]">
                    <Lock className="h-4 w-4 shrink-0 text-white/45" />

                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/35"
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

                {error && (
                  <div className="rounded-2xl border border-red-400/25 bg-red-500/12 p-4 text-sm text-red-50">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-black">{error.title}</p>
                        <p className="mt-1 leading-6 text-red-50/90">
                          {error.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pink-200" />
                  <p className="text-xs leading-5 text-white/55">
                    Committee members only. Access must be approved by the
                    Burton Pride committee.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}