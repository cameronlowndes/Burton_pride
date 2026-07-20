"use client";

import {
  ArrowRightLeft,
  Download,
  FlaskConical,
  Loader2,
  RefreshCcw,
} from "lucide-react";

type InventoryHeaderActionsProps = {
  loading: boolean;
  creatingTestItem: boolean;
  hasExportRows: boolean;
  onMoveStock: () => void;
  onRefresh: () => void;
  onCreateTestItem: () => void;
  onExportCsv: () => void;
};

export default function InventoryHeaderActions({
  loading,
  creatingTestItem,
  hasExportRows,
  onMoveStock,
  onRefresh,
  onCreateTestItem,
  onExportCsv,
}: InventoryHeaderActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onMoveStock}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.14]"
        title="Move a stock item to a different location"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Move stock
      </button>

      <button
        type="button"
        onClick={onCreateTestItem}
        disabled={creatingTestItem}
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-2.5 text-sm font-black text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creatingTestItem ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FlaskConical className="h-4 w-4" />
        )}
        {creatingTestItem ? "Creating test item..." : "Create test item"}
      </button>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        Refresh
      </button>

      <button
        type="button"
        onClick={onExportCsv}
        disabled={!hasExportRows}
        className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-purple-700 shadow-lg transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </button>
    </div>
  );
}