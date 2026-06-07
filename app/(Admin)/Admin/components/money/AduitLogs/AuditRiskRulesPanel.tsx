"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import type {
  AuditRiskLevel,
  AuditRiskMatchType,
  MoneyAuditRiskRule,
} from "@/lib/money/audit_logs/audit-log-types";

const riskLevels: AuditRiskLevel[] = ["High", "Medium", "Low"];

const matchTypes: { value: AuditRiskMatchType; label: string }[] = [
  { value: "action", label: "Action" },
  { value: "area", label: "Area" },
  { value: "source", label: "Source" },
  { value: "route", label: "API route" },
  { value: "title", label: "Record title" },
  { value: "metadata", label: "Metadata" },
];

type RuleForm = {
  label: string;
  risk_level: AuditRiskLevel;
  match_type: AuditRiskMatchType;
  match_value: string;
  priority: number;
  is_active: boolean;
};

const emptyForm: RuleForm = {
  label: "",
  risk_level: "High",
  match_type: "action",
  match_value: "",
  priority: 100,
  is_active: true,
};

function riskClass(level: AuditRiskLevel) {
  if (level === "High") return "bg-red-500/15 text-red-100 ring-red-300/20";
  if (level === "Medium") return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
}

export default function AuditRiskRulesPanel() {
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [rules, setRules] = useState<MoneyAuditRiskRule[]>([]);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [editingRule, setEditingRule] = useState<MoneyAuditRiskRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      const priorityA = Number(a.priority || 100);
      const priorityB = Number(b.priority || 100);

      if (priorityA !== priorityB) return priorityA - priorityB;

      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }, [rules]);

  async function loadRules() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/admin/money/audit-risk-rules", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load risk rules.");
      }

      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load risk rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  function startEdit(rule: MoneyAuditRiskRule) {
    setShowRulesPanel(true);
    setEditingRule(rule);
    setSaved(false);
    setError("");

    setForm({
      label: rule.label || "",
      risk_level: rule.risk_level || "High",
      match_type: rule.match_type || "action",
      match_value: rule.match_value || "",
      priority: Number(rule.priority || 100),
      is_active: rule.is_active !== false,
    });
  }

  function resetForm() {
    setEditingRule(null);
    setForm(emptyForm);
    setSaved(false);
    setError("");
  }

  async function saveRule() {
    try {
      setSaving(true);
      setError("");
      setSaved(false);

      const url = editingRule
        ? `/api/admin/money/audit-risk-rules/${editingRule.id}`
        : "/api/admin/money/audit-risk-rules";

      const res = await fetch(url, {
        method: editingRule ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save risk rule.");
      }

      if (editingRule) {
        setRules((current) =>
          current.map((rule) => (rule.id === data.rule.id ? data.rule : rule)),
        );
      } else {
        setRules((current) => [data.rule, ...current]);
      }

      resetForm();
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2200);
    } catch (err: any) {
      setError(err?.message || "Failed to save risk rule.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: MoneyAuditRiskRule) {
    try {
      setError("");

      const res = await fetch(`/api/admin/money/audit-risk-rules/${rule.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...rule,
          is_active: !rule.is_active,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update risk rule.");
      }

      setRules((current) =>
        current.map((item) => (item.id === data.rule.id ? data.rule : item)),
      );
    } catch (err: any) {
      setError(err?.message || "Failed to update risk rule.");
    }
  }

  async function deleteRule(rule: MoneyAuditRiskRule) {
    const ok = window.confirm(
      `Delete this risk rule?\n\n${rule.label}\n\nThis cannot be undone.`,
    );

    if (!ok) return;

    try {
      setError("");

      const res = await fetch(`/api/admin/money/audit-risk-rules/${rule.id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete risk rule.");
      }

      setRules((current) => current.filter((item) => item.id !== rule.id));

      if (editingRule?.id === rule.id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete risk rule.");
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-red-100 ring-1 ring-red-300/20">
            <ShieldAlert className="h-4 w-4" />
            Risk Rules
          </div>

          <h2 className="mt-3 text-xl font-black text-white">
            Custom audit risk rules
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Add your own rules to decide what shows as High, Medium, or Low risk.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRulesPanel((value) => !value)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/15 px-4 py-3 text-sm font-black text-purple-100 ring-1 ring-purple-300/20 hover:bg-purple-500/25"
        >
          {showRulesPanel ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide risk rule settings
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show risk rule settings
            </>
          )}
        </button>
      </div>

      {!showRulesPanel && (
        <div className="mt-4 rounded-2xl bg-black/20 px-4 py-3 text-sm text-white/60">
          {loading
            ? "Loading risk rules..."
            : `${rules.length} custom risk rule${rules.length === 1 ? "" : "s"} saved.`}
        </div>
      )}

      {showRulesPanel && (
        <>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={loadRules}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh rules
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          )}

          {saved && (
            <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Risk rule saved.
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-white">
                  {editingRule ? "Edit risk rule" : "Add risk rule"}
                </h3>

                {editingRule && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Rule name
                  </span>
                  <input
                    value={form.label}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        label: e.target.value,
                      }))
                    }
                    placeholder="Example: Permanent refund delete"
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-purple-300/40"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Risk level
                  </span>
                  <select
                    value={form.risk_level}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        risk_level: e.target.value as AuditRiskLevel,
                      }))
                    }
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                  >
                    {riskLevels.map((level) => (
                      <option key={level} value={level} className="bg-[#11111f]">
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Match against
                  </span>
                  <select
                    value={form.match_type}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        match_type: e.target.value as AuditRiskMatchType,
                      }))
                    }
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                  >
                    {matchTypes.map((type) => (
                      <option
                        key={type.value}
                        value={type.value}
                        className="bg-[#11111f]"
                      >
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Match value
                  </span>
                  <input
                    value={form.match_value}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        match_value: e.target.value,
                      }))
                    }
                    placeholder="Example: delete_all, refund, stripe"
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-purple-300/40"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Priority
                  </span>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        priority: Number(e.target.value || 100),
                      }))
                    }
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-purple-300/40"
                  />
                  <span className="mt-1 block text-xs text-white/40">
                    Lower number runs first. Example: 1 is checked before 100.
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm font-bold text-white">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        is_active: e.target.checked,
                      }))
                    }
                    className="h-4 w-4"
                  />
                  Rule active
                </label>

                <button
                  type="button"
                  onClick={saveRule}
                  disabled={saving || !form.label.trim() || !form.match_value.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingRule ? (
                    <Save className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}

                  {editingRule ? "Save changes" : "Add risk rule"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <h3 className="mb-4 text-base font-black text-white">
                Current rules
              </h3>

              {loading ? (
                <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-4 text-sm font-bold text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading risk rules...
                </div>
              ) : sortedRules.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-white/60">
                  No custom risk rules yet. Add one using the form.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
                        <th className="px-3 py-3">Priority</th>
                        <th className="px-3 py-3">Name</th>
                        <th className="px-3 py-3">Risk</th>
                        <th className="px-3 py-3">Match</th>
                        <th className="px-3 py-3">Value</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sortedRules.map((rule) => (
                        <tr
                          key={rule.id}
                          className="border-b border-white/10 text-white/80"
                        >
                          <td className="px-3 py-4 font-bold">
                            {rule.priority}
                          </td>

                          <td className="px-3 py-4 font-bold text-white">
                            {rule.label}
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${riskClass(
                                rule.risk_level,
                              )}`}
                            >
                              {rule.risk_level}
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            {matchTypes.find(
                              (item) => item.value === rule.match_type,
                            )?.label || rule.match_type}
                          </td>

                          <td className="px-3 py-4 font-mono text-xs text-white/70">
                            {rule.match_value}
                          </td>

                          <td className="px-3 py-4">
                            <button
                              type="button"
                              onClick={() => toggleRule(rule)}
                              className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                                rule.is_active
                                  ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                                  : "bg-white/10 text-white/50 ring-white/10"
                              }`}
                            >
                              {rule.is_active ? "Active" : "Off"}
                            </button>
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(rule)}
                                className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25"
                              >
                                <Edit3 className="h-4 w-4" />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteRule(rule)}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}