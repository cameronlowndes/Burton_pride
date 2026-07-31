import type { ReactNode } from "react";

type StatCardTone =
  | "white"
  | "purple"
  | "emerald"
  | "sky"
  | "cyan"
  | "amber"
  | "red"
  | "orange"
  | "pink";

type StatCardProps = {
  label: string;
  value: number;
  tone: StatCardTone;
};

type InfoCardProps = {
  label: string;
  title: string;
  subtitle?: string | null;
  extra?: string | null;
  icon: ReactNode;
};

type RawDataCardProps = {
  title: string;
  data: unknown;
  className?: string;
};

const STAT_CARD_CLASSES: Record<StatCardTone, string> = {
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

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    const result = JSON.stringify(
      value,
      (_key, currentValue) => {
        if (
          typeof currentValue === "object" &&
          currentValue !== null
        ) {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }

          seen.add(currentValue);
        }

        if (typeof currentValue === "bigint") {
          return currentValue.toString();
        }

        if (currentValue instanceof Error) {
          return {
            name: currentValue.name,
            message: currentValue.message,
            stack: currentValue.stack,
          };
        }

        return currentValue;
      },
      2,
    );

    return result ?? "No data";
  } catch {
    try {
      return String(value);
    } catch {
      return "Unable to display raw data.";
    }
  }
}

export function StatCard({
  label,
  value,
  tone,
}: StatCardProps) {
  const safeValue = safeNumber(value);
  const safeLabel = cleanText(label) || "Statistic";

  return (
    <article
      className={`rounded-3xl p-5 ring-1 ${STAT_CARD_CLASSES[tone]}`}
      aria-label={`${safeLabel}: ${safeValue}`}
    >
      <p className="break-words text-sm opacity-75">{safeLabel}</p>
      <p className="mt-1 break-words text-3xl font-black">{safeValue}</p>
    </article>
  );
}

export function InfoCard({
  label,
  title,
  subtitle,
  extra,
  icon,
}: InfoCardProps) {
  const safeLabel = cleanText(label) || "Information";
  const safeTitle = cleanText(title) || "—";
  const safeSubtitle = cleanText(subtitle);
  const safeExtra = cleanText(extra);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-white/40">
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>

        <p className="break-words text-xs font-bold uppercase tracking-wide">
          {safeLabel}
        </p>
      </div>

      <p className="break-words text-lg font-bold">{safeTitle}</p>

      {safeSubtitle ? (
        <p className="mt-1 break-words text-sm text-white/50">
          {safeSubtitle}
        </p>
      ) : null}

      {safeExtra ? (
        <p className="mt-3 break-all text-xs text-white/35">
          {safeExtra}
        </p>
      ) : null}
    </article>
  );
}

export function RawDataCard({
  title,
  data,
  className = "",
}: RawDataCardProps) {
  const safeTitle = cleanText(title) || "Raw data";
  const serialisedData = safeJsonStringify(data);

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${className}`}
      aria-label={safeTitle}
    >
      <h3 className="mb-3 break-words font-bold">{safeTitle}</h3>

      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/40 p-4 text-xs leading-5 text-white/70">
        {serialisedData}
      </pre>
    </section>
  );
}
