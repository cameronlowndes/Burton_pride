"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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
  supporter_story: string | null;
  supporter_image_url: string | null;
  supporter_story_status: string | null;
  supporter_wall_approved: boolean | null;
  pronouns: string | null;
  identity_label: string | null;
};

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
  supporterStory: string;
  supporterImageUrl: string;
  pronouns: string;
  identityLabel: string;
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

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editing, setEditing] = useState<EditingDonation | null>(null);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    fullName: "",
    email: "",
    supporterStory: "",
    supporterImageUrl: "",
    pronouns: "",
    identityLabel: "",
  });

  async function loadDonations() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/donations", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load donations");
      }

      setDonations(data.donations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load donations");
    } finally {
      setLoading(false);
    }
  }

  async function updateStory(
    id: string,
    supporterStoryStatus: "approved" | "rejected" | "pending",
    supporterWallApproved: boolean
  ) {
    try {
      setUpdatingId(id);

      const res = await fetch(`/api/admin/donations/${id}/supporter-wall`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supporterStoryStatus,
          supporterWallApproved,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.error || "Failed to update story");
        return;
      }

      await loadDonations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update story");
    } finally {
      setUpdatingId("");
    }
  }

  async function saveSupporterEdit() {
    if (!editing) return;

    try {
      setSavingEdit(true);

      const res = await fetch(
        `/api/admin/donations/${editing.id}/edit-supporter`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: editing.fullName || "",
            supporterStory: editing.supporterStory || "",
            supporterImageUrl: editing.supporterImageUrl || "",
            pronouns: editing.pronouns || "",
            identityLabel: editing.identityLabel || "",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.error || "Failed to save supporter details");
        return;
      }

      setEditing(null);
      await loadDonations();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to save supporter details"
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function createSupporter() {
    try {
      if (!createForm.fullName.trim()) {
        alert("Supporter name is required");
        return;
      }

      setSavingCreate(true);

      const res = await fetch("/api/admin/donations/create-supporter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.error || "Failed to create supporter");
        return;
      }

      setCreating(false);
      setCreateForm({
        fullName: "",
        email: "",
        supporterStory: "",
        supporterImageUrl: "",
        pronouns: "",
        identityLabel: "",
      });

      await loadDonations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create supporter");
    } finally {
      setSavingCreate(false);
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
            create supporters, and edit supporter details.
          </p>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-5 rounded-full bg-yellow-300 px-6 py-3 font-black text-black transition hover:bg-yellow-200"
          >
            Create Monthly Supporter
          </button>
        </div>

        {loading && (
          <div className="rounded-3xl bg-white/10 p-6">
            Loading donations...
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-red-300 bg-red-500/10 p-6 text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-5">
            {donations.map((donation) => {
              const isApproved =
                donation.supporter_story_status === "approved" &&
                donation.supporter_wall_approved === true;

              const isRejected = donation.supporter_story_status === "rejected";

              const isPending =
                !isApproved && donation.supporter_story_status !== "rejected";

              const isUpdating = updatingId === donation.id;

              return (
                <div
                  key={donation.id}
                  className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur"
                >
                  <div className="grid gap-4 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-white/50">Name</p>
                      <p className="font-bold">
                        {donation.full_name || "Unknown"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-white/50">Email</p>
                      <p className="font-bold">
                        {donation.email || "No email"}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-white/50">Amount</p>
                      <p className="font-bold">
                        £{((donation.amount_pence || 0) / 100).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-white/50">Type</p>
                      <p className="font-bold">
                        {donation.donation_type === "monthly"
                          ? "Monthly"
                          : "One-Time"}
                      </p>
                    </div>
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
                      <p className="mt-1">{donation.message}</p>
                    </div>
                  )}

                  {donation.donation_type === "monthly" &&
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

                          <div>
                            <p className="text-sm font-bold text-white/60">
                              Supporter Story
                            </p>

                            <p className="mt-2 leading-7 text-white/90">
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

                  <p className="mt-4 text-sm text-white/50">
                    {new Date(donation.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
              );
            })}

            {!donations.length && (
              <div className="rounded-3xl bg-white/10 p-6 text-center">
                No donations found yet.
              </div>
            )}
          </div>
        )}
      </div>

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
                placeholder="Pronouns, e.g. he/him, she/her, they/them"
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
                value={createForm.pronouns}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    pronouns: e.target.value,
                  })
                }
                placeholder="Pronouns, e.g. he/him, she/her, they/them"
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