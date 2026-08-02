"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LeaderRow = {
  entryId: string;
  businessName: string;
  address?: string;
  votes: number;
};

type VoteRow = {
  id: string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  voterHash: string | null;
  userAgent: string | null;
  entryId: string;
  companyName: string;
  companyAddress: string | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  stats?: {
    totalVotes: number;
    uniqueEmails: number;
    uniqueDevices: number;
  };
  leaderboard?: LeaderRow[];
  votes?: VoteRow[];
};

function formatDate(d: string) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/80">
      {children}
    </span>
  );
}

export default function WindowsOfHopeVotesClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<ApiResponse["stats"] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);

  const [query, setQuery] = useState("");
  const [minVotes, setMinVotes] = useState<number>(0);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/vote", { cache: "no-store" });
      const json: ApiResponse = await res.json();

      if (!json?.ok) {
        setError(json?.error || "Failed to load votes");
        setStats(null);
        setLeaderboard([]);
        setVotes([]);
        return;
      }

      setStats(json.stats || null);
      setLeaderboard(json.leaderboard || []);
      setVotes(json.votes || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load votes");
      setStats(null);
      setLeaderboard([]);
      setVotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredLeaderboard = useMemo(() => {
    if (!minVotes) return leaderboard;
    return leaderboard.filter((r) => r.votes >= minVotes);
  }, [leaderboard, minVotes]);

  const filteredVotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return votes;

    return votes.filter((v) => {
      const name = `${v.firstName || ""} ${v.lastName || ""}`.trim().toLowerCase();
      const email = (v.email || "").toLowerCase();
      const company = (v.companyName || "").toLowerCase();
      const addr = (v.companyAddress || "").toLowerCase();

      return name.includes(q) || email.includes(q) || company.includes(q) || addr.includes(q);
    });
  }, [votes, query]);

  return (
    <div className="p-6 text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Windows of Hope • Votes</h1>
          <p className="text-white/70 mt-1">
            Totals, leaderboard, and who voted for which company.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>API: /api/admin/vote</Pill>
            <Pill>Max rows: 5000</Pill>
            {loading ? <Pill>Loading…</Pill> : <Pill>Loaded</Pill>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10"
          >
            ⟳ Refresh
          </button>

          <Link
            href="/admin/dashboard/windows-showcase"
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 transition border border-white/10 text-white/85"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Total votes" value={loading ? "…" : stats?.totalVotes ?? 0} />
        <Stat label="Unique emails" value={loading ? "…" : stats?.uniqueEmails ?? 0} />
        <Stat label="Unique devices" value={loading ? "…" : stats?.uniqueDevices ?? 0} />
      </div>

      {/* Error */}
      {error ? (
        <div className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          {error}
        </div>
      ) : null}

      {/* Leaderboard */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-extrabold">Leaderboard</div>
            <div className="text-sm text-white/60">Votes per company (highest first)</div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-white/70">Min votes</label>
            <input
              type="number"
              min={0}
              value={minVotes}
              onChange={(e) => setMinVotes(Number(e.target.value || 0))}
              className="w-28 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/25"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-white/80">Loading leaderboard…</div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="p-6 text-white/80">No results.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/70">
                <tr>
                  <th className="text-left p-4">Company</th>
                  <th className="text-left p-4">Address</th>
                  <th className="text-right p-4">Votes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((row, idx) => (
                  <tr key={row.entryId || row.businessName} className="border-t border-white/10">
                    <td className="p-4 font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 text-xs">#{idx + 1}</span>
                        <span className="truncate">{row.businessName}</span>
                      </div>
                    </td>
                    <td className="p-4 text-white/70">{row.address || "—"}</td>
                    <td className="p-4 text-right font-extrabold">{row.votes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mt-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search voter name, email, company, address…"
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/40 focus:border-white/25"
        />
      </div>

      {/* Votes list */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-extrabold">All votes</div>
            <div className="text-sm text-white/60">
              Showing {loading ? "…" : filteredVotes.length} votes
            </div>
          </div>

          <div className="text-xs text-white/50">
            Tip: search by email or company name
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-white/80">Loading votes…</div>
        ) : filteredVotes.length === 0 ? (
          <div className="p-6 text-white/80">No votes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/70">
                <tr>
                  <th className="text-left p-4">Time</th>
                  <th className="text-left p-4">Voter</th>
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4">Voted for</th>
                  <th className="text-left p-4">Company address</th>
                </tr>
              </thead>
              <tbody>
                {filteredVotes.map((v) => (
                  <tr key={v.id} className="border-t border-white/10">
                    <td className="p-4 text-white/80">{formatDate(v.createdAt)}</td>
                    <td className="p-4 font-semibold">
                      {`${v.firstName || ""} ${v.lastName || ""}`.trim() || "—"}
                    </td>
                    <td className="p-4 text-white/80">{v.email || "—"}</td>
                    <td className="p-4 font-semibold">{v.companyName}</td>
                    <td className="p-4 text-white/70">{v.companyAddress || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer links */}
      <div className="mt-6 text-sm text-white/60">
        <Link href="/Competition" className="hover:text-white transition">
          View public competition page →
        </Link>
      </div>
    </div>
  );
}