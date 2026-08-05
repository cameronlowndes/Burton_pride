"use client";

import {
  AlertTriangle,
  BadgePoundSterling,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  HeartHandshake,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ApplicationType =
  | "stallholder"
  | "food_vendor"
  | "charity"
  | "cic";

type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "withdrawn";

type PaymentStatus =
  | "not_required"
  | "awaiting_payment"
  | "paid"
  | "refunded";

type EventVendorApplication = {
  id: string;
  application_reference: string;
  event_id: string;

  application_type: ApplicationType;
  pitch_type: "standard" | "double" | null;

  organisation_name: string;
  trading_name: string | null;

  contact_name: string;
  contact_email: string;
  contact_phone: string;

  address_line1: string;
  address_line2: string | null;
  town_city: string;
  county: string | null;
  postcode: string;

  website: string | null;
  social_media: string | null;

  description: string;
  products_services: string;

  gazebo_width_metres: number | null;
  gazebo_depth_metres: number | null;

  electricity_required: boolean;
  electricity_details: string | null;

  public_liability_insurance: boolean;
  public_liability_expiry_date: string | null;
  public_liability_document_url: string | null;

  food_hygiene_rating: string | null;
  food_registration_authority: string | null;
  food_hygiene_document_url: string | null;

  uses_gas: boolean;
  gas_safety_document_url: string | null;

  uses_generator: boolean;
  generator_details: string | null;

  charity_number: string | null;
  company_number: string | null;
  charity_or_cic_proof_url: string | null;

  accessibility_requirements: string | null;
  additional_information: string | null;

  terms_accepted: boolean;
  data_processing_accepted: boolean;

  fee_pence: number;
  payment_status: PaymentStatus;
  application_status: ApplicationStatus;

  admin_notes: string | null;
  rejection_reason: string | null;

  submitted_at: string;
  updated_at: string;
};

type ApiResponse = {
  ok?: boolean;
  applications?: EventVendorApplication[];
  application?: EventVendorApplication;
  error?: string;
};

const API =
  "/api/admin/burton-pride-event-hub/stalls-vendors";

const statusOptions: Array<{
  value: ApplicationStatus | "";
  label: string;
}> = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  {
    value: "under_review",
    label: "Under review",
  },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

const typeOptions: Array<{
  value: ApplicationType | "";
  label: string;
}> = [
  { value: "", label: "All application types" },
  { value: "stallholder", label: "Stallholder" },
  { value: "food_vendor", label: "Food vendor" },
  { value: "charity", label: "Charity" },
  { value: "cic", label: "C.I.C." },
];

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((pence || 0) / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function applicationTypeLabel(
  value: ApplicationType,
) {
  if (value === "food_vendor") {
    return "Food vendor";
  }

  if (value === "charity") {
    return "Registered charity";
  }

  if (value === "cic") {
    return "Community Interest Company";
  }

  return "Stallholder";
}

function statusLabel(
  value: ApplicationStatus,
) {
  return (
    statusOptions.find(
      (option) => option.value === value,
    )?.label || value
  );
}

function statusClass(
  value: ApplicationStatus,
) {
  if (value === "approved") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  }

  if (value === "rejected") {
    return "border-red-400/25 bg-red-500/10 text-red-200";
  }

  if (value === "under_review") {
    return "border-blue-400/25 bg-blue-500/10 text-blue-200";
  }

  if (value === "withdrawn") {
    return "border-slate-400/25 bg-slate-500/10 text-slate-300";
  }

  return "border-amber-400/25 bg-amber-500/10 text-amber-200";
}

function typeIcon(type: ApplicationType) {
  if (type === "food_vendor") {
    return <Utensils className="h-5 w-5" />;
  }

  if (
    type === "charity" ||
    type === "cic"
  ) {
    return (
      <HeartHandshake className="h-5 w-5" />
    );
  }

  return <Store className="h-5 w-5" />;
}

async function readJson(
  response: Response,
): Promise<ApiResponse> {
  const text = await response.text();

  try {
    return text
      ? (JSON.parse(text) as ApiResponse)
      : {};
  } catch {
    return {
      ok: false,
      error:
        "The server returned an invalid response.",
    };
  }
}

export default function EventHubVendorApplicationsPage() {
  const [applications, setApplications] =
    useState<EventVendorApplication[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<ApplicationStatus | "">("");

  const [typeFilter, setTypeFilter] =
    useState<ApplicationType | "">("");

  const [selected, setSelected] =
    useState<EventVendorApplication | null>(
      null,
    );

  const [adminNotes, setAdminNotes] =
    useState("");

  const [rejectionReason, setRejectionReason] =
    useState("");

  const [rejectionError, setRejectionError] =
    useState("");

  const [rejectConfirmOpen, setRejectConfirmOpen] =
    useState(false);

  const loadApplications =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(API, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload =
          await readJson(response);

        if (
          !response.ok ||
          payload.ok === false
        ) {
          throw new Error(
            payload.error ||
              "Applications could not be loaded.",
          );
        }

        setApplications(
          Array.isArray(payload.applications)
            ? payload.applications
            : [],
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Applications could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    setAdminNotes(
      selected.admin_notes || "",
    );

    setRejectionReason(
      selected.rejection_reason || "",
    );

    setRejectionError("");
    setRejectConfirmOpen(false);
  }, [selected]);

  const filteredApplications =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return applications.filter(
        (application) => {
          const matchesSearch =
            !query ||
            application.organisation_name
              .toLowerCase()
              .includes(query) ||
            application.contact_name
              .toLowerCase()
              .includes(query) ||
            application.contact_email
              .toLowerCase()
              .includes(query) ||
            application.application_reference
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            !statusFilter ||
            application.application_status ===
              statusFilter;

          const matchesType =
            !typeFilter ||
            application.application_type ===
              typeFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType
          );
        },
      );
    }, [
      applications,
      search,
      statusFilter,
      typeFilter,
    ]);

  const stats = useMemo(() => {
    const total = applications.length;

    const countStatus = (
      status: ApplicationStatus,
    ) =>
      applications.filter(
        (application) =>
          application.application_status ===
          status,
      ).length;

    const awaitingPayment =
      applications.filter(
        (application) =>
          application.payment_status ===
          "awaiting_payment",
      ).length;

    const totalFeesPence =
      applications.reduce(
        (totalValue, application) =>
          totalValue +
          (application.fee_pence || 0),
        0,
      );

    return {
      total,
      pending: countStatus("pending"),
      underReview:
        countStatus("under_review"),
      approved: countStatus("approved"),
      rejected: countStatus("rejected"),
      awaitingPayment,
      totalFeesPence,
    };
  }, [applications]);

  async function updateApplication(
    changes: Partial<
      Pick<
        EventVendorApplication,
        | "application_status"
        | "payment_status"
        | "admin_notes"
        | "rejection_reason"
      >
    >,
  ) {
    if (!selected) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(API, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          id: selected.id,
          ...changes,
        }),
      });

      const payload =
        await readJson(response);

      if (
        !response.ok ||
        payload.ok === false ||
        !payload.application
      ) {
        throw new Error(
          payload.error ||
            "The application could not be updated.",
        );
      }

      setApplications((current) =>
        current.map((application) =>
          application.id === selected.id
            ? payload.application!
            : application,
        ),
      );

      setSelected(payload.application);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "The application could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  function requestRejection() {
    const reason =
      rejectionReason.trim();

    if (!reason) {
      setRejectionError(
        "Enter a rejection reason before rejecting this application.",
      );

      window.setTimeout(() => {
        document
          .getElementById(
            "vendor-rejection-reason",
          )
          ?.focus();
      }, 50);

      return;
    }

    setRejectionError("");
    setRejectConfirmOpen(true);
  }

  async function confirmRejection() {
    if (!selected) {
      return;
    }

    const reason =
      rejectionReason.trim();

    if (!reason) {
      setRejectConfirmOpen(false);
      setRejectionError(
        "Enter a rejection reason before rejecting this application.",
      );
      return;
    }

    await updateApplication({
      application_status:
        "rejected",
      admin_notes:
        adminNotes.trim(),
      rejection_reason:
        reason,
    });

    setRejectConfirmOpen(false);
  }

  function exportApplications() {
    const headers = [
      "reference",
      "organisation",
      "application_type",
      "pitch_type",
      "contact_name",
      "contact_email",
      "contact_phone",
      "fee",
      "payment_status",
      "application_status",
      "submitted_at",
    ];

    const rows =
      filteredApplications.map(
        (application) => [
          application.application_reference,
          application.organisation_name,
          application.application_type,
          application.pitch_type || "",
          application.contact_name,
          application.contact_email,
          application.contact_phone,
          (
            application.fee_pence / 100
          ).toFixed(2),
          application.payment_status,
          application.application_status,
          application.submitted_at,
        ],
      );

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replaceAll(
              '"',
              '""',
            )}"`,
          )
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "burton-pride-vendor-applications.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.16),_transparent_30%),linear-gradient(180deg,#100719_0%,#1e1031_45%,#0f172a_100%)] px-3 py-6 text-white sm:px-4 lg:px-5">
      <div className="w-full max-w-none">
        <header className="w-full rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-pink-100">
                <Store className="h-4 w-4" />
                Event Hub applications
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Stalls & Vendors
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
                Review applications submitted
                through the public Burton Pride
                stalls and vendors form. Approve,
                reject and manage payment and
                document checks from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportApplications}
                disabled={
                  filteredApplications.length ===
                  0
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadApplications()
                }
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black transition hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <StatCard
            label="Total"
            value={stats.total}
            icon={
              <FileText className="h-5 w-5" />
            }
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={
              <AlertTriangle className="h-5 w-5" />
            }
          />
          <StatCard
            label="Under review"
            value={stats.underReview}
            icon={
              <Eye className="h-5 w-5" />
            }
          />
          <StatCard
            label="Approved"
            value={stats.approved}
            icon={
              <CheckCircle2 className="h-5 w-5" />
            }
          />
          <StatCard
            label="Rejected"
            value={stats.rejected}
            icon={
              <XCircle className="h-5 w-5" />
            }
          />
          <StatCard
            label="Awaiting payment"
            value={stats.awaitingPayment}
            icon={
              <CircleDollarSign className="h-5 w-5" />
            }
          />
          <StatCard
            label="Application fees"
            value={formatMoney(
              stats.totalFeesPence,
            )}
            icon={
              <BadgePoundSterling className="h-5 w-5" />
            }
          />
        </section>

        <section className="mt-6 w-full rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl backdrop-blur-xl sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search organisation, contact, email or reference"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm font-semibold outline-none transition placeholder:text-white/35 focus:border-pink-300/40 focus:ring-4 focus:ring-pink-500/10"
              />
            </label>

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value as
                      | ApplicationStatus
                      | "",
                  )
                }
                className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm font-semibold outline-none focus:border-purple-300/40"
              >
                {statusOptions.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-slate-950"
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as
                    | ApplicationType
                    | "",
                )
              }
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-semibold outline-none focus:border-purple-300/40"
            >
              {typeOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-slate-950"
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </div>
        </section>

        <section className="mt-6">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.06]">
              <Loader2 className="h-7 w-7 animate-spin text-purple-200" />
            </div>
          ) : filteredApplications.length ===
            0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.04] p-12 text-center">
              <Store className="mx-auto h-10 w-10 text-white/35" />
              <h2 className="mt-4 text-xl font-black">
                No applications found
              </h2>
              <p className="mt-2 text-sm text-white/55">
                New applications submitted
                from the public page will
                appear here.
              </p>
            </div>
          ) : (
            <div className="grid w-full gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredApplications.map(
                (application) => (
                  <ApplicationCard
                    key={application.id}
                    application={
                      application
                    }
                    onOpen={() =>
                      setSelected(
                        application,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-md sm:p-4">
          <div className="flex h-[calc(100dvh-1rem)] w-full max-w-none flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#080d1b] shadow-2xl sm:h-[calc(100dvh-2rem)]">
            <div className="border-b border-white/10 bg-[#080d1b]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                      selected.application_status,
                    )}`}
                  >
                    {statusLabel(
                      selected.application_status,
                    )}
                  </span>

                  <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                    {
                      selected.organisation_name
                    }
                  </h2>

                  <p className="mt-1 text-sm font-bold text-purple-200">
                    {
                      selected.application_reference
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelected(null)
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] transition hover:bg-white/[0.12]"
                  aria-label="Close application"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-7 sm:pt-7">
              <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-5">
                  <DetailSection
                    title="Application"
                    icon={typeIcon(
                      selected.application_type,
                    )}
                  >
                    <DetailGrid>
                      <DetailItem
                        label="Type"
                        value={applicationTypeLabel(
                          selected.application_type,
                        )}
                      />
                      <DetailItem
                        label="Pitch"
                        value={
                          selected.pitch_type ||
                          "Not applicable"
                        }
                      />
                      <DetailItem
                        label="Fee"
                        value={formatMoney(
                          selected.fee_pence,
                        )}
                      />
                      <DetailItem
                        label="Payment"
                        value={
                          selected.payment_status
                        }
                      />
                      <DetailItem
                        label="Submitted"
                        value={formatDate(
                          selected.submitted_at,
                        )}
                      />
                    </DetailGrid>
                  </DetailSection>

                  <DetailSection
                    title="Contact"
                    icon={
                      <Building2 className="h-5 w-5" />
                    }
                  >
                    <DetailGrid>
                      <DetailItem
                        label="Contact name"
                        value={
                          selected.contact_name
                        }
                      />
                      <DetailItem
                        label="Email"
                        value={
                          selected.contact_email
                        }
                      />
                      <DetailItem
                        label="Telephone"
                        value={
                          selected.contact_phone
                        }
                      />
                      <DetailItem
                        label="Trading name"
                        value={
                          selected.trading_name ||
                          "Not recorded"
                        }
                      />
                    </DetailGrid>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={`mailto:${selected.contact_email}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-500/15 px-4 py-2 text-sm font-black text-purple-100 hover:bg-purple-500/25"
                      >
                        <Mail className="h-4 w-4" />
                        Email applicant
                      </a>

                      <a
                        href={`tel:${selected.contact_phone}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/15 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-500/25"
                      >
                        <Phone className="h-4 w-4" />
                        Call applicant
                      </a>
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="What they are bringing"
                    icon={
                      <Store className="h-5 w-5" />
                    }
                  >
                    <p className="text-sm leading-7 text-white/75">
                      {selected.description}
                    </p>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-white/45">
                        Products or services
                      </p>
                      <p className="mt-2 text-sm leading-7 text-white/75">
                        {
                          selected.products_services
                        }
                      </p>
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="Documents and safety"
                    icon={
                      <ShieldCheck className="h-5 w-5" />
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DocumentLink
                        label="Public liability"
                        url={
                          selected.public_liability_document_url
                        }
                      />
                      <DocumentLink
                        label="Food hygiene"
                        url={
                          selected.food_hygiene_document_url
                        }
                      />
                      <DocumentLink
                        label="Gas safety"
                        url={
                          selected.gas_safety_document_url
                        }
                      />
                      <DocumentLink
                        label="Charity or C.I.C. proof"
                        url={
                          selected.charity_or_cic_proof_url
                        }
                      />
                    </div>
                  </DetailSection>
                </div>

                <aside className="space-y-5">
                  <DetailSection
                    title="Review application"
                    icon={
                      <FileCheck2 className="h-5 w-5" />
                    }
                  >
                    <label className="block text-sm font-bold text-white/75">
                      Admin notes
                      <textarea
                        value={adminNotes}
                        onChange={(event) =>
                          setAdminNotes(
                            event.target.value,
                          )
                        }
                        className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm outline-none focus:border-purple-300/40"
                      />
                    </label>

                    <label className="mt-4 block text-sm font-bold text-white/75">
                      Rejection reason
                      <textarea
                        id="vendor-rejection-reason"
                        value={rejectionReason}
                        aria-invalid={
                          rejectionError
                            ? true
                            : undefined
                        }
                        aria-describedby={
                          rejectionError
                            ? "vendor-rejection-error"
                            : undefined
                        }
                        onChange={(event) => {
                          setRejectionReason(
                            event.target.value,
                          );

                          if (
                            rejectionError &&
                            event.target.value.trim()
                          ) {
                            setRejectionError("");
                          }
                        }}
                        placeholder="Explain clearly why this application is being rejected."
                        className={`mt-2 min-h-24 w-full rounded-2xl border bg-black/20 p-4 text-sm outline-none transition ${
                          rejectionError
                            ? "border-red-400/70 focus:border-red-300 focus:ring-4 focus:ring-red-500/15"
                            : "border-white/10 focus:border-red-300/40"
                        }`}
                      />

                      {rejectionError ? (
                        <p
                          id="vendor-rejection-error"
                          role="alert"
                          className="mt-2 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          {rejectionError}
                        </p>
                      ) : null}
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        void updateApplication({
                          admin_notes:
                            adminNotes,
                          rejection_reason:
                            rejectionReason,
                        })
                      }
                      disabled={saving}
                      className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-500/15 px-4 py-2 text-sm font-black text-purple-100 hover:bg-purple-500/25 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileCheck2 className="h-4 w-4" />
                      )}
                      Save review notes
                    </button>
                  </DetailSection>

                  <DetailSection
                    title="Status actions"
                    icon={
                      <CalendarDays className="h-5 w-5" />
                    }
                  >
                    <div className="space-y-2">
                      <StatusButton
                        label="Move to under review"
                        disabled={saving}
                        onClick={() =>
                          void updateApplication({
                            application_status:
                              "under_review",
                            admin_notes:
                              adminNotes,
                          })
                        }
                      />

                      <StatusButton
                        label="Approve application"
                        good
                        disabled={saving}
                        onClick={() =>
                          void updateApplication({
                            application_status:
                              "approved",
                            admin_notes:
                              adminNotes,
                            rejection_reason:
                              null,
                          })
                        }
                      />

                      <StatusButton
                        label={
                          saving
                            ? "Updating application"
                            : "Reject application"
                        }
                        danger
                        disabled={saving}
                        onClick={
                          requestRejection
                        }
                      />
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="Payment"
                    icon={
                      <CircleDollarSign className="h-5 w-5" />
                    }
                  >
                    <select
                      value={
                        selected.payment_status
                      }
                      onChange={(event) =>
                        void updateApplication({
                          payment_status:
                            event.target
                              .value as PaymentStatus,
                        })
                      }
                      disabled={saving}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-bold outline-none"
                    >
                      <option
                        value="not_required"
                        className="bg-slate-950"
                      >
                        Not required
                      </option>
                      <option
                        value="awaiting_payment"
                        className="bg-slate-950"
                      >
                        Awaiting payment
                      </option>
                      <option
                        value="paid"
                        className="bg-slate-950"
                      >
                        Paid
                      </option>
                      <option
                        value="refunded"
                        className="bg-slate-950"
                      >
                        Refunded
                      </option>
                    </select>
                  </DetailSection>
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rejectConfirmOpen &&
      selected ? (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-confirm-title"
            className="w-full max-w-lg rounded-[2rem] border border-red-400/20 bg-[#0b1020] p-6 text-white shadow-2xl sm:p-8"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-200">
              <XCircle className="h-7 w-7" />
            </div>

            <h2
              id="reject-confirm-title"
              className="mt-5 text-2xl font-black"
            >
              Reject this application?
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/65">
              You are about to reject the application from{" "}
              <strong className="text-white">
                {selected.organisation_name}
              </strong>
              . The rejection reason will be saved with the application.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-red-200/70">
                Rejection reason
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-50">
                {rejectionReason.trim()}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setRejectConfirmOpen(false)
                }
                disabled={saving}
                className="min-h-12 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black transition hover:bg-white/[0.12] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void confirmRejection()
                }
                disabled={saving}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/20 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejecting
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Confirm rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.13em] text-white/45">
          {label}
        </p>
        <span className="text-purple-200">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function ApplicationCard({
  application,
  onOpen,
}: {
  application: EventVendorApplication;
  onOpen: () => void;
}) {
  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-5 shadow-xl backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.09]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-200">
            {typeIcon(
              application.application_type,
            )}
          </div>

          <div>
            <h2 className="text-lg font-black">
              {
                application.organisation_name
              }
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {
                application.application_reference
              }
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
            application.application_status,
          )}`}
        >
          {statusLabel(
            application.application_status,
          )}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MiniDetail
          label="Type"
          value={applicationTypeLabel(
            application.application_type,
          )}
        />
        <MiniDetail
          label="Fee"
          value={formatMoney(
            application.fee_pence,
          )}
        />
        <MiniDetail
          label="Contact"
          value={application.contact_name}
        />
        <MiniDetail
          label="Submitted"
          value={formatDate(
            application.submitted_at,
          )}
        />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-4 py-2 text-sm font-black shadow-lg transition hover:brightness-110"
      >
        Review application
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function MiniDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white/80">
        {value}
      </p>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-200">
          {icon}
        </div>
        <h3 className="text-lg font-black">
          {title}
        </h3>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DetailGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {children}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-white/80">
        {value}
      </p>
    </div>
  );
}

function DocumentLink({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  if (!url) {
    return (
      <div className="rounded-2xl border border-red-400/15 bg-red-500/5 p-4">
        <p className="text-sm font-black">
          {label}
        </p>
        <p className="mt-1 text-xs text-red-200/70">
          Not uploaded
        </p>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 transition hover:bg-emerald-500/15"
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-emerald-200" />
        <p className="text-sm font-black">
          {label}
        </p>
      </div>
      <p className="mt-1 text-xs text-emerald-100/70">
        View document
      </p>
    </a>
  );
}

function StatusButton({
  label,
  onClick,
  disabled,
  good = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  good?: boolean;
  danger?: boolean;
}) {
  const classes = danger
    ? "border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/20"
    : good
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
      : "border-blue-400/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 w-full rounded-2xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
    >
      {label}
    </button>
  );
}
