import { AlertOctagon, AlertTriangle, CheckCircle2, CircleDot, ShieldAlert, XCircle } from "lucide-react";

function tidy(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function EventAuditStatusBadge({ status }: { status: string }) {
  const config: Record<string, { classes: string; icon: typeof CheckCircle2 }> = {
    success: { classes: "bg-emerald-500/15 text-emerald-100 ring-emerald-300/25", icon: CheckCircle2 },
    failed: { classes: "bg-red-500/15 text-red-100 ring-red-300/25", icon: XCircle },
    blocked: { classes: "bg-orange-500/15 text-orange-100 ring-orange-300/25", icon: ShieldAlert },
    warning: { classes: "bg-amber-500/15 text-amber-100 ring-amber-300/25", icon: AlertTriangle },
    partial_success: { classes: "bg-yellow-500/15 text-yellow-100 ring-yellow-300/25", icon: AlertTriangle },
    pending: { classes: "bg-sky-500/15 text-sky-100 ring-sky-300/25", icon: CircleDot },
    cancelled: { classes: "bg-white/10 text-white/65 ring-white/15", icon: XCircle },
  };
  const item = config[status] || config.pending;
  const Icon = item.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${item.classes}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {tidy(status)}
    </span>
  );
}

export function EventAuditRiskBadge({ risk }: { risk: string }) {
  const classes: Record<string, string> = {
    low: "bg-slate-500/15 text-slate-100 ring-slate-300/20",
    medium: "bg-blue-500/15 text-blue-100 ring-blue-300/25",
    high: "bg-orange-500/15 text-orange-100 ring-orange-300/25",
    critical: "bg-red-600/25 text-red-50 ring-red-300/40",
  };
  const Icon = risk === "critical" ? AlertOctagon : risk === "high" ? AlertTriangle : ShieldAlert;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${classes[risk] || classes.low}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {tidy(risk)}
    </span>
  );
}
