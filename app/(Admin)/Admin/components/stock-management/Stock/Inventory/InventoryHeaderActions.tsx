"use client";

import {
  ArrowRightLeft,
  FileSpreadsheet,
  FlaskConical,
  Loader2,
  RefreshCcw,
} from "lucide-react";

type InventoryHeaderActionsProps = {
  loading: boolean;
  creatingTestItem: boolean;
  exportingXlsx: boolean;
  hasExportRows: boolean;
  onMoveStock: () => void;
  onRefresh: () => void;
  onCreateTestItem: () => void;
  onExportXlsx: () => void;
};

export default function InventoryHeaderActions({
  loading,
  creatingTestItem,
  exportingXlsx,
  hasExportRows,
  onMoveStock,
  onRefresh,
  onCreateTestItem,
  onExportXlsx,
}: InventoryHeaderActionsProps) {
  const busy = loading || creatingTestItem || exportingXlsx;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onMoveStock}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
        title="Move a stock item to a different location"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Move stock
      </button>

      <button
        type="button"
        onClick={onCreateTestItem}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-2.5 text-sm font-black text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        title="Create a clearly marked test stock item"
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
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
        title="Reload the inventory"
      >
        <RefreshCcw
          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
        />
        {loading ? "Refreshing..." : "Refresh"}
      </button>

      <button
        type="button"
        onClick={onExportXlsx}
        disabled={!hasExportRows || busy}
        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200/30 bg-emerald-400 px-4 py-2.5 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        title="Download a styled Excel inventory report"
      >
        {exportingXlsx ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}

        {exportingXlsx ? "Creating Excel..." : "Export Excel"}
      </button>
    </div>
  );
}
