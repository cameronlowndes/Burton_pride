"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = {
  entryId: string;
  businessName: string;
  address: string | null;
  imageUrl: string | null;
  votes: number;
};

export default function CompetitionLeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/windows/leaderboard", { cache: "no-store" });
      const text = await res.text();

      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Leaderboard API did not return JSON.");
      }

      if (!json?.ok) {
        throw new Error(json?.error || "Failed to load leaderboard.");
      }

      setTotalVotes(Number(json.totalVotes || 0));
      setRows((json.leaderboard || []) as Row[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load leaderboard.");
      setTotalVotes(0);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.businessName.toLowerCase().includes(q) ||
        (r.address || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const leader = rows[0] || null;

  return (
    <div className="min-h-screen text-white pt-28 sm:pt-32">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500" />
      <div className="fixed inset-0 -z-10 bg-black/20" />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-10 pb-32">
        {/* Header Card */}
        <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold">
                🏆 Windows Of Hope Leaderboard
              </h1>

              <p className="text-white/85 mt-2">
                Live vote totals for approved entries.
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 text-sm">
                <span className="font-semibold">Total votes</span>
                <span className="text-white/70">•</span>
                <span className="text-white/85">{loading ? "…" : totalVotes}</span>
              </div>

              {leader && !loading ? (
                <div className="mt-3 text-sm text-white/85">
                  Current leader: <span className="font-extrabold">{leader.businessName}</span>{" "}
                  <span className="text-white/70">({leader.votes} votes)</span>
                </div>
              ) : null}

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

              <Link
                href="/Competition/vote"
                className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-white text-black hover:bg-white/90 transition border border-white/25"
              >
                🗳️ Vote
              </Link>

              <button
                type="button"
                onClick={load}
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
            Loading leaderboard…
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/20 bg-white/10 p-6 text-white/85">
            No approved entries found.
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r, index) => (
              <div
                key={r.entryId}
                className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-xl overflow-hidden"
              >
                <div className="relative aspect-[16/10] bg-black/25 overflow-hidden">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl}
                      alt={r.businessName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/70 text-sm">
                      No image
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                  <div className="absolute left-3 top-3">
                    <span className="rounded-full border border-white/20 bg-black/40 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="absolute right-3 top-3">
                    <span className="rounded-full border border-white/20 bg-black/40 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold">
                      {r.votes} votes
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="font-extrabold">{r.businessName}</div>
                  <div className="text-sm text-white/75 mt-1">{r.address || "—"}</div>

                  <div className="mt-4">
                    <Link
                      href="/Competition/vote"
                      className="inline-flex items-center justify-center w-full rounded-2xl px-4 py-2 text-sm font-extrabold border border-white/20 bg-white text-black hover:bg-white/90 transition"
                    >
                      Vote →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}