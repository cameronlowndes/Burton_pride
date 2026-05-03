"use client";

export default function MoneyManagementHomePage() {
  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Burton Pride
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Welcome to Burton Pride Money Management App
          </h1>
        </div>
      </div>
    </main>
  );
}