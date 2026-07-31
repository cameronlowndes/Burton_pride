"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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

type RuleForm = {
  label: string;
  risk_level: AuditRiskLevel;
  match_type: AuditRiskMatchType;
  match_value: string;
  priority: number;
  is_active: boolean;
};

type ApiResponse = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  message?: string;
  rule?: MoneyAuditRiskRule;
  rules?: MoneyAuditRiskRule[];
  details?: unknown;
};

type RowAction =
  | { type: "toggle"; id: string }
  | { type: "delete"; id: string }
  | null;

const RISK_LEVELS: AuditRiskLevel[] = ["High", "Medium", "Low"];

const MATCH_TYPES: { value: AuditRiskMatchType; label: string }[] = [
  { value: "action", label: "Action" },
  { value: "area", label: "Area" },
  { value: "source", label: "Source" },
  { value: "route", label: "API route" },
  { value: "title", label: "Record title" },
  { value: "metadata", label: "Metadata" },
];

const EMPTY_FORM: RuleForm = {
  label: "",
  risk_level: "High",
  match_type: "action",
  match_value: "",
  priority: 100,
  is_active: true,
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safePriority(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return Math.min(999999, Math.max(0, Math.floor(parsed)));
}

function isRiskLevel(value: unknown): value is AuditRiskLevel {
  return RISK_LEVELS.includes(value as AuditRiskLevel);
}

function isMatchType(value: unknown): value is AuditRiskMatchType {
  return MATCH_TYPES.some((item) => item.value === value);
}

function riskClass(level: AuditRiskLevel): string {
  if (level === "High") {
    return "bg-red-500/15 text-red-100 ring-red-300/20";
  }

  if (level === "Medium") {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
}

function normaliseRule(value: unknown): MoneyAuditRiskRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const rule = value as Partial<MoneyAuditRiskRule>;
  const id = cleanText(rule.id);
  const label = cleanText(rule.label);
  const matchValue = cleanText(rule.match_value);

  if (!id || !label || !matchValue) {
    return null;
  }

  return {
    ...rule,
    id,
    label,
    risk_level: isRiskLevel(rule.risk_level)
      ? rule.risk_level
      : "High",
    match_type: isMatchType(rule.match_type)
      ? rule.match_type
      : "action",
    match_value: matchValue,
    priority: safePriority(rule.priority),
    is_active: rule.is_active !== false,
  } as MoneyAuditRiskRule;
}

function normaliseRules(value: unknown): MoneyAuditRiskRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map(normaliseRule)
    .filter((rule): rule is MoneyAuditRiskRule => Boolean(rule))
    .filter((rule) => {
      if (seen.has(rule.id)) {
        return false;
      }

      seen.add(rule.id);
      return true;
    });
}

async function readJsonResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Response was not a JSON object.");
    }

    return parsed as ApiResponse;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Invalid JSON response.";

    throw new Error(
      [
        "The audit risk rules API returned an invalid response.",
        `HTTP status: ${response.status}`,
        `Reason: ${reason}`,
        `Raw response: ${text.slice(0, 2000)}`,
      ].join("\n\n"),
    );
  }
}

function apiErrorMessage(
  response: Response,
  data: ApiResponse,
  fallback: string,
): string {
  const details = data.details
    ? (() => {
        try {
          return JSON.stringify(data.details, null, 2);
        } catch {
          return String(data.details);
        }
      })()
    : "";

  return [
    cleanText(data.error) || cleanText(data.message) || fallback,
    details ? `Details:\n${details}` : "",
    `HTTP status: ${response.status}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
        <pre className="min-w-0 whitespace-pre-wrap break-words font-sans leading-6">
          {message}
        </pre>
      </div>
    </div>
  );
}

function SavedMessage({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100"
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Risk rule saved.
      </div>
    </div>
  );
}

export default function AuditRiskRulesPanel() {
  const panelId = useId();
  const savedTimerRef = useRef<number | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const saveSubmitRef = useRef(false);

  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [rules, setRules] = useState<MoneyAuditRiskRule[]>([]);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [editingRule, setEditingRule] =
    useState<MoneyAuditRiskRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowAction, setRowAction] = useState<RowAction>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      const priorityDifference =
        safePriority(a.priority) - safePriority(b.priority);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return cleanText(a.label).localeCompare(cleanText(b.label));
    });
  }, [rules]);

  const formIsValid =
    cleanText(form.label).length > 0 &&
    cleanText(form.match_value).length > 0 &&
    isRiskLevel(form.risk_level) &&
    isMatchType(form.match_type) &&
    Number.isFinite(form.priority);

  const busy = saving || loading || rowAction !== null;

  const loadRules = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/money/audit-risk-rules",
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await readJsonResponse(response);

      if (
        !response.ok ||
        (data.ok !== true && data.success !== true)
      ) {
        throw new Error(
          apiErrorMessage(
            response,
            data,
            "Failed to load risk rules.",
          ),
        );
      }

      setRules(normaliseRules(data.rules));
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load risk rules.",
      );
    } finally {
      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadRules();

    return () => {
      loadAbortRef.current?.abort();

      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, [loadRules]);

  function startEdit(rule: MoneyAuditRiskRule) {
    const normalised = normaliseRule(rule);

    if (!normalised) {
      setError("This risk rule is missing required data and cannot be edited.");
      return;
    }

    setShowRulesPanel(true);
    setEditingRule(normalised);
    setSaved(false);
    setError("");

    setForm({
      label: cleanText(normalised.label),
      risk_level: normalised.risk_level,
      match_type: normalised.match_type,
      match_value: cleanText(normalised.match_value),
      priority: safePriority(normalised.priority),
      is_active: normalised.is_active !== false,
    });
  }

  function resetForm(options?: { keepMessages?: boolean }) {
    setEditingRule(null);
    setForm(EMPTY_FORM);

    if (!options?.keepMessages) {
      setSaved(false);
      setError("");
    }
  }

  function showSavedMessage() {
    setSaved(true);

    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
    }

    savedTimerRef.current = window.setTimeout(() => {
      setSaved(false);
      savedTimerRef.current = null;
    }, 2200);
  }

  async function saveRule() {
    if (saving || saveSubmitRef.current) {
      return;
    }

    const payload: RuleForm = {
      label: cleanText(form.label),
      risk_level: isRiskLevel(form.risk_level)
        ? form.risk_level
        : "High",
      match_type: isMatchType(form.match_type)
        ? form.match_type
        : "action",
      match_value: cleanText(form.match_value),
      priority: safePriority(form.priority),
      is_active: Boolean(form.is_active),
    };

    if (!payload.label) {
      setError("Enter a rule name before saving.");
      return;
    }

    if (!payload.match_value) {
      setError("Enter a match value before saving.");
      return;
    }

    const editingId = cleanText(editingRule?.id);

    if (editingRule && !editingId) {
      setError("The selected rule has no ID and cannot be updated.");
      return;
    }

    saveSubmitRef.current = true;

    try {
      setSaving(true);
      setError("");
      setSaved(false);

      const url = editingRule
        ? `/api/admin/money/audit-risk-rules/${encodeURIComponent(
            editingId,
          )}`
        : "/api/admin/money/audit-risk-rules";

      const response = await fetch(url, {
        method: editingRule ? "PATCH" : "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse(response);

      if (
        !response.ok ||
        (data.ok !== true && data.success !== true)
      ) {
        throw new Error(
          apiErrorMessage(
            response,
            data,
            "Failed to save risk rule.",
          ),
        );
      }

      const savedRule = normaliseRule(data.rule);

      if (!savedRule) {
        throw new Error(
          "The API reported success but did not return a valid risk rule.",
        );
      }

      setRules((current) => {
        if (editingRule) {
          const exists = current.some(
            (rule) => rule.id === savedRule.id,
          );

          return exists
            ? current.map((rule) =>
                rule.id === savedRule.id ? savedRule : rule,
              )
            : [savedRule, ...current];
        }

        return [
          savedRule,
          ...current.filter((rule) => rule.id !== savedRule.id),
        ];
      });

      resetForm({ keepMessages: true });
      showSavedMessage();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save risk rule.",
      );
    } finally {
      saveSubmitRef.current = false;
      setSaving(false);
    }
  }

  async function toggleRule(rule: MoneyAuditRiskRule) {
    const id = cleanText(rule.id);

    if (!id || rowAction) {
      return;
    }

    const originalActive = rule.is_active !== false;
    const nextActive = !originalActive;

    setError("");
    setRowAction({ type: "toggle", id });

    setRules((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, is_active: nextActive }
          : item,
      ),
    );

    try {
      const response = await fetch(
        `/api/admin/money/audit-risk-rules/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            label: cleanText(rule.label),
            risk_level: isRiskLevel(rule.risk_level)
              ? rule.risk_level
              : "High",
            match_type: isMatchType(rule.match_type)
              ? rule.match_type
              : "action",
            match_value: cleanText(rule.match_value),
            priority: safePriority(rule.priority),
            is_active: nextActive,
          }),
        },
      );

      const data = await readJsonResponse(response);

      if (
        !response.ok ||
        (data.ok !== true && data.success !== true)
      ) {
        throw new Error(
          apiErrorMessage(
            response,
            data,
            "Failed to update risk rule.",
          ),
        );
      }

      const updatedRule = normaliseRule(data.rule);

      if (!updatedRule) {
        throw new Error(
          "The API reported success but did not return a valid updated rule.",
        );
      }

      setRules((current) =>
        current.map((item) =>
          item.id === updatedRule.id ? updatedRule : item,
        ),
      );
    } catch (err) {
      setRules((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, is_active: originalActive }
            : item,
        ),
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update risk rule.",
      );
    } finally {
      setRowAction(null);
    }
  }

  async function deleteRule(rule: MoneyAuditRiskRule) {
    const id = cleanText(rule.id);

    if (!id || rowAction) {
      return;
    }

    const confirmed = window.confirm(
      `Delete this risk rule?\n\n${cleanText(rule.label) || "Unnamed rule"}\n\nThis cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setRowAction({ type: "delete", id });

    try {
      const response = await fetch(
        `/api/admin/money/audit-risk-rules/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await readJsonResponse(response);

      if (
        !response.ok ||
        (data.ok !== true && data.success !== true)
      ) {
        throw new Error(
          apiErrorMessage(
            response,
            data,
            "Failed to delete risk rule.",
          ),
        );
      }

      setRules((current) =>
        current.filter((item) => item.id !== id),
      );

      if (editingRule?.id === id) {
        resetForm();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete risk rule.",
      );
    } finally {
      setRowAction(null);
    }
  }

  return (
    <section
      aria-labelledby="audit-risk-rules-title"
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-red-100 ring-1 ring-red-300/20">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Risk Rules
          </div>

          <h2
            id="audit-risk-rules-title"
            className="mt-3 break-words text-xl font-black text-white"
          >
            Custom audit risk rules
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Add your own rules to decide what shows as High, Medium, or Low
            risk.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRulesPanel((value) => !value)}
          aria-expanded={showRulesPanel}
          aria-controls={panelId}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500/15 px-4 py-3 text-sm font-black text-purple-100 ring-1 ring-purple-300/20 hover:bg-purple-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
        >
          {showRulesPanel ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
              Hide risk rule settings
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              Show risk rule settings
            </>
          )}
        </button>
      </div>

      {!showRulesPanel ? (
        <div
          role={loading ? "status" : undefined}
          aria-live={loading ? "polite" : undefined}
          className="mt-4 rounded-2xl bg-black/20 px-4 py-3 text-sm text-white/60"
        >
          {loading
            ? "Loading risk rules..."
            : `${rules.length} custom risk rule${
                rules.length === 1 ? "" : "s"
              } saved.`}
        </div>
      ) : null}

      {showRulesPanel ? (
        <div id={panelId}>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => void loadRules()}
              disabled={busy}
              aria-busy={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              )}
              Refresh rules
            </button>
          </div>

          <ErrorMessage message={error} />
          <SavedMessage visible={saved} />

          <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-white">
                  {editingRule ? "Edit risk rule" : "Add risk rule"}
                </h3>

                {editingRule ? (
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancel
                  </button>
                ) : null}
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Rule name
                  </span>
                  <input
                    value={form.label}
                    onChange={(event) => {
                      setError("");
                      setSaved(false);
                      setForm((current) => ({
                        ...current,
                        label: event.target.value,
                      }));
                    }}
                    placeholder="Example: Permanent refund delete"
                    disabled={busy}
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-purple-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Risk level
                  </span>
                  <select
                    value={form.risk_level}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        risk_level: isRiskLevel(event.target.value)
                          ? event.target.value
                          : "High",
                      }))
                    }
                    disabled={busy}
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-purple-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {RISK_LEVELS.map((level) => (
                      <option
                        key={level}
                        value={level}
                        className="bg-[#11111f]"
                      >
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
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        match_type: isMatchType(event.target.value)
                          ? event.target.value
                          : "action",
                      }))
                    }
                    disabled={busy}
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-purple-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {MATCH_TYPES.map((type) => (
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
                    onChange={(event) => {
                      setError("");
                      setSaved(false);
                      setForm((current) => ({
                        ...current,
                        match_value: event.target.value,
                      }));
                    }}
                    placeholder="Example: delete_all, refund, stripe"
                    disabled={busy}
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-purple-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-white/60">
                    Priority
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={999999}
                    step={1}
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: safePriority(event.target.value),
                      }))
                    }
                    disabled={busy}
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-purple-300/40 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="mt-1 block text-xs text-white/40">
                    Lower number runs first. Example: 1 is checked before 100.
                  </span>
                </label>

                <label className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm font-bold text-white">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                    disabled={busy}
                    className="h-4 w-4 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  Rule active
                </label>

                <button
                  type="button"
                  onClick={() => void saveRule()}
                  disabled={busy || !formIsValid}
                  aria-busy={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white hover:bg-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : editingRule ? (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
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
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-4 text-sm font-bold text-white/70"
                >
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading risk rules...
                </div>
              ) : sortedRules.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.04] p-4 text-sm text-white/60">
                  No custom risk rules yet. Add one using the form.
                </div>
              ) : (
                <div
                  className="overflow-x-auto"
                  role="region"
                  aria-label="Current audit risk rules"
                  tabIndex={0}
                >
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
                        <th scope="col" className="px-3 py-3">
                          Priority
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Name
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Risk
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Match
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Value
                        </th>
                        <th scope="col" className="px-3 py-3">
                          Status
                        </th>
                        <th scope="col" className="px-3 py-3 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {sortedRules.map((rule) => {
                        const id = cleanText(rule.id);
                        const toggling =
                          rowAction?.type === "toggle" &&
                          rowAction.id === id;
                        const deleting =
                          rowAction?.type === "delete" &&
                          rowAction.id === id;

                        return (
                          <tr
                            key={id}
                            className="border-b border-white/10 text-white/80"
                          >
                            <td className="px-3 py-4 font-bold">
                              {safePriority(rule.priority)}
                            </td>

                            <td className="max-w-[240px] break-words px-3 py-4 font-bold text-white">
                              {cleanText(rule.label)}
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
                              {MATCH_TYPES.find(
                                (item) =>
                                  item.value === rule.match_type,
                              )?.label || rule.match_type}
                            </td>

                            <td className="max-w-[280px] break-all px-3 py-4 font-mono text-xs text-white/70">
                              {cleanText(rule.match_value)}
                            </td>

                            <td className="px-3 py-4">
                              <button
                                type="button"
                                onClick={() => void toggleRule(rule)}
                                disabled={busy}
                                aria-pressed={rule.is_active !== false}
                                aria-busy={toggling}
                                className={`rounded-full px-3 py-1 text-xs font-black ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50 ${
                                  rule.is_active !== false
                                    ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                                    : "bg-white/10 text-white/50 ring-white/10"
                                }`}
                              >
                                {toggling
                                  ? "Updating..."
                                  : rule.is_active !== false
                                    ? "Active"
                                    : "Off"}
                              </button>
                            </td>

                            <td className="px-3 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(rule)}
                                  disabled={busy}
                                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-100 ring-1 ring-sky-300/20 hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Edit3
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void deleteRule(rule)}
                                  disabled={busy}
                                  aria-busy={deleting}
                                  className="inline-flex items-center gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-100 ring-1 ring-red-300/20 hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {deleting ? (
                                    <Loader2
                                      className="h-4 w-4 animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Trash2
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                  )}
                                  {deleting ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
