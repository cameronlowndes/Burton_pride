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
};

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function updateStory(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/admin/donations/${id}/${action}-story`, {
      method: "PATCH",
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      alert(data.error || "Failed to update story");
      return;
    }

    await loadDonations();
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
            View donations, monthly supporters, and approve supporter wall
            stories.
          </p>
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
            {donations.map((donation) => (
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
                    <p className="font-bold">{donation.email || "No email"}</p>
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

                {donation.message && (
                  <div className="mt-5 rounded-2xl bg-white/10 p-4">
                    <p className="text-sm text-white/50">Message</p>
                    <p className="mt-1">{donation.message}</p>
                  </div>
                )}

                {donation.donation_type === "monthly" &&
                  (donation.supporter_story || donation.supporter_image_url) && (
                    <div className="mt-5 rounded-2xl border border-yellow-300/30 bg-yellow-300/10 p-4">
                      <p className="text-sm font-bold text-yellow-200">
                        Supporter Wall Submission
                      </p>

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
                              onClick={() =>
                                updateStory(donation.id, "approve")
                              }
                              className="rounded-full bg-green-500 px-5 py-3 font-bold text-white"
                            >
                              Approve Story
                            </button>

                            <button
                              type="button"
                              onClick={() => updateStory(donation.id, "reject")}
                              className="rounded-full bg-red-500 px-5 py-3 font-bold text-white"
                            >
                              Reject Story
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
            ))}

            {!donations.length && (
              <div className="rounded-3xl bg-white/10 p-6 text-center">
                No donations found yet.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}