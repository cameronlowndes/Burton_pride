import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone:
    | "white"
    | "purple"
    | "emerald"
    | "sky"
    | "cyan"
    | "amber"
    | "red"
    | "orange"
    | "pink";
}) {
  const classes = {
    white: "bg-white/[0.04] ring-white/10 text-white",
    purple: "bg-purple-500/10 ring-purple-300/10 text-purple-100",
    emerald: "bg-emerald-500/10 ring-emerald-300/10 text-emerald-100",
    sky: "bg-sky-500/10 ring-sky-300/10 text-sky-100",
    cyan: "bg-cyan-500/10 ring-cyan-300/10 text-cyan-100",
    amber: "bg-amber-500/10 ring-amber-300/10 text-amber-100",
    red: "bg-red-500/10 ring-red-300/10 text-red-100",
    orange: "bg-orange-500/10 ring-orange-300/10 text-orange-100",
    pink: "bg-pink-500/10 ring-pink-300/10 text-pink-100",
  };

  return (
    <div className={`rounded-3xl p-5 ring-1 ${classes[tone]}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

export function InfoCard({
  label,
  title,
  subtitle,
  extra,
  icon,
}: {
  label: string;
  title: string;
  subtitle?: string;
  extra?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-white/40">
        {icon}
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      </div>

      <p className="break-words text-lg font-bold">{title || "—"}</p>

      {subtitle && (
        <p className="mt-1 break-words text-sm text-white/50">{subtitle}</p>
      )}

      {extra && <p className="mt-3 break-all text-xs text-white/35">{extra}</p>}
    </div>
  );
}

export function RawDataCard({
  title,
  data,
  className = "",
}: {
  title: string;
  data: any;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${className}`}
    >
      <h3 className="mb-3 font-bold">{title}</h3>

      <pre className="max-h-96 overflow-auto rounded-xl bg-black/40 p-4 text-xs text-white/70">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
