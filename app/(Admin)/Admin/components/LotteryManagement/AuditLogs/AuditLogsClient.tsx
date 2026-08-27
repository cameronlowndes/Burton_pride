'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LotteryAuditLog, LotteryAuditResponse } from '@/lib/lottery/audit-types';

type Filters = {
  search: string;
  group: string;
  risk: string;
  from: string;
  to: string;
};

const groups = [
  'lottery', 'ticket', 'payment', 'prize', 'draw', 'winner', 'compliance', 'security', 'export'
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London'
  }).format(new Date(value));
}

function riskClasses(risk: string) {
  if (risk === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (risk === 'high') return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
  if (risk === 'medium') return 'border-amber-500/40 bg-amber-500/10 text-amber-100';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
}

function prettyJson(value: unknown) {
  if (!value) return 'No data recorded';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function AuditLogsClient() {
  const [filters, setFilters] = useState<Filters>({ search: '', group: '', risk: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<LotteryAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('created_at');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<LotteryAuditLog | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '25', sort, direction });
    Object.entries(applied).forEach(([k, v]) => v && p.set(k, v));
    return p;
  }, [applied, page, sort, direction]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/lotterymanagement/audit-logs?${params}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to load audit logs.');
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load audit logs.');
    } finally { setLoading(false); }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault(); setPage(1); setApplied(filters);
  };

  const clearFilters = () => {
    const empty = { search: '', group: '', risk: '', from: '', to: '' };
    setFilters(empty); setApplied(empty); setPage(1);
  };

  const changeSort = (field: string) => {
    if (sort === field) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else { setSort(field); setDirection('desc'); }
    setPage(1);
  };

  const exportCsv = () => {
    const p = new URLSearchParams();
    Object.entries(applied).forEach(([k, v]) => v && p.set(k, v));
    window.location.href = `/api/admin/lotterymanagement/audit-logs/export?${p}`;
  };

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 25));

  return (
    <main className="min-h-screen w-full bg-[#08070d] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-12 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-300">
              Lottery Management <span className="text-white/30">/</span> Audit Logs
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Audit Logs</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-white/60 sm:text-base">
              Immutable history of security-sensitive and outcome-changing lottery actions, including draws,
              ticket changes, payments, compliance changes, exports and denied access attempts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Refresh</button>
            <button onClick={exportCsv} className="rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold shadow-lg shadow-fuchsia-950/30 hover:bg-fuchsia-500">Export CSV</button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[
            ['Total records', data?.summary.total ?? 0],
            ['High / critical', data?.summary.highRisk ?? 0],
            ['Denied access', data?.summary.denied ?? 0],
            ['Exports', data?.summary.exports ?? 0],
            ['Draw activity', data?.summary.draws ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</div>
              <div className="mt-2 text-2xl font-bold">{value}</div>
            </div>
          ))}
        </section>

        <form onSubmit={applyFilters} className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,2fr)_1fr_1fr_1fr_1fr_auto]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">Search</span>
              <input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="Action, admin, lottery, entity ID..."
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none placeholder:text-white/25 focus:border-fuchsia-400/60 focus:ring-2 focus:ring-fuchsia-500/20" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">Action group</span>
              <select value={filters.group} onChange={e => setFilters(f => ({ ...f, group: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none focus:border-fuchsia-400/60">
                <option value="">All groups</option>{groups.map(g => <option key={g} value={g}>{g[0].toUpperCase()+g.slice(1)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-white/55">Risk</span>
              <select value={filters.risk} onChange={e => setFilters(f => ({ ...f, risk: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none focus:border-fuchsia-400/60">
                <option value="">All risk</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/55">From</span>
              <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/55">To</span>
              <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} className="h-11 w-full rounded-xl border border-white/10 bg-[#111019] px-3 text-sm outline-none" /></label>
            <div className="flex items-end gap-2"><button className="h-11 rounded-xl bg-white px-4 text-sm font-bold text-black hover:bg-white/90">Apply</button><button type="button" onClick={clearFilters} className="h-11 rounded-xl border border-white/10 px-3 text-sm hover:bg-white/5">Clear</button></div>
          </div>
        </form>

        {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] shadow-2xl shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-4 py-3"><button onClick={() => changeSort('created_at')}>Date / time ↕</button></th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3"><button onClick={() => changeSort('action_group')}>Group ↕</button></th>
                  <th className="px-4 py-3"><button onClick={() => changeSort('action_label')}>Action ↕</button></th>
                  <th className="px-4 py-3">Lottery / entity</th>
                  <th className="px-4 py-3"><button onClick={() => changeSort('risk_level')}>Risk ↕</button></th>
                  <th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-white/45">Loading audit history…</td></tr>
                ) : !data?.logs.length ? (
                  <tr><td colSpan={8} className="px-4 py-16 text-center"><div className="font-semibold">No audit records found</div><div className="mt-1 text-white/45">Try changing the filters.</div></td></tr>
                ) : data.logs.map(log => (
                  <tr key={log.id} className="align-top hover:bg-white/[0.025]">
                    <td className="whitespace-nowrap px-4 py-4 text-white/70">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-4"><div className="font-semibold">{log.admin_name || 'System / unknown'}</div><div className="mt-1 text-xs text-white/40">{log.admin_email || log.admin_id || 'No admin snapshot'}</div></td>
                    <td className="px-4 py-4"><span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold capitalize">{log.action_group}</span></td>
                    <td className="px-4 py-4"><div className="font-semibold">{log.action_label}</div><div className="mt-1 font-mono text-[11px] text-white/35">{log.action_code}</div></td>
                    <td className="px-4 py-4"><div className="font-medium">{log.lottery_title || '—'}</div><div className="mt-1 text-xs text-white/40">{log.entity_type ? `${log.entity_type}: ${log.entity_id || '—'}` : 'No entity recorded'}</div></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold uppercase ${riskClasses(log.risk_level)}`}>{log.risk_level}</span></td>
                    <td className="max-w-[260px] px-4 py-4 text-white/60"><div className="line-clamp-2">{log.reason || '—'}</div></td>
                    <td className="px-4 py-4 text-right"><button onClick={() => setSelected(log)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/10">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/45">Page {page} of {totalPages} · {data?.total ?? 0} records</div>
            <div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1,p-1))} className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-30">Previous</button><button disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages,p+1))} className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-30">Next</button></div>
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Audit log details">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0d0c13] shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-[#0d0c13]/95 p-5 backdrop-blur">
              <div><div className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">Immutable audit record</div><h2 className="mt-1 text-xl font-bold">{selected.action_label}</h2><div className="mt-1 font-mono text-xs text-white/35">{selected.id}</div></div>
              <button onClick={() => setSelected(null)} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">Close</button>
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <Info title="Recorded"><p>{formatDate(selected.created_at)}</p><p className="mt-1 text-white/45">Risk: <span className="font-semibold uppercase">{selected.risk_level}</span></p></Info>
              <Info title="Administrator"><p>{selected.admin_name || 'System / unknown'}</p><p className="mt-1 text-white/45">{selected.admin_email || selected.admin_id || 'No snapshot'}</p></Info>
              <Info title="Action"><p className="font-semibold">{selected.action_group}</p><p className="mt-1 font-mono text-xs text-white/45">{selected.action_code}</p></Info>
              <Info title="Affected record"><p>{selected.lottery_title || 'No lottery title snapshot'}</p><p className="mt-1 text-white/45">{selected.entity_type || 'entity'} · {selected.entity_id || '—'}</p></Info>
              <Info title="Reason" wide><p className="whitespace-pre-wrap">{selected.reason || 'No reason recorded.'}</p></Info>
              <Info title="Request context"><p className="break-all">IP: {selected.ip_address || 'Not recorded'}</p><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-white/55">{prettyJson(selected.device_context)}</pre></Info>
              <Info title="Metadata"><pre className="overflow-x-auto whitespace-pre-wrap text-xs text-white/55">{prettyJson(selected.metadata)}</pre></Info>
              <Info title="Before" wide><pre className="max-h-80 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/65">{prettyJson(selected.before_data)}</pre></Info>
              <Info title="After" wide><pre className="max-h-80 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-white/65">{prettyJson(selected.after_data)}</pre></Info>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Info({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return <section className={`rounded-2xl border border-white/10 bg-white/[0.025] p-4 ${wide ? 'lg:col-span-2' : ''}`}><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">{title}</h3>{children}</section>;
}
