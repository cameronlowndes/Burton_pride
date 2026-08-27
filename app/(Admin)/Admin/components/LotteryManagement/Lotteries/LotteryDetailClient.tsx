"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Gift,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";

import type {
  LotteryDetail,
  LotteryDetailResponse,
  LotteryStatus,
} from "@/lib/lottery/lottery-detail-types";

type Props = {
  slug: string;
};

type LotteryLookupResponse = {
  ok: boolean;
  item?: LotteryDetail;
  items?: LotteryDetail[];
  error?: string;
  message?: string;
};

const LOTTERY_API = "/api/admin/lotterymanagement/lottery";

async function readApiJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function resolveLotteryIdFromSlug(slug: string): Promise<string> {
  const lookupResponse = await fetch(
    `${LOTTERY_API}?slug=${encodeURIComponent(slug)}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const lookupData =
    await readApiJson<LotteryLookupResponse>(lookupResponse);

  if (!lookupResponse.ok || !lookupData?.ok) {
    throw new Error(
      lookupData?.error ||
        lookupData?.message ||
        `Unable to resolve lottery slug "${slug}".`,
    );
  }

  /*
   * Supports either API response shape:
   *   { ok: true, item: ... }
   * or
   *   { ok: true, items: [...] }
   *
   * If the existing collection API ignores ?slug=, we still
   * safely find the matching record by its unique slug.
   */
  const matchedLottery =
    lookupData.item?.slug === slug
      ? lookupData.item
      : lookupData.items?.find(
          (item) => item.slug === slug,
        );

  if (!matchedLottery?.id) {
    throw new Error(
      `Lottery "${slug}" was not found.`,
    );
  }

  return matchedLottery.id;
}

function statusLabel(
  status: LotteryStatus,
) {
  const labels: Record<
    LotteryStatus,
    string
  > = {
    draft: "Draft",
    compliance_review:
      "Compliance Review",
    scheduled: "Scheduled",
    live: "Live",
    sales_closed:
      "Sales Closed",
    draw_ready: "Draw Ready",
    completed: "Completed",
    archived: "Archived",
    paused: "Paused",
    cancelled: "Cancelled",
    under_review:
      "Under Review",
  };

  return labels[status] ?? status;
}

function statusClass(
  status: LotteryStatus,
) {
  const map: Record<
    LotteryStatus,
    string
  > = {
    draft:
      "border-white/15 bg-white/10 text-white/75",
    compliance_review:
      "border-amber-400/30 bg-amber-500/10 text-amber-200",
    scheduled:
      "border-blue-400/30 bg-blue-500/10 text-blue-200",
    live:
      "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    sales_closed:
      "border-orange-400/30 bg-orange-500/10 text-orange-200",
    draw_ready:
      "border-purple-400/30 bg-purple-500/10 text-purple-200",
    completed:
      "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    archived:
      "border-white/10 bg-black/20 text-white/50",
    paused:
      "border-yellow-400/30 bg-yellow-500/10 text-yellow-100",
    cancelled:
      "border-red-400/30 bg-red-500/10 text-red-200",
    under_review:
      "border-rose-400/30 bg-rose-500/10 text-rose-200",
  };

  return map[status];
}

function formatDate(
  value?: string | null,
) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone:
        "Europe/London",
    },
  ).format(date);
}

function formatMoney(
  value?: number | null,
  currency = "GBP",
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency,
    },
  ).format(
    Number.isFinite(
      Number(value),
    )
      ? Number(value)
      : 0,
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{
    className?: string;
  }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">
            {label}
          </p>

          <p className="mt-2 text-xl font-black text-white">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value:
    | React.ReactNode
    | string
    | number
    | null;
}) {
  return (
    <div className="grid gap-1 border-b border-white/10 py-3 last:border-b-0 sm:grid-cols-[220px_1fr] sm:gap-5">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">
        {label}
      </div>
      <div className="break-words text-sm text-white/75">
        {value || "Not set"}
      </div>
    </div>
  );
}

export default function LotteryDetailClient({
  slug,
}: Props) {
  const [lottery, setLottery] =
    useState<LotteryDetail | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadLottery =
    useCallback(
      async (
        refresh = false,
      ) => {
        refresh
          ? setRefreshing(true)
          : setLoading(true);

        setError(null);

        try {
          /*
           * The browser route is slug-based:
           *
           * /Admin/LotteryManagement/Lotteries/[slug]
           *
           * The API remains UUID-based:
           *
           * /api/admin/lotterymanagement/lottery/[id]
           *
           * First resolve the unique slug to the lottery UUID,
           * then load the full record through the normal [id] API.
           */
          const lotteryId =
            await resolveLotteryIdFromSlug(
              slug,
            );

          const response =
            await fetch(
              `${LOTTERY_API}/${encodeURIComponent(
                lotteryId,
              )}`,
              {
                method: "GET",
                credentials:
                  "include",
                cache: "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const data =
            await readApiJson<LotteryDetailResponse>(
              response,
            );

          if (
            !response.ok ||
            !data?.ok ||
            !data.item
          ) {
            throw new Error(
              data?.error ||
                data?.message ||
                "Unable to load lottery.",
            );
          }

          setLottery(data.item);
        } catch (caught) {
          setLottery(null);
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load lottery.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [slug],
    );

  useEffect(() => {
    void loadLottery(false);
  }, [loadLottery]);

  if (loading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-bold">
            Loading lottery…
          </span>
        </div>
      </div>
    );
  }

  if (
    error ||
    !lottery
  ) {
    return (
      <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-500/10 p-3 text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <h1 className="text-xl font-black text-white">
                  Lottery could not
                  be loaded
                </h1>

                <p className="mt-2 text-sm leading-6 text-white/50">
                  {error ??
                    "Lottery not found."}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/Admin/LotteryManagement/Lotteries"
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to lotteries
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      void loadLottery(
                        false,
                      )
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-black"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const publicUrl =
    `/lottery/${lottery.slug}`;

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-xl backdrop-blur-xl sm:p-6 lg:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link
              href="/Admin/LotteryManagement/Lotteries"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-purple-300 hover:text-purple-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to lotteries
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
                {lottery.title}
              </h1>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                  lottery.status,
                )}`}
              >
                {statusLabel(
                  lottery.status,
                )}
              </span>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55 sm:text-base">
              {lottery.short_summary ||
                "Manage this lottery campaign, its lifecycle, sales, draw, compliance and public page."}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/40">
              <span>
                Slug:{" "}
                <strong className="text-white/60">
                  {lottery.slug}
                </strong>
              </span>
              <span>
                Reference:{" "}
                <strong className="text-white/60">
                  {lottery.internal_reference ||
                    "Not set"}
                </strong>
              </span>
              <span>
                ID:{" "}
                <strong className="text-white/60">
                  {lottery.id}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                void loadLottery(
                  true,
                )
              }
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>

            <Link
              href={`/Admin/LotteryManagement/Lotteries/${lottery.slug}/Edit`}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <Pencil className="h-4 w-4" />
              Edit lottery
            </Link>

            <Link
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-purple-500 px-4 text-sm font-black text-white transition hover:bg-purple-400"
            >
              <ExternalLink className="h-4 w-4" />
              Open public page
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <StatCard
          label="Ticket price"
          value={formatMoney(
            lottery.ticket_price,
            lottery.currency,
          )}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Orders"
          value={
            lottery.order_count ?? 0
          }
          icon={Users}
        />
        <StatCard
          label="Paid orders"
          value={
            lottery.paid_order_count ??
            0
          }
          icon={CheckCircle2}
        />
        <StatCard
          label="Tickets issued"
          value={
            lottery.ticket_count ?? 0
          }
          icon={WalletCards}
        />
        <StatCard
          label="Revenue"
          value={formatMoney(
            lottery.revenue ?? 0,
            lottery.currency,
          )}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Prizes"
          value={
            lottery.prize_count ?? 0
          }
          icon={Gift}
        />
        <StatCard
          label="Winners"
          value={
            lottery.winner_count ?? 0
          }
          icon={Trophy}
        />
        <StatCard
          label="Refunds"
          value={formatMoney(
            lottery.refund_total ??
              0,
            lottery.currency,
          )}
          icon={Archive}
        />
      </div>

      {lottery.status ===
        "live" && (
        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.07] p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <h2 className="font-black text-emerald-100">
                This lottery is live
              </h2>
              <p className="mt-1 text-sm leading-6 text-emerald-100/70">
                The admin detail page
                remains fully available
                while the lottery is
                live. Editing and
                high-risk actions should
                still respect lifecycle
                restrictions and
                permissions.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="mb-5">
            <h2 className="text-xl font-black text-white">
              Lottery information
            </h2>
            <p className="mt-1 text-sm text-white/45">
              Core campaign details and
              schedule.
            </p>
          </div>

          <InfoRow
            label="Lottery type"
            value={lottery.lottery_type.replaceAll(
              "_",
              " ",
            )}
          />
          <InfoRow
            label="Status"
            value={statusLabel(
              lottery.status,
            )}
          />
          <InfoRow
            label="Publication"
            value={formatDate(
              lottery.publication_at,
            )}
          />
          <InfoRow
            label="Sales open"
            value={formatDate(
              lottery.sales_open_at,
            )}
          />
          <InfoRow
            label="Sales close"
            value={formatDate(
              lottery.sales_close_at,
            )}
          />
          <InfoRow
            label="Draw"
            value={formatDate(
              lottery.draw_at,
            )}
          />
          <InfoRow
            label="Results publication"
            value={formatDate(
              lottery.results_publish_at,
            )}
          />
          <InfoRow
            label="Timezone"
            value={
              lottery.timezone ||
              "Europe/London"
            }
          />
          <InfoRow
            label="Maximum tickets"
            value={
              lottery.max_tickets ??
              "No cap set"
            }
          />
          <InfoRow
            label="Minimum age"
            value={
              lottery.minimum_age ??
              "Not set"
            }
          />
        </Card>

        <Card>
          <div className="mb-5">
            <h2 className="text-xl font-black text-white">
              Quick actions
            </h2>
            <p className="mt-1 text-sm text-white/45">
              Open the related Lottery
              Management records for this
              campaign.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              {
                label:
                  "Orders & Entries",
                href: `/Admin/LotteryManagement/Orders?lottery=${lottery.id}`,
                icon: Users,
              },
              {
                label: "Tickets",
                href: `/Admin/LotteryManagement/Tickets?lottery=${lottery.id}`,
                icon: Ticket,
              },
              {
                label: "Prizes",
                href: `/Admin/LotteryManagement/Prizes?lottery=${lottery.id}`,
                icon: Gift,
              },
              {
                label: "Draws",
                href: `/Admin/LotteryManagement/Draws?lottery=${lottery.id}`,
                icon: Trophy,
              },
              {
                label: "Winners",
                href: `/Admin/LotteryManagement/Winners?lottery=${lottery.id}`,
                icon: Trophy,
              },
              {
                label:
                  "Compliance",
                href: `/Admin/LotteryManagement/Compliance?lottery=${lottery.id}`,
                icon: ShieldCheck,
              },
              {
                label:
                  "Reports & Exports",
                href: `/Admin/LotteryManagement/Reports?lottery=${lottery.id}`,
                icon: FileText,
              },
              {
                label:
                  "Audit Logs",
                href: `/Admin/LotteryManagement/AuditLogs?lottery=${lottery.id}`,
                icon: History,
              },
            ].map(
              ({
                label,
                href,
                icon: Icon,
              }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-purple-500/25 hover:bg-purple-500/[0.07]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-purple-300">
                      <Icon className="h-4.5 w-4.5" />
                    </div>

                    <span className="text-sm font-black text-white/75 group-hover:text-white">
                      {label}
                    </span>
                  </div>

                  <ExternalLink className="h-4 w-4 text-white/20 group-hover:text-purple-300" />
                </Link>
              ),
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-purple-300" />
            <div>
              <h2 className="text-xl font-black text-white">
                Description &
                fundraising purpose
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Campaign information
                shown during management
                and public-page setup.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">
                Full description
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                {lottery.description ||
                  "No full description has been added."}
              </p>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">
                Fundraising purpose
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                {lottery.fundraising_purpose ||
                  "No fundraising purpose has been added."}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-purple-300" />
            <div>
              <h2 className="text-xl font-black text-white">
                Compliance
              </h2>
              <p className="mt-1 text-sm text-white/45">
                Legal and operational
                information attached to
                this lottery.
              </p>
            </div>
          </div>

          <InfoRow
            label="Promoting society"
            value={
              lottery.promoting_society_legal_name
            }
          />
          <InfoRow
            label="Registration / licence type"
            value={
              lottery.registration_licence_type
            }
          />
          <InfoRow
            label="Registration / licence number"
            value={
              lottery.registration_licence_number
            }
          />
          <InfoRow
            label="Licensing authority"
            value={
              lottery.licensing_authority
            }
          />
          <InfoRow
            label="Responsible promoter"
            value={
              lottery.responsible_promoter_name
            }
          />
          <InfoRow
            label="Geographic eligibility"
            value={
              lottery.geographic_eligibility
            }
          />
          <InfoRow
            label="Terms version"
            value={
              lottery.terms_version
            }
          />
          <InfoRow
            label="Privacy version"
            value={
              lottery.privacy_notice_version
            }
          />
        </Card>
      </div>

      <Card>
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">
            Public-page settings
          </h2>
          <p className="mt-1 text-sm text-white/45">
            These options affect how
            `/lottery/{lottery.slug}`
            may be displayed publicly.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Public directory",
              lottery.show_in_directory,
            ],
            [
              "Page before sales",
              lottery.allow_page_before_sales,
            ],
            [
              "Show ticket count",
              lottery.show_ticket_count,
            ],
            [
              "Show amount raised",
              lottery.show_amount_raised,
            ],
            [
              "Show remaining tickets",
              lottery.show_remaining_tickets,
            ],
            [
              "Show prize values",
              lottery.show_prize_values,
            ],
            [
              "Countdown",
              lottery.countdown_enabled,
            ],
          ].map(
            ([label, enabled]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">
                  {label}
                </p>
                <p
                  className={`mt-2 text-sm font-black ${
                    enabled
                      ? "text-emerald-300"
                      : "text-white/45"
                  }`}
                >
                  {enabled
                    ? "Enabled"
                    : "Disabled"}
                </p>
              </div>
            ),
          )}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/35">
              Winner display
            </p>
            <p className="mt-2 text-sm font-black capitalize text-white/75">
              {(
                lottery.winner_display_mode ||
                "not set"
              ).replaceAll(
                "_",
                " ",
              )}
            </p>
          </div>
        </div>
      </Card>

      <div className="text-xs text-white/30">
        Created{" "}
        {formatDate(
          lottery.created_at,
        )}{" "}
        • Last updated{" "}
        {formatDate(
          lottery.updated_at,
        )}
      </div>
    </div>
  );
}
