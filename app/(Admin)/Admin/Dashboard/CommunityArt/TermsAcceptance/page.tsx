"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Submission = {
  id: string;
  contact_name?: string | null;
  artist_name: string;
  email: string;
  artwork_title: string;
  status: "pending" | "approved" | "rejected" | "hidden";
  no_ai_confirmed?: boolean;
  rights_confirmed?: boolean;
  public_consent?: boolean;
  terms_accepted?: boolean;
  created_at: string;
};

type ApiPayload = {
  submissions?: Submission[];
  error?: string;
  message?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function AcceptanceIcon({ accepted }: { accepted: boolean }) {
  return accepted ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
      <CheckCircle2 className="h-4 w-4" /> Accepted
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-black text-red-800">
      <XCircle className="h-4 w-4" /> Missing
    </span>
  );
}

export default function CommunityArtTermsAcceptancePage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "complete" | "missing">("all");

  async function loadSubmissions() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/community-art?status=all", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "The terms acceptance table could not be loaded.");
      }
      setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubmissions();
  }, []);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return submissions.filter((submission) => {
      const complete = Boolean(
        submission.no_ai_confirmed &&
          submission.rights_confirmed &&
          submission.public_consent &&
          submission.terms_accepted,
      );
      if (filter === "complete" && !complete) return false;
      if (filter === "missing" && complete) return false;
      if (!query) return true;
      return [
        submission.contact_name || "",
        submission.artist_name,
        submission.email,
        submission.artwork_title,
        submission.status,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [submissions, search, filter]);

  const completeCount = submissions.filter(
    (item) =>
      item.no_ai_confirmed &&
      item.rights_confirmed &&
      item.public_consent &&
      item.terms_accepted,
  ).length;

  return (
    <main className="min-h-screen bg-transparent px-4 pb-12 pt-24 text-white sm:px-7 sm:pt-28 lg:px-10">
      <div className="mx-auto max-w-[1700px]">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 p-6 shadow-xl sm:p-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-wide">
                <ShieldCheck className="h-4 w-4" /> Artist permissions
              </p>
              <h1 className="mt-4 text-3xl font-black sm:text-5xl">
                Community Art Terms Acceptance
              </h1>
              <p className="mt-3 max-w-4xl text-white/85">
                Check whether every artist accepted all required declarations before artwork is approved or published.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/Admin/Dashboard/CommunityArt"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-5 py-3 font-black text-white hover:bg-white hover:text-purple-800"
              >
                <ArrowLeft className="h-5 w-5" /> Back to submissions
              </Link>
              <Link
                href="/CommunityArt/TermsAndConditions"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-2xl bg-yellow-300 px-5 py-3 font-black text-purple-950 hover:bg-white"
              >
                <FileText className="h-5 w-5" /> Read full terms
              </Link>
              <button
                type="button"
                onClick={() => void loadSubmissions()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-purple-800 disabled:opacity-60"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>
        </motion.header>

        {error ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-950">
            <div className="flex gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-700" />
              <div><p className="font-black">Could not load acceptance records</p><p className="mt-1">{error}</p></div>
            </div>
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/20 bg-black/20 p-5 backdrop-blur-md">
            <p className="text-sm font-black uppercase tracking-wide text-white/65">Total artists</p>
            <p className="mt-2 text-4xl font-black">{submissions.length}</p>
          </div>
          <div className="rounded-3xl border border-emerald-300/30 bg-emerald-500/15 p-5 backdrop-blur-md">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-100">All terms accepted</p>
            <p className="mt-2 text-4xl font-black">{completeCount}</p>
          </div>
          <div className="rounded-3xl border border-red-300/30 bg-red-500/15 p-5 backdrop-blur-md">
            <p className="text-sm font-black uppercase tracking-wide text-red-100">Missing permission</p>
            <p className="mt-2 text-4xl font-black">{submissions.length - completeCount}</p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/20 bg-black/20 p-5 shadow-lg backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["all", "complete", "missing"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-2 text-sm font-black capitalize ${filter === value ? "bg-yellow-300 text-purple-950" : "border border-white/20 bg-white/10 text-white"}`}
                >
                  {value === "complete" ? "All accepted" : value === "missing" ? "Missing terms" : "All artists"}
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/60" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search artist, email or artwork"
                className="w-full rounded-2xl border border-white/25 bg-black/25 py-3 pl-12 pr-4 text-white outline-none placeholder:text-white/55 focus:border-yellow-300"
              />
            </label>
          </div>
        </section>

        {loading ? (
          <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-12 w-12 animate-spin" /></div>
        ) : (
          <section className="mt-6 overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-[1250px] w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-5 py-4">Artist</th>
                    <th className="px-5 py-4">Artwork</th>
                    <th className="px-5 py-4">Human-created</th>
                    <th className="px-5 py-4">Copyright</th>
                    <th className="px-5 py-4">Publish permission</th>
                    <th className="px-5 py-4">Terms accepted</th>
                    <th className="px-5 py-4">Overall</th>
                    <th className="px-5 py-4">Submitted</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((submission) => {
                    const complete = Boolean(submission.no_ai_confirmed && submission.rights_confirmed && submission.public_consent && submission.terms_accepted);
                    return (
                      <tr key={submission.id} className="border-t border-slate-200 align-top hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-950">{submission.artist_name || "Anonymous artist"}</p>
                          {submission.contact_name ? <p className="mt-1 text-xs">Contact: {submission.contact_name}</p> : null}
                          <a href={`mailto:${submission.email}`} className="mt-2 inline-flex items-center gap-1 font-bold text-purple-700 hover:underline"><Mail className="h-4 w-4" />{submission.email}</a>
                        </td>
                        <td className="px-5 py-4"><p className="font-black text-slate-950">{submission.artwork_title}</p><p className="mt-1 capitalize">{submission.status}</p></td>
                        <td className="px-5 py-4"><AcceptanceIcon accepted={Boolean(submission.no_ai_confirmed)} /></td>
                        <td className="px-5 py-4"><AcceptanceIcon accepted={Boolean(submission.rights_confirmed)} /></td>
                        <td className="px-5 py-4"><AcceptanceIcon accepted={Boolean(submission.public_consent)} /></td>
                        <td className="px-5 py-4"><AcceptanceIcon accepted={Boolean(submission.terms_accepted)} /></td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-black ${complete ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                            {complete ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            {complete ? "4/4 complete" : "Action required"}
                          </span>
                        </td>
                        <td className="px-5 py-4">{formatDate(submission.created_at)}</td>
                        <td className="px-5 py-4">
                          <Link href={`/Admin/Dashboard/CommunityArt?submission=${encodeURIComponent(submission.id)}`} className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 font-black text-white hover:bg-purple-600"><Eye className="h-4 w-4" />Review</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? <div className="p-12 text-center text-slate-600"><p className="text-xl font-black text-slate-900">No matching artists</p><p className="mt-2">Try another search or filter.</p></div> : null}
          </section>
        )}
      </div>
    </main>
  );
}
