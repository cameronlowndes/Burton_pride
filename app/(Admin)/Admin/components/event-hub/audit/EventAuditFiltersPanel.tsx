"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Filter, RotateCcw, X } from "lucide-react";

import type { EventAuditAdminOption } from "./client-types";

export type FilterValues = {
  area: string;
  admin_id: string;
  action: string;
  status: string;
  risk: string;
  record_type: string;
  date_from: string;
  date_to: string;
  security_only: string;
  review_only: string;
};

export type EventAuditActionOption = {
  action: string;
  action_label: string;
};

export type EventAuditFiltersPanelProps = {
  open: boolean;
  values: FilterValues;
  areas: string[];
  admins: EventAuditAdminOption[];
  actions: EventAuditActionOption[];
  canViewSecurity: boolean;
  onClose: () => void;
  onApply: (values: FilterValues) => void;
};

export const EMPTY_FILTER_VALUES: FilterValues = {
  area: "",
  admin_id: "",
  action: "",
  status: "",
  risk: "",
  record_type: "",
  date_from: "",
  date_to: "",
  security_only: "",
  review_only: "",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 " +
  "text-sm font-semibold text-white outline-none transition " +
  "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black text-white/60">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatOptionLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function EventAuditFiltersPanel({
  open,
  values,
  areas,
  admins,
  actions,
  canViewSecurity,
  onClose,
  onApply,
}: EventAuditFiltersPanelProps) {
  const [draft, setDraft] = useState<FilterValues>(values);

  useEffect(() => {
    setDraft(values);
  }, [values, open]);

  if (!open) {
    return null;
  }

  function updateFilter<K extends keyof FilterValues>(
    key: K,
    value: FilterValues[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleReset() {
    setDraft({ ...EMPTY_FILTER_VALUES });
  }

  function handleApply() {
    onApply(draft);
  }

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-audit-filters-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close audit filters"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/10 bg-[#120d1d] text-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2
              id="event-audit-filters-title"
              className="flex items-center gap-2 text-xl font-black"
            >
              <Filter
                className="h-5 w-5 shrink-0 text-cyan-200"
                aria-hidden="true"
              />
              Filter audit activity
            </h2>

            <p className="mt-1 text-sm text-white/50">
              Filters stay in the URL so the view can be bookmarked.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/10 p-2.5 transition hover:bg-white/10"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Area">
              <select
                className={inputClass}
                value={draft.area}
                onChange={(event) =>
                  updateFilter("area", event.target.value)
                }
              >
                <option value="">All areas</option>

                {areas.map((area) => (
                  <option key={area} value={area}>
                    {formatOptionLabel(area)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Admin">
              <select
                className={inputClass}
                value={draft.admin_id}
                onChange={(event) =>
                  updateFilter("admin_id", event.target.value)
                }
              >
                <option value="">All admins</option>

                {admins.map((admin) => (
                  <option key={admin.value} value={admin.value}>
                    {admin.label || admin.email || "Admin"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Action">
              <select
                className={inputClass}
                value={draft.action}
                onChange={(event) =>
                  updateFilter("action", event.target.value)
                }
              >
                <option value="">All actions</option>

                {actions.map((action) => (
                  <option key={action.action} value={action.action}>
                    {action.action_label || formatOptionLabel(action.action)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Record type">
              <input
                type="text"
                className={inputClass}
                value={draft.record_type}
                onChange={(event) =>
                  updateFilter("record_type", event.target.value)
                }
                placeholder="Document, contact, event..."
              />
            </Field>

            <Field label="Status">
              <select
                className={inputClass}
                value={draft.status}
                onChange={(event) =>
                  updateFilter("status", event.target.value)
                }
              >
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="failed,partial_success">
                  Failed or partial success
                </option>
                <option value="blocked">Blocked</option>
                <option value="warning">Warning</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </Field>

            <Field label="Risk">
              <select
                className={inputClass}
                value={draft.risk}
                onChange={(event) =>
                  updateFilter("risk", event.target.value)
                }
              >
                <option value="">All risk levels</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
                <option value="high,critical">High and critical</option>
              </select>
            </Field>

            <Field label="Date from">
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.date_from}
                onChange={(event) =>
                  updateFilter("date_from", event.target.value)
                }
              />
            </Field>

            <Field label="Date to">
              <input
                type="datetime-local"
                className={inputClass}
                value={draft.date_to}
                onChange={(event) =>
                  updateFilter("date_to", event.target.value)
                }
              />
            </Field>
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            {canViewSecurity ? (
              <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-white/75">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-black/30 accent-cyan-300"
                  checked={draft.security_only === "true"}
                  onChange={(event) =>
                    updateFilter(
                      "security_only",
                      event.target.checked ? "true" : "",
                    )
                  }
                />
                <span>Security events only</span>
              </label>
            ) : null}

            <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-white/75">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-black/30 accent-cyan-300"
                checked={draft.review_only === "true"}
                onChange={(event) =>
                  updateFilter(
                    "review_only",
                    event.target.checked ? "true" : "",
                  )
                }
              />
              <span>Events requiring review only</span>
            </label>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-white/65 transition hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black transition hover:bg-white/10"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
            >
              Apply filters
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
