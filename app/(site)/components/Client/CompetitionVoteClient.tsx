"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VoteEntry = {
  id: string;
  businessName: string;
  address?: string;
  imageUrl?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function CompetitionVoteClient() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<VoteEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // backend vote lock (Option B cookie-based)
  const [lockedVoteId, setLockedVoteId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // voter details (collected before submitting)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submittingVote, setSubmittingVote] = useState(false);

  // -----------------------------
  // LOAD approved entries (from DB)
  // -----------------------------
  async function loadApprovedEntries() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/windows/public-entries", { cache: "no-store" });
      const json = await res.json();

      if (!json?.ok) {
        setEntries([]);
        setError(json?.error || "Failed to load entries");
        return;
      }

      const mapped: VoteEntry[] = (json.entries || []).map((e: any) => ({
        id: e.id,
        businessName: e.business_name,
        address: e.address || undefined,
        imageUrl: e.image_url || undefined,
      }));

      setEntries(mapped);
    } catch (e: any) {
      setEntries([]);
      setError(e?.message || "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------
  // CHECK if user already voted (reads competition_votes)
  // -----------------------------
  async function loadMyVoteStatus() {
    try {
      const res = await fetch("/api/windows/vote/status", { cache: "no-store" });
      const json = await res.json();

      if (json?.ok && json?.votedEntryId) {
        setLockedVoteId(json.votedEntryId);
        setSelectedId(json.votedEntryId);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadApprovedEntries();
    loadMyVoteStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.businessName.toLowerCase().includes(q) ||
        (e.address || "").toLowerCase().includes(q)
    );
  }, [entries, query]);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) || null,
    [entries, selectedId]
  );

  const previewEntry = useMemo(
    () => entries.find((e) => e.id === previewId) || null,
    [entries, previewId]
  );

  const canVote = !!selectedId && !lockedVoteId;

  const onCardClick = (id: string) => {
    if (lockedVoteId) return;
    setSelectedId(id);
    setPreviewId(id);
    setPreviewOpen(true);
  };

  // -----------------------------
  // SUBMIT vote (writes competition_votes)
  // -----------------------------
  async function submitVote() {
    if (!selectedId) return;

    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim().toLowerCase();

    if (!fn || !ln || !em) {
      setError("Please enter your first name, last name, and email address.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(em)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    setSubmittingVote(true);

    try {
      const res = await fetch("/api/windows/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: selectedId,
          firstName: fn,
          lastName: ln,
          email: em,
        }),
      });

      const json = await res.json();

      if (!json?.ok) {
        setError(json?.error || "Vote failed");
        setConfirmOpen(false);
        return;
      }

      if (json.alreadyVoted) {
        // server tells us what they voted for
        const voted = json.votedEntryId || null;
        setLockedVoteId(voted || "locked");
        if (voted) setSelectedId(voted);
        setConfirmOpen(false);
        return;
      }

      // success
      setLockedVoteId(selectedId);
      setConfirmOpen(false);
    } catch (e: any) {
      setError(e?.message || "Vote failed");
      setConfirmOpen(false);
    } finally {
      setSubmittingVote(false);
    }
  }

  

  return (
    <div className="min-h-screen text-white pt-28 sm:pt-32">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500" />
      <div className="fixed inset-0 -z-10 bg-black/20" />

      {/* Container */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 pb-32">
        {/* Header Card */}
        <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold">
                🗳️ Vote for your favourite Window Of Hope
              </h1>

              <p className="text-white/85 mt-2">
                Click an entry to view the photo. Choose one entry only — once you vote, it’s locked.
              </p>

              {lockedVoteId ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 text-sm">
                  <span className="font-semibold">Vote submitted</span>
                  <span className="text-white/70">•</span>
                  <span className="text-white/85">
                    {entries.find((e) => e.id === lockedVoteId)?.businessName || "Already voted"}
                  </span>
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 text-sm">
                  <span className="font-semibold">One vote per person</span>
                  <span className="text-white/70">•</span>
                  <span className="text-white/85">Pick carefully</span>
                </div>
              )}

              {error ? (
                <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Link
                href="/Competition"
                className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-black/20 hover:bg-black/30 transition border border-white/15"
              >
                ← Back
              </Link>

              <button
                type="button"
                onClick={loadApprovedEntries}
                className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/15"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search business name or address…"
              className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/50 focus:border-white/30"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="mt-8 rounded-3xl border border-white/20 bg-white/10 p-6 text-white/85">
            Loading approved entries…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/20 bg-white/10 p-6 text-white/85">
            No approved entries yet.
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => {
              const isSelected = selectedId === e.id;
              const isLocked = !!lockedVoteId;

              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => onCardClick(e.id)}
                  className={cn(
                    "group text-left rounded-3xl border backdrop-blur-xl shadow-xl overflow-hidden transition transform hover:-translate-y-1 hover:shadow-2xl",
                    "bg-white/10 border-white/15 hover:border-white/30",
                    isSelected && "border-white/50 ring-2 ring-white/40",
                    isLocked && "opacity-80 cursor-not-allowed",
                    !isLocked && "cursor-pointer"
                  )}
                >
                  <div className="relative aspect-[16/10] bg-black/25 overflow-hidden">
                    {e.imageUrl ? (
                      <img
                        src={e.imageUrl}
                        alt={e.businessName}
                        className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105 group-hover:brightness-110"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-white/70 text-sm">
                        No image uploaded
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-80 group-hover:opacity-60 transition duration-300" />

                    <div className="absolute left-3 top-3">
                      <span className="rounded-full border border-white/20 bg-black/40 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold">
                        {isSelected ? "Selected" : "Click to preview"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="font-extrabold">{e.businessName}</div>
                    <div className="text-sm text-white/75 mt-1">{e.address || "—"}</div>
                    <div className="text-xs text-white/60 mt-2">Click to open photo</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Vote Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-6">
          <div className="rounded-3xl border border-white/20 bg-black/30 backdrop-blur-xl shadow-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-white/70">Selected</div>
                <div className="font-extrabold truncate">
                  {selected ? selected.businessName : "None yet"}
                </div>
                <div className="text-xs text-white/60 truncate">
                  {selected?.address || "Click a business above to preview and select"}
                </div>
              </div>

              {lockedVoteId ? (
                <button
                  disabled
                  className="rounded-2xl px-5 py-3 text-sm font-extrabold border border-white/15 bg-white/10 text-white/60"
                >
                  Vote submitted ✅
                </button>
              ) : (
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!canVote}
                  className={cn(
                    "rounded-2xl px-5 py-3 text-sm font-extrabold border transition",
                    canVote
                      ? "cursor-pointer bg-white text-black border-white/25 hover:bg-white/90"
                      : "bg-white/10 text-white/60 border-white/15 cursor-not-allowed"
                  )}
                >
                  Vote now →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Photo Preview Modal */}
      {previewOpen && previewEntry && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={() => setPreviewOpen(false)}
            className="absolute inset-0 bg-black/75 cursor-pointer"
          />
          <div className="absolute left-1/2 top-1/2 w-[900px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/20 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-3 p-5 border-b border-white/10">
              <div className="min-w-0">
                <div className="font-extrabold truncate">{previewEntry.businessName}</div>
                <div className="text-sm text-white/70 truncate">{previewEntry.address || "—"}</div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="cursor-pointer rounded-xl bg-black/25 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-black/35 transition"
                >
                  Close
                </button>

                {!lockedVoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(previewEntry.id);
                      setPreviewOpen(false);
                    }}
                    className="cursor-pointer rounded-xl bg-white text-black px-4 py-2 text-sm font-extrabold hover:bg-white/90 transition"
                  >
                    {selectedId === previewEntry.id ? "Selected ✅" : "Select this"}
                  </button>
                )}
              </div>
            </div>

            <div className="bg-black/30">
              {previewEntry.imageUrl ? (
                <img
                  src={previewEntry.imageUrl}
                  alt={previewEntry.businessName}
                  className="w-full max-h-[70vh] object-contain"
                />
              ) : (
                <div className="p-10 text-white/80">No image uploaded for this entry.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Vote Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={() => setConfirmOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="absolute left-1/2 top-1/2 w-[500px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/20 p-6">
            <div className="text-lg font-extrabold mb-4">Confirm your vote</div>

            <div className="font-bold">{selected?.businessName}</div>
            <div className="text-sm text-white/70 mt-1">{selected?.address}</div>

            {/* Voter details */}
            <div className="mt-5 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    First name
                  </label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-white/30"
                    placeholder="First name"
                    autoComplete="given-name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Last name
                  </label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-white/30"
                    placeholder="Last name"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Email address
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/40 focus:border-white/30"
                  placeholder="name@email.com"
                  inputMode="email"
                  autoComplete="email"
                />
                <div className="text-xs text-white/60 mt-2">
                  We use this to help keep voting fair (one vote per person).
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="cursor-pointer rounded-xl bg-black/25 border border-white/15 px-4 py-2"
              >
                Cancel
              </button>

              <button
                onClick={submitVote}
                disabled={submittingVote}
                className={cn(
                  "cursor-pointer rounded-xl bg-white text-black px-4 py-2 font-bold",
                  submittingVote && "opacity-70 cursor-not-allowed"
                )}
              >
                {submittingVote ? "Submitting…" : "Confirm vote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}