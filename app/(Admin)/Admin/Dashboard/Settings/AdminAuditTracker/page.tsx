"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type AuditLog = {
  id: string;
  created_at: string;
  admin_email: string | null;
  admin_name: string | null;
  admin_role: string | null;
  action: string;
  area: string;
  route: string | null;
  method: string | null;
  status: string;
  risk_level: "low" | "medium" | "high" | "critical";
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
};

const riskClassNames = {
  low: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
  medium: "border-sky-300/20 bg-sky-500/10 text-sky-100",
  high: "border-amber-300/20 bg-amber-500/10 text-amber-100",
  critical: "border-red-300/20 bg-red-500/10 text-red-100",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function toCsvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(logs: AuditLog[]) {
  const headers = [
    "created_at",
    "admin_email",
    "admin_role",
    "action",
    "area",
    "route",
    "method",
    "status",
    "risk_level",
    "ip_address",
  ];

  const rows = logs.map((log) =>
    headers.map((key) => toCsvValue((log as any)[key])).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("");
  const [area, setArea] = useState("");

  async function loadLogs() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("limit", "150");
      if (risk) params.set("risk", risk);
      if (area) params.set("area", area);

      const response = await fetch(`/api/admin/audit-log?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to load audit logs.");
      }

      setLogs(Array.isArray(json.logs) ? json.logs : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [risk, area]);

  const visibleLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return logs;

    return logs.filter((log) => {
      return [
        log.admin_email,
        log.admin_name,
        log.admin_role,
        log.action,
        log.area,
        log.route,
        log.method,
        log.status,
        log.risk_level,
        log.ip_address,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [logs, search]);

  return (
    <main className="min-h-screen text-white">
      <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/65">
              <ShieldCheck className="h-4 w-4" />
              Admin security
            </div>

            <h1 className="mt-4 text-3xl font-black">Admin Portal Audit Logs</h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Track login attempts, logouts, page views, permission issues and
              important admin actions across the Burton Pride Admin Portal.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => downloadCsv(visibleLogs)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-purple-700 hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
          <Search className="h-4 w-4 text-white/50" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search logs..."
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/40"
          />
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
          <Filter className="h-4 w-4 text-white/50" />
          <select
            value={risk}
            onChange={(event) => setRisk(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
          >
            <option value="">All risk levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
          <Filter className="h-4 w-4 text-white/50" />
          <select
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
          >
            <option value="">All areas</option>
            <option value="auth">Auth</option>
            <option value="dashboard">Dashboard</option>
            <option value="money">Money</option>
            <option value="email">Email</option>
            <option value="event_hub">Event Hub</option>
            <option value="admin_users">Admin Users</option>
            <option value="audit_logs">Audit Logs</option>
            <option value="donations">Donations</option>
            <option value="raffle">Raffle</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-3 font-black">Loading audit logs...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-300/25 bg-red-500/10 p-6 text-red-50">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Could not load audit logs</p>
              <p className="mt-1 text-sm text-red-50/80">{error}</p>
            </div>
          </div>
        </div>
      ) : visibleLogs.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center">
          <p className="font-black">No audit logs found</p>
          <p className="mt-2 text-sm text-white/60">
            Once login/page tracking starts, records will show here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-[0.16em] text-white/55">
                <tr>
                  <th className="px-4 py-4">Time</th>
                  <th className="px-4 py-4">Admin</th>
                  <th className="px-4 py-4">Action</th>
                  <th className="px-4 py-4">Area</th>
                  <th className="px-4 py-4">Route</th>
                  <th className="px-4 py-4">Risk</th>
                  <th className="px-4 py-4">IP</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {visibleLogs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-white/[0.04]">
                    <td className="whitespace-nowrap px-4 py-4 text-white/75">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-white/35" />
                        {formatDate(log.created_at)}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-black text-white">
                        {log.admin_name || log.admin_email || "Unknown"}
                      </div>
                      {log.admin_email ? (
                        <div className="mt-1 text-xs text-white/45">
                          {log.admin_email}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-black text-white">{log.action}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {log.status}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-white/75">{log.area}</td>

                    <td className="max-w-md px-4 py-4">
                      <div className="break-all text-xs leading-5 text-white/65">
                        {log.route || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-1 text-xs font-black uppercase",
                          riskClassNames[log.risk_level] || riskClassNames.low,
                        ].join(" ")}
                      >
                        {log.risk_level}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-white/55">
                      {log.ip_address || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
