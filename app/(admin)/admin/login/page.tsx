"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  FaLock,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaArrowLeft,
} from "react-icons/fa";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  };

  // keep test button if you want it for now
  const goToDashboard = () => router.push("/admin/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-14">
      <div className="w-full max-w-4xl">
        <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-black/30 shadow-2xl backdrop-blur-md md:grid-cols-2">
          {/* LEFT PANEL */}
          <div className="hidden md:flex flex-col justify-between p-10 bg-black/20 border-r border-white/10">
            <div>
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/50 border border-white/10">
                  <FaLock />
                </span>
                <div>
                  <div className="text-lg font-extrabold text-white">
                    Burton Pride
                  </div>
                  <div className="text-xs text-white/60">Committee Admin</div>
                </div>
              </div>

              <h2 className="mt-10 text-3xl font-extrabold text-white">
                Admin portal access
              </h2>

              <p className="mt-3 text-sm text-white/70 leading-6 max-w-sm">
                Manage emails, publish events, and handle committee tasks securely.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white transition"
            >
              <FaArrowLeft />
              Back to site
            </Link>
          </div>

          {/* RIGHT PANEL */}
          <div className="p-8 bg-black/20">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Committee Admin Login
                </h1>
                <p className="mt-2 text-sm text-white/60">Sign in to continue</p>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/10 bg-black/40 p-3">
                <FaLock />
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              {/* Email */}
              <div>
                <label className="text-sm font-semibold text-white/80">
                  Email
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-black/40 border border-white/10 px-4 py-3">
                  <FaEnvelope className="text-white/60" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@burtonpride.co.uk"
                    autoComplete="email"
                    className="w-full bg-transparent outline-none placeholder:text-white/40 text-white"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-semibold text-white/80">
                  Password
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl bg-black/40 border border-white/10 px-4 py-3">
                  <FaLock className="text-white/60" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-transparent outline-none placeholder:text-white/40 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="p-1 hover:text-white"
                  >
                    {showPass ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-white">
                  {error}
                </div>
              )}

              {/* Sign in */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl py-3.5 font-extrabold tracking-wide bg-gradient-to-r from-purple-500 to-cyan-400 text-white hover:opacity-90 transition-all disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>

              {/* OPTIONAL TEST BUTTON (remove when ready) */}
              <button
                type="button"
                onClick={goToDashboard}
                className="w-full rounded-2xl py-3.5 font-bold bg-white/10 border border-white/20 hover:bg-white/20 transition"
              >
                Enter dashboard (test)
              </button>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/"
                  className="md:hidden inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white transition"
                >
                  <FaArrowLeft />
                  Back to site
                </Link>

                <button
                  type="button"
                  onClick={() => alert("Reset later")}
                  className="text-sm font-semibold text-white/70 hover:text-white transition"
                >
                  Forgot password?
                </button>
              </div>

              <div className="pt-4 text-xs text-white/50">
                Login is now connected to Supabase Auth.
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-white/50">
          Burton Pride C.I.C — Committee Admin Portal
        </div>
      </div>
    </div>
  );
}
