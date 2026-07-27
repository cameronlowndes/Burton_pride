"use client";

import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import type { AuditSummary } from "./client-types";

type Card = {
  key: keyof AuditSummary;
  label: string;
  icon: typeof Activity;
  classes: string;
  filter: Record<string, string>;
};

const CARDS: Card[] = [
  {
    key: "total",
    label: "Total actions",
    icon: Activity,
    classes:
      "text-violet-100 border-violet-300/20 bg-violet-500/10",
    filter: {
      status: "",
      risk: "",
      area: "",
      security_only: "",
      review_only: "",
    },
  },
  {
    key: "successful",
    label: "Successful",
    icon: CheckCircle2,
    classes:
      "text-emerald-100 border-emerald-300/20 bg-emerald-500/10",
    filter: {
      status: "success",
    },
  },
  {
    key: "failed",
    label: "Failed",
    icon: XCircle,
    classes:
      "text-red-100 border-red-300/20 bg-red-500/10",
    filter: {
      status: "failed",
    },
  },
  {
    key: "warnings",
    label: "Warnings",
    icon: TriangleAlert,
    classes:
      "text-amber-100 border-amber-300/20 bg-amber-500/10",
    filter: {
      status: "warning",
    },
  },
  {
    key: "highRisk",
    label: "High risk",
    icon: AlertTriangle,
    classes:
      "text-orange-100 border-orange-300/20 bg-orange-500/10",
    filter: {
      risk: "high",
    },
  },
  {
    key: "criticalRisk",
    label: "Critical risk",
    icon: ShieldAlert,
    classes:
      "text-rose-100 border-rose-300/20 bg-rose-500/10",
    filter: {
      risk: "critical",
    },
  },
  {
    key: "securityEvents",
    label: "Security events",
    icon: ShieldCheck,
    classes:
      "text-cyan-100 border-cyan-300/20 bg-cyan-500/10",
    filter: {
      security_only: "true",
    },
  },
  {
    key: "openAlerts",
    label: "Open alerts",
    icon: BellRing,
    classes:
      "text-fuchsia-100 border-fuchsia-300/20 bg-fuchsia-500/10",
    filter: {
      review_only: "true",
    },
  },
];

export default function EventAuditSummaryCards({
  summary,
  loading,
  onApply,
}: {
  summary: AuditSummary | null;
  loading: boolean;
  onApply: (filter: Record<string, string>) => void;
}) {
  return (
    <section
      aria-label="Audit summary"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8"
    >
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = summary?.[card.key];
        const unavailable =
          summary !== null &&
          (value === null || value === undefined);

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onApply(card.filter)}
            disabled={loading || unavailable}
            className={`group min-h-28 rounded-3xl border p-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:bg-white/[0.08] disabled:cursor-default disabled:opacity-70 disabled:hover:translate-y-0 ${card.classes}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-black tracking-tight">
                  {loading ? (
                    <span className="inline-block h-8 w-14 animate-pulse rounded-lg bg-white/10" />
                  ) : unavailable ? (
                    "—"
                  ) : (
                    Number(value ?? 0).toLocaleString("en-GB")
                  )}
                </p>

                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.13em] opacity-75">
                  {card.label}
                </p>
              </div>

              <span className="rounded-2xl bg-black/15 p-2.5 ring-1 ring-white/10 transition group-hover:scale-105">
                <Icon
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </span>
            </div>
          </button>
        );
      })}
    </section>
  );
}
