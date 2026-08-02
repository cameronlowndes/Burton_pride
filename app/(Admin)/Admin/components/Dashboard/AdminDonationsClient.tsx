"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

type Donation = {
  id: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  message: string | null;
  donation_type: string | null;
  amount_pence: number | null;
  currency: string | null;
  status: string | null;
  subscription_status?: string | null;
  supporter_story: string | null;
  supporter_image_url: string | null;
  supporter_story_status: string | null;
  supporter_wall_approved: boolean | null;
  pronouns: string | null;
  identity_label: string | null;
};

type DonationFilter = "all" | "monthly" | "one_time";

type EditingDonation = {
  id: string;
  fullName: string;
  supporterStory: string;
  supporterImageUrl: string;
  pronouns: string;
  identityLabel: string;
};

type CreateForm = {
  fullName: string;
  email: string;
  amountPounds: string;
  supporterStory: string;
  supporterImageUrl: string;
  pronouns: string;
  identityLabel: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  donations?: Donation[];
  donation?: Donation;
  rawResponse?: string;
  status?: number;
  [key: string]: unknown;
};

const identityOptions = [
  "Gay",
  "Lesbian",
  "Bisexual",
  "Pansexual",
  "Asexual",
  "Trans",
  "Non-Binary",
  "Genderfluid",
  "Queer",
  "Questioning",
  "Intersex",
  "Ally",
  "Drag Queen",
  "Drag King",
  "Prefer not to say",
  "Other",
];

const emptyCreateForm: CreateForm = {
  fullName: "",
  email: "",
  amountPounds: "",
  supporterStory: "",
  supporterImageUrl: "",
  pronouns: "",
  identityLabel: "",
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

async function readApiJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error: "API returned invalid JSON.",
      rawResponse: text,
      status: res.status,
    };
  }
}

function getApiError(data: ApiResponse, fallback: string) {
  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (typeof data.rawResponse === "string" && data.rawResponse.trim()) {
    return `${fallback}. The API returned a non-JSON response. Status: ${
      data.status || "unknown"
    }`;
  }

  return fallback;
}

function InfoCell({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-white/50">{label}</p>
      <p
        className={clsx(
          "min-w-0 font-bold leading-6 text-white",
          valueClassName,
        )}
      >
        {children}
      </p>
    </div>
  );
}

export default function AdminDonationsClient() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donationFilter, setDonationFilter] = useState<DonationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editing, setEditing] = useState<EditingDonation | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [creating, setCreating] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);

  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);

  const [deleteOneOpen, setDeleteOneOpen] = useState(false);
  const [deleteOneId, setDeleteOneId] = useState("");
  const [deleteOneName, setDeleteOneName] = useState("");
  const [deletingOne, setDeletingOne] = useState(false);

  const [cancelSubOpen, setCancelSubOpen] = useState(false);
  const [cancelSubId, setCancelSubId] = useState("");
  const [cancelSubName, setCancelSubName] = useState("");
  const [cancelSubPassword, setCancelSubPassword] = useState("");
  const [cancellingSub, setCancellingSub] = useState(false);

  const monthlyCount = donations.filter(
    (donation) => donation.donation_type === "monthly",
  ).length;

  const oneTimeCount = donations.filter(
    (donation) => donation.donation_type !== "monthly",
  ).length;

  const filteredDonations = donations.filter((donation) => {
    if (donationFilter === "all") return true;
    if (donationFilter === "monthly") return donation.donation_type === "monthly";
    return donation.donation_type !== "monthly";
  });

  async function loadDonations() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/donations", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readApiJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(getApiError(data, "Failed to load donations"));
      }

      setDonations(Array.isArray(data.donations) ? data.donations : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load donations");
    } finally {
      setLoading(false);
    }
  }

  async function updateStory(
    id: string,
    supporterStoryStatus: "approved" | "rejected" | "pending",
    supporterWallApproved: boolean,
  ) {
    try {
      setUpdatingId(id);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/admin/donations/${id}/supporter-wall`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supporterStoryStatus,
          supporterWallApproved,
        }),
      });

      const data = await readApiJson(res);

      if (!res.ok || !data.ok) {
        setError(getApiError(data, "Failed to update story"));
        return;
      }

      setSuccess("Supporter wall status updated.");
      await loadDonations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update story");
    } finally {
      setUpdatingId("");
    }
  }

  async function saveSupporterEdit() {
    if (!editing) return;

    try {
      setSavingEdit(true);
      setError("");
      setSuccess("");

      const res = await fetch(
        `/api/admin/donations/${editing.id}/edit-supporter`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: editing.fullName || "",
            supporterStory: editing.supporterStory || "",
            supporterImageUrl: editing.supporterImageUrl || "",
            pronouns: editing.pronouns || "",
            identityLabel: editing.identityLabel || "",
          }),
        },
      );

      const data = await readApiJson(res);

      if (!res.ok || !data.ok) {
        setError(getApiError(data, "Failed to save supporter details"));
        return;
      }

      setEditing(null);
      setSuccess("Supporter details saved.");
      await loadDonations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save supporter details",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function createSupporter() {
    try {
      if (!createForm.fullName.trim()) {
        setError("Supporter name is required");
        return;
      }

      const amountNumber = Number(createForm.amountPounds || 0);

      if (Number.isNaN(amountNumber) || amountNumber < 0) {
        setError("Please enter a valid amount");
        return;
      }

      setSavingCreate(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/admin/donations/create-supporter", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: createForm.fullName,
          email: createForm.email,
          amountPence: Math.round(amountNumber * 100),
          supporterStory: createForm.supporterStory,
          supporterImageUrl: createForm.supporterImageUrl,
          pronouns: createForm.pronouns,
          identityLabel: createForm.identityLabel,
        }),
      });

      const data = await readApiJson(res);

      if (!res.ok || !data.ok) {
        setError(getApiError(data, "Failed to create supporter"));
        return;
      }

      setCreating(false);
      setCreateForm(emptyCreateForm);
      setSuccess("Monthly supporter created.");
      await loadDonations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create supporter");
    } finally {
      setSavingCreate(false);
    }
  }

  async function deleteOneDonation() {
    try {
      if (!deleteOneId) return;

      setDeletingOne(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/admin/donations/${deleteOneId}/delete`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await readApiJson(res);

      if (!res.ok || !data.ok) {
        setError(getApiError(data, "Failed to delete donation"));
        return;
      }

      setDeleteOneOpen(false);
      setDeleteOneId("");
      setDeleteOneName("");
      setSuccess("Donation deleted successfully.");
      await loadDonations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete donation");
    } finally {
      setDeletingOne(false);
    }
  }

  async function deleteAllDonations() {
    try {
      if (!deletePassword.trim()) {
        setError("Main admin delete password is required");
        return;
      }

      setDeletingAll(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/admin/donations/delete-all", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
        }),
      });

      const data = await readApiJson(res);

      if (!res.ok || !data.ok) {
        setError(getApiError(data, "Failed to delete all donations"));
        return;
      }

      setDeleteAllOpen(false);
      setDeletePassword("");
      setSuccess("All donations have been deleted successfully.");
      await loadDonations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete all donations",
      );
    } finally {
      setDeletingAll(false);
    }
  }

  function openDeleteOne(donation: Donation) {
    setError("");
    setSuccess("");
    setDeleteOneId(donation.id);
    setDeleteOneName(donation.full_name || "this supporter");
    setDeleteOneOpen(true);
  }

  function openCancelSubscription(donation: Donation) {
    setError("");
    setSuccess("");
    setCancelSubId(donation.id);
    setCancelSubName(donation.full_name || "this supporter");
    setCancelSubPassword("");
    setCancelSubOpen(true);
  }

  async function cancelSubscription() {
    try {
      if (!cancelSubId) return;

      if (!cancelSubPassword.trim()) {
        setError("Main admin password is required");
        return;
      }

      setCancellingSub(true);
      setError("");
      setSuccess("");

      const res = await fetch(
        `/api/admin/donations/${cancelSubId}/cancel-subscription`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: cancelSubPassword,
          }),
        },
      );

      const data = await readApiJson(res);

      if (!res.ok || !data.ok) {
        setError(getApiError(data, "Failed to cancel subscription"));
        return;
      }

      setCancelSubOpen(false);
      setCancelSubId("");
      setCancelSubName("");
      setCancelSubPassword("");
      setSuccess("Monthly subscription cancelled successfully.");
      await loadDonations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel subscription",
      );
    } finally {
      setCancellingSub(false);
    }
  }

  function handleEditImageUpload(file: File | null) {
    if (!file || !editing) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setEditing((current) => {
        if (!current) return current;

        return {
          ...current,
          supporterImageUrl: String(reader.result || ""),
        };
      });
    };

    reader.readAsDataURL(file);
  }

  function handleCreateImageUpload(file: File | null) {
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setCreateForm((current) => ({
        ...current,
        supporterImageUrl: String(reader.result || ""),
      }));
    };

    reader.readAsDataURL(file);
  }

  useEffect(() => {
    loadDonations();
  }, []);

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-yellow-300">
            Donations Page editor
          </h1>

          <p className="mt-2 text-white/70">
            View donations, monthly supporters, approve supporter wall stories,
            create supporters, edit supporter details, and cancel Stripe monthly
            subscriptions.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-full bg-yellow-300 px-6 py-3 font-black text-black transition hover:bg-yellow-200"
            >
              Create Monthly Supporter Wall
            </button>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setDeleteAllOpen(true);
              }}
              className="rounded-full bg-red-600 px-6 py-3 font-black text-white transition hover:bg-red-700"
            >
              Delete All Monthly Supporter Wall Submissions
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <button
              type="button"
              onClick={() => setDonationFilter("all")}
              className={`rounded-full px-6 py-3 font-black transition ${
                donationFilter === "all"
                  ? "bg-white text-fuchsia-700 shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              All Donations ({donations.length})
            </button>

            <button
              type="button"
              onClick={() => setDonationFilter("monthly")}
              className={`rounded-full px-6 py-3 font-black transition ${
                donationFilter === "monthly"
                  ? "bg-yellow-300 text-black shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Monthly Supporters ({monthlyCount})
            </button>

            <button
              type="button"
              onClick={() => setDonationFilter("one_time")}
              className={`rounded-full px-6 py-3 font-black transition ${
                donationFilter === "one_time"
                  ? "bg-pink-500 text-white shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              One-Time Donations ({oneTimeCount})
            </button>
          </div>

          <div className="mt-5 rounded-3xl border border-red-300/30 bg-red-500/10 p-5">
            <h2 className="text-lg font-black text-red-100">Danger Zone</h2>
            <p className="mt-1 text-sm leading-6 text-red-50/80">
              Cancelling a subscription stops future Stripe monthly payments.
              Deleting a donation only removes the record from your admin portal.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-3xl border border-red-300 bg-red-500/10 p-6 font-bold text-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-3xl border border-green-300/30 bg-green-500/20 p-6 font-bold text-green-100">
            {success}
          </div>
        )}

        {loading && (
          <div className="rounded-3xl bg-white/10 p-6">
            Loading donations...
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {filteredDonations.map((donation) => {
              const isApproved =
                donation.supporter_story_status === "approved" &&
                donation.supporter_wall_approved === true;

              const isRejected = donation.supporter_story_status === "rejected";

              const isPending =
                !isApproved && donation.supporter_story_status !== "rejected";

              const isUpdating = updatingId === donation.id;

              const isMonthly = donation.donation_type === "monthly";
              const isCancelled =
                donation.subscription_status === "cancelled" ||
                donation.status === "cancelled";

              return (
                <div
                  key={donation.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur"
                >
                  <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_minmax(105px,0.7fr)_minmax(120px,0.8fr)_minmax(150px,1fr)]">
                    <InfoCell label="Name" valueClassName="break-words">
                      {donation.full_name || "Unknown"}
                    </InfoCell>

                    <InfoCell
                      label="Email"
                      valueClassName="break-all text-sm leading-6"
                    >
                      {donation.email || "No email"}
                    </InfoCell>

                    <InfoCell label="Amount" valueClassName="whitespace-nowrap">
                      £{((donation.amount_pence || 0) / 100).toFixed(2)}
                    </InfoCell>

                    <InfoCell label="Type" valueClassName="break-words">
                      {isMonthly ? "Monthly" : "One-Time"}
                    </InfoCell>

                    <InfoCell
                      label="Payment Status"
                      valueClassName={clsx(
                        "break-words",
                        isCancelled ? "text-red-200" : "text-green-200",
                      )}
                    >
                      {isCancelled
                        ? "Cancelled"
                        : donation.status || "Active / paid"}
                    </InfoCell>
                  </div>

                  {(donation.pronouns || donation.identity_label) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {donation.pronouns && (
                        <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white">
                          {donation.pronouns}
                        </span>
                      )}

                      {donation.identity_label && (
                        <span className="rounded-full border border-yellow-300/30 bg-yellow-300/20 px-4 py-2 text-xs font-bold text-yellow-100">
                          {donation.identity_label}
                        </span>
                      )}
                    </div>
                  )}

                  {donation.message && (
                    <div className="mt-5 rounded-2xl bg-white/10 p-4">
                      <p className="text-sm text-white/50">Message</p>
                      <p className="mt-1 break-words">{donation.message}</p>
                    </div>
                  )}

                  {isMonthly && (
                    <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-orange-300/30 bg-orange-500/10 p-4">
                      <div className="w-full">
                        <p className="text-sm font-black text-orange-100">
                          Monthly Subscription Controls
                        </p>
                        <p className="mt-1 text-sm text-white/70">
                          Use this only when the supporter asks to stop their
                          monthly payment.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isCancelled}
                        onClick={() => openCancelSubscription(donation)}
                        className={`rounded-full px-5 py-3 font-bold text-white transition ${
                          isCancelled
                            ? "cursor-not-allowed bg-red-900/60 opacity-60"
                            : "bg-orange-500 hover:bg-orange-600"
                        }`}
                      >
                        {isCancelled
                          ? "Subscription Cancelled"
                          : "Cancel Subscription"}
                      </button>

                      <button
                        type="button"
                        onClick={() => openDeleteOne(donation)}
                        className="rounded-full bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700"
                      >
                        Delete Record
                      </button>
                    </div>
                  )}

                  {isMonthly &&
                    (donation.supporter_story ||
                      donation.supporter_image_url) && (
                      <div className="mt-5 rounded-2xl border border-yellow-300/30 bg-yellow-300/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-bold text-yellow-200">
                            Supporter Wall Submission
                          </p>

                          {isApproved && (
                            <span className="rounded-full bg-green-500 px-4 py-2 text-xs font-black text-white">
                              Live on website
                            </span>
                          )}

                          {isRejected && (
                            <span className="rounded-full bg-red-500 px-4 py-2 text-xs font-black text-white">
                              Hidden from website
                            </span>
                          )}

                          {isPending && (
                            <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">
                              Waiting approval
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-5 md:grid-cols-[180px_1fr]">
                          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                            <div className="relative h-44 w-full">
                              {donation.supporter_image_url ? (
                                <Image
                                  src={donation.supporter_image_url}
                                  alt={donation.full_name || "Supporter photo"}
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-center text-sm font-bold text-white/60">
                                  No photo uploaded
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white/60">
                              Supporter Story
                            </p>

                            <p className="mt-2 break-words leading-7 text-white/90">
                              {donation.supporter_story || "No story written."}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-3">
                              <button
                                type="button"
                                disabled={isUpdating || isApproved}
                                onClick={() =>
                                  updateStory(donation.id, "approved", true)
                                }
                                className={`rounded-full px-5 py-3 font-bold text-white transition ${
                                  isApproved
                                    ? "cursor-not-allowed bg-green-800 opacity-50"
                                    : "bg-green-500 hover:bg-green-600"
                                } ${
                                  isUpdating
                                    ? "cursor-not-allowed opacity-60"
                                    : ""
                                }`}
                              >
                                {isUpdating
                                  ? "Updating..."
                                  : isApproved
                                    ? "Approved"
                                    : "Approve Story"}
                              </button>

                              <button
                                type="button"
                                disabled={isUpdating || isRejected}
                                onClick={() =>
                                  updateStory(donation.id, "rejected", false)
                                }
                                className={`rounded-full px-5 py-3 font-bold text-white transition ${
                                  isRejected
                                    ? "cursor-not-allowed bg-red-800 opacity-50"
                                    : "bg-red-500 hover:bg-red-600"
                                } ${
                                  isUpdating
                                    ? "cursor-not-allowed opacity-60"
                                    : ""
                                }`}
                              >
                                {isUpdating
                                  ? "Updating..."
                                  : isRejected
                                    ? "Rejected"
                                    : "Reject Story"}
                              </button>

                              <button
                                type="button"
                                disabled={isUpdating || isPending}
                                onClick={() =>
                                  updateStory(donation.id, "pending", false)
                                }
                                className={`rounded-full px-5 py-3 font-bold text-white transition ${
                                  isPending
                                    ? "cursor-not-allowed bg-white/10 opacity-50"
                                    : "bg-white/10 hover:bg-white/20"
                                } ${
                                  isUpdating
                                    ? "cursor-not-allowed opacity-60"
                                    : ""
                                }`}
                              >
                                {isUpdating
                                  ? "Updating..."
                                  : isPending
                                    ? "Pending"
                                    : "Set Pending"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setEditing({
                                    id: donation.id,
                                    fullName: donation.full_name ?? "",
                                    supporterStory:
                                      donation.supporter_story ?? "",
                                    supporterImageUrl:
                                      donation.supporter_image_url ?? "",
                                    pronouns: donation.pronouns ?? "",
                                    identityLabel:
                                      donation.identity_label ?? "",
                                  })
                                }
                                className="rounded-full bg-yellow-300 px-5 py-3 font-bold text-black transition hover:bg-yellow-200"
                              >
                                Edit Details
                              </button>

                              <span className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold">
                                Status:{" "}
                                {donation.supporter_story_status || "pending"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {!isMonthly && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openDeleteOne(donation)}
                        className="rounded-full bg-red-600 px-5 py-3 font-bold text-white transition hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  <p className="mt-4 text-sm text-white/50">
                    {new Date(donation.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
              );
            })}

            {!filteredDonations.length && (
              <div className="rounded-3xl bg-white/10 p-6 text-center">
                No donations found for this filter.
              </div>
            )}
          </div>
        )}
      </div>

      {cancelSubOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <div className="w-full max-w-xl rounded-3xl border border-orange-300/30 bg-gradient-to-br from-orange-700 via-red-700 to-purple-800 p-6 text-white shadow-2xl">
            <h2 className="text-3xl font-black text-yellow-300">
              Cancel monthly subscription?
            </h2>

            <p className="mt-3 leading-7 text-white/85">
              You are about to cancel the Stripe monthly subscription for{" "}
              <span className="font-black text-yellow-200">
                {cancelSubName}
              </span>
              . This will stop future monthly payments.
            </p>

            <input
              type="password"
              value={cancelSubPassword}
              onChange={(e) => setCancelSubPassword(e.target.value)}
              placeholder="Main admin password"
              className="mt-5 w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
            />

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={cancellingSub}
                onClick={() => {
                  setCancelSubOpen(false);
                  setCancelSubId("");
                  setCancelSubName("");
                  setCancelSubPassword("");
                }}
                className="rounded-full bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={cancellingSub}
                onClick={cancelSubscription}
                className="rounded-full bg-orange-500 px-6 py-3 font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancellingSub ? "Cancelling..." : "Cancel Subscription"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOneOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <div className="w-full max-w-xl rounded-3xl border border-red-300/30 bg-gradient-to-br from-red-700 via-pink-700 to-purple-800 p-6 text-white shadow-2xl">
            <h2 className="text-3xl font-black text-yellow-300">
              Delete this donation?
            </h2>

            <p className="mt-3 leading-7 text-white/85">
              You are about to delete{" "}
              <span className="font-black text-yellow-200">
                {deleteOneName}
              </span>
              . This cannot be undone.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={deletingOne}
                onClick={() => {
                  setDeleteOneOpen(false);
                  setDeleteOneId("");
                  setDeleteOneName("");
                }}
                className="rounded-full bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deletingOne}
                onClick={deleteOneDonation}
                className="rounded-full bg-red-500 px-6 py-3 font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingOne ? "Deleting..." : "Delete This One"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteAllOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <div className="w-full max-w-xl rounded-3xl border border-red-300/30 bg-gradient-to-br from-red-700 via-pink-700 to-purple-800 p-6 text-white shadow-2xl">
            <h2 className="text-3xl font-black text-yellow-300">
              Delete ALL donations?
            </h2>

            <p className="mt-3 leading-7 text-white/85">
              This will permanently delete every donation and monthly supporter
              record from the admin portal.
            </p>

            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Main admin delete password"
              className="mt-5 w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
            />

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={deletingAll}
                onClick={() => {
                  setDeleteAllOpen(false);
                  setDeletePassword("");
                }}
                className="rounded-full bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deletingAll}
                onClick={deleteAllDonations}
                className="rounded-full bg-red-500 px-6 py-3 font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAll ? "Deleting..." : "Delete Everything"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/20 bg-gradient-to-br from-purple-700 via-fuchsia-700 to-pink-700 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-yellow-300">
                  Edit Supporter Details
                </h2>
                <p className="text-sm text-white/70">
                  These details will update the public supporter wall.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={editing.fullName || ""}
                onChange={(e) =>
                  setEditing({ ...editing, fullName: e.target.value })
                }
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
                placeholder="Supporter name"
              />

              <input
                value={editing.pronouns || ""}
                onChange={(e) =>
                  setEditing({ ...editing, pronouns: e.target.value })
                }
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
                placeholder="Pronouns"
              />

              <select
                value={editing.identityLabel || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    identityLabel: e.target.value,
                  })
                }
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none"
              >
                <option value="" className="text-black">
                  Identity / Community optional
                </option>

                {identityOptions.map((item) => (
                  <option key={item} value={item} className="text-black">
                    {item}
                  </option>
                ))}
              </select>

              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleEditImageUpload(e.target.files?.[0] || null)
                }
                className="block w-full cursor-pointer rounded-2xl border border-white/15 bg-white/10 p-4 text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-300 file:px-4 file:py-2 file:font-bold file:text-black"
              />

              <textarea
                value={editing.supporterStory || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    supporterStory: e.target.value,
                  })
                }
                rows={8}
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
                placeholder="Write supporter story..."
              />

              {editing.supporterImageUrl && (
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                  <div className="relative h-64 w-full">
                    <Image
                      src={editing.supporterImageUrl}
                      alt="Preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={saveSupporterEdit}
                  className="rounded-full bg-yellow-300 px-6 py-3 font-black text-black transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/20 bg-gradient-to-br from-purple-700 via-fuchsia-700 to-pink-700 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-yellow-300">
                  Create Monthly Supporter
                </h2>
                <p className="text-sm text-white/70">
                  Add someone directly to the Monthly Supporter Wall.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-full bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={createForm.fullName}
                onChange={(e) =>
                  setCreateForm({ ...createForm, fullName: e.target.value })
                }
                placeholder="Supporter name *"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
              />

              <input
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="Email optional"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                value={createForm.amountPounds}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    amountPounds: e.target.value,
                  })
                }
                placeholder="Monthly amount for admin, e.g. 5.00"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
              />

              <input
                value={createForm.pronouns}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    pronouns: e.target.value,
                  })
                }
                placeholder="Pronouns"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
              />

              <select
                value={createForm.identityLabel}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    identityLabel: e.target.value,
                  })
                }
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none"
              >
                <option value="" className="text-black">
                  Identity / Community optional
                </option>

                {identityOptions.map((item) => (
                  <option key={item} value={item} className="text-black">
                    {item}
                  </option>
                ))}
              </select>

              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  handleCreateImageUpload(e.target.files?.[0] || null)
                }
                className="block w-full cursor-pointer rounded-2xl border border-white/15 bg-white/10 p-4 text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-300 file:px-4 file:py-2 file:font-bold file:text-black"
              />

              <textarea
                value={createForm.supporterStory}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    supporterStory: e.target.value,
                  })
                }
                rows={8}
                placeholder="Supporter story"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-white outline-none placeholder:text-white/50"
              />

              {createForm.supporterImageUrl && (
                <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                  <div className="relative h-64 w-full">
                    <Image
                      src={createForm.supporterImageUrl}
                      alt="Preview"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-full bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/20"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={savingCreate}
                  onClick={createSupporter}
                  className="rounded-full bg-yellow-300 px-6 py-3 font-black text-black transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingCreate ? "Creating..." : "Create Supporter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}