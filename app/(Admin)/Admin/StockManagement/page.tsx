"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { useStockManagement } from "../components/stock-management/StockManagementProvider";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Package,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  RefreshCcw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  User,
  Warehouse,
} from "lucide-react";

const ROUTES = {
  dashboard: "/Admin/StockManagement",
  allStock: "/Admin/StockManagement/AllStock",
  addStock: "/Admin/StockManagement/AddStock",
  stockMovements: "/Admin/StockManagement/StockMovements",
  lowStock: "/Admin/StockManagement/LowStock",
  suppliers: "/Admin/StockManagement/Suppliers",
  purchaseOrders: "/Admin/StockManagement/PurchaseOrders",
  categories: "/Admin/StockManagement/Categories",
  reports: "/Admin/StockManagement/Reports",
  auditLog: "/Admin/StockManagement/AuditLog",
  settings: "/Admin/StockManagement/Settings",
  adminUsers: "/Admin/Dashboard/Settings/Users",
  logout: "/Admin/Login?loggedOut=1&t=1784394346848",
  login: "/Admin/Login",
} as const;

type AlertItem = {
  type: "danger" | "warning" | "info" | "success";
  title: string;
  message: string;
  href?: string;
  action?: string;
};

type DashboardCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  cta: string;
  badge?: string;
  primary?: boolean;
};

type StockSummary = {
  totalItems: number;
  totalUnits: number;
  lowStockItems: number;
  outOfStockItems: number;
  pendingOrders: number;
  stockValue: number;
};

type RecentStockItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  category: string;
};

const stockSummary: StockSummary = {
  totalItems: 0,
  totalUnits: 0,
  lowStockItems: 0,
  outOfStockItems: 0,
  pendingOrders: 0,
  stockValue: 0,
};

const recentStockItems: RecentStockItem[] = [];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function getStockAlerts(summary: StockSummary): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (summary.outOfStockItems > 0) {
    alerts.push({
      type: "danger",
      title: "Items are out of stock",
      message: `${summary.outOfStockItems} stock item${
        summary.outOfStockItems === 1 ? "" : "s"
      } currently have no available units.`,
      href: ROUTES.lowStock,
      action: "Review out-of-stock items",
    });
  }

  if (summary.lowStockItems > 0) {
    alerts.push({
      type: "warning",
      title: "Low stock needs attention",
      message: `${summary.lowStockItems} item${
        summary.lowStockItems === 1 ? " is" : "s are"
      } at or below the reorder level.`,
      href: ROUTES.lowStock,
      action: "Review low stock",
    });
  }

  if (summary.pendingOrders > 0) {
    alerts.push({
      type: "info",
      title: "Purchase orders are pending",
      message: `${summary.pendingOrders} purchase order${
        summary.pendingOrders === 1 ? " is" : "s are"
      } waiting to be completed or received.`,
      href: ROUTES.purchaseOrders,
      action: "Open purchase orders",
    });
  }

  if (summary.totalItems === 0) {
    alerts.push({
      type: "warning",
      title: "No stock items added yet",
      message:
        "Add your first stock item so Burton Pride can begin tracking quantities, reorder levels and stock movements.",
      href: ROUTES.addStock,
      action: "Add first stock item",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      type: "success",
      title: "Stock levels look healthy",
      message:
        "There are currently no low-stock or out-of-stock warnings requiring attention.",
      href: ROUTES.allStock,
      action: "View all stock",
    });
  }

  return alerts;
}

function getCards(): DashboardCard[] {
  return [
    {
      title: "All Stock",
      description:
        "View every stock item, current quantity, SKU, category, location and reorder level.",
      href: ROUTES.allStock,
      icon: Boxes,
      cta: "View all stock",
      badge: "Inventory",
      primary: true,
    },
    {
      title: "Add Stock Item",
      description:
        "Create a new stock item with supplier, cost, sale value, quantity and reorder details.",
      href: ROUTES.addStock,
      icon: PackagePlus,
      cta: "Add stock",
      badge: "New item",
    },
    {
      title: "Stock Movements",
      description:
        "Record stock coming in, stock going out, adjustments, damage, loss and internal transfers.",
      href: ROUTES.stockMovements,
      icon: RefreshCcw,
      cta: "Record movement",
      badge: "Tracking",
    },
    {
      title: "Low Stock Alerts",
      description:
        "See items that are running low, out of stock or ready to be reordered.",
      href: ROUTES.lowStock,
      icon: AlertTriangle,
      cta: "Check alerts",
      badge: "Attention",
    },
    {
      title: "Suppliers",
      description:
        "Manage supplier contact details, order information and the products each supplier provides.",
      href: ROUTES.suppliers,
      icon: Truck,
      cta: "Manage suppliers",
      badge: "Suppliers",
    },
    {
      title: "Purchase Orders",
      description:
        "Create and track orders from draft through approval, dispatch and delivery.",
      href: ROUTES.purchaseOrders,
      icon: ShoppingCart,
      cta: "Open orders",
      badge: "Ordering",
    },
    {
      title: "Categories",
      description:
        "Organise stock into categories such as merchandise, equipment, event supplies and office items.",
      href: ROUTES.categories,
      icon: Tags,
      cta: "Manage categories",
      badge: "Organisation",
    },
    {
      title: "Reports & Exports",
      description:
        "Export stock lists, low-stock reports, movement history, valuation and supplier records.",
      href: ROUTES.reports,
      icon: FileSpreadsheet,
      cta: "Open reports",
      badge: "Reports",
    },
    {
      title: "Audit Log",
      description:
        "Review who created, changed, received, removed or adjusted each stock record.",
      href: ROUTES.auditLog,
      icon: History,
      cta: "View audit log",
      badge: "Security",
    },
    {
      title: "Settings",
      description:
        "Configure stock locations, default reorder levels, permissions and Stock Control options.",
      href: ROUTES.settings,
      icon: Settings,
      cta: "Open settings",
      badge: "Configuration",
    },
  ];
}

export default function StockControlHomePage() {
  const { admin, loadingAdmin } = useStockManagement();
  const alerts = getStockAlerts(stockSummary);
  const cards = getCards();

  const welcomeName =
    !loadingAdmin && admin?.name ? `, ${admin.name.split(" ")[0]}` : "";

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.20),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.16),_transparent_32%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#020617_100%)] px-2 py-4 text-white sm:px-3 sm:py-6 lg:px-4 lg:py-8 xl:px-5">
      <div className="w-full">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-blue-200">
                <LayoutDashboard className="h-4 w-4" />
                Burton Pride Stock Control
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Welcome to Stock Control{welcomeName}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">
                Track Burton Pride stock, equipment, merchandise and event
                supplies in one secure place. Monitor quantities, receive
                deliveries, record stock movements and know when items need to
                be reordered.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={ROUTES.addStock}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-blue-950/30 transition hover:bg-blue-300"
              >
                Add stock item
                <PackagePlus className="h-4 w-4" />
              </Link>

              <Link
                href={ROUTES.logout}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </Link>
            </div>
          </div>
        </header>

        <div className="grid w-full gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <section className="grid gap-6">
            <AdminPanel />

            <StockSummaryPanel summary={stockSummary} />

            <AlertsPanel alerts={alerts} />

            <QuickAccessGrid cards={cards} />
          </section>

          <aside className="grid content-start gap-6">
            <RecentStockPanel items={recentStockItems} />

            <HelpfulLinksPanel />

            <SecurityPanel />
          </aside>
        </div>
      </div>
    </main>
  );
}

function AdminPanel() {
  const { admin, loadingAdmin, adminError, refreshAdmin } =
    useStockManagement();

  const roleLabel = admin?.role
    ? admin.role.replaceAll("_", " ")
    : "Administrator";

  return (
    <section className="rounded-[2rem] border border-blue-300/20 bg-blue-500/10 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-blue-500/15 text-blue-100 ring-1 ring-blue-300/20">
            {loadingAdmin ? (
              <LoaderCircle className="h-7 w-7 animate-spin" />
            ) : (
              <User className="h-7 w-7" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Stock Control access
            </p>

            <p className="mt-1 truncate text-base font-black text-white">
              {loadingAdmin
                ? "Loading administrator..."
                : admin?.name || "Administrator not identified"}
            </p>

            {!loadingAdmin && admin?.email ? (
              <p className="mt-1 truncate text-sm text-blue-100/65">
                {admin.email}
              </p>
            ) : null}

            {adminError ? (
              <div className="mt-3 rounded-2xl border border-red-300/20 bg-red-500/10 p-3">
                <p className="text-sm font-bold text-red-100">{adminError}</p>

                <button
                  type="button"
                  onClick={() => void refreshAdmin()}
                  className="mt-2 inline-flex items-center gap-2 text-xs font-black text-red-100 underline decoration-red-200/40 underline-offset-4"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Try loading the admin again
                </button>
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill
                type={adminError ? "danger" : "success"}
                icon={ShieldCheck}
                label={
                  adminError
                    ? "Admin session unavailable"
                    : "Secure admin session"
                }
              />

              <StatusPill
                type="info"
                icon={CheckCircle2}
                label="Stock tools enabled"
              />

              {!loadingAdmin && admin ? (
                <StatusPill
                  type="info"
                  icon={User}
                  label={roleLabel}
                />
              ) : null}
            </div>
          </div>
        </div>

        {admin?.isMainAdmin ? (
          <Link
            href={ROUTES.adminUsers}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
          >
            Manage admins
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function StockSummaryPanel({ summary }: { summary: StockSummary }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
            Inventory overview
          </p>

          <h2 className="mt-1 text-2xl font-black">Current stock summary</h2>
        </div>

        <Link
          href={ROUTES.allStock}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20"
        >
          View inventory
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Stock items"
          value={String(summary.totalItems)}
          icon={Boxes}
          tone="blue"
        />

        <SummaryCard
          label="Total units"
          value={String(summary.totalUnits)}
          icon={Package}
          tone="purple"
        />

        <SummaryCard
          label="Low stock"
          value={String(summary.lowStockItems)}
          icon={PackageMinus}
          tone="amber"
        />

        <SummaryCard
          label="Out of stock"
          value={String(summary.outOfStockItems)}
          icon={PackageOpen}
          tone="red"
        />

        <SummaryCard
          label="Pending orders"
          value={String(summary.pendingOrders)}
          icon={ShoppingCart}
          tone="sky"
        />

        <SummaryCard
          label="Estimated value"
          value={formatCurrency(summary.stockValue)}
          icon={BarChart3}
          tone="emerald"
        />
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "blue" | "purple" | "amber" | "red" | "sky" | "emerald";
}) {
  const toneClass =
    tone === "blue"
      ? "border-blue-300/20 bg-blue-500/10 text-blue-100"
      : tone === "purple"
        ? "border-purple-300/20 bg-purple-500/10 text-purple-100"
        : tone === "amber"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : tone === "red"
            ? "border-red-300/20 bg-red-500/10 text-red-100"
            : tone === "sky"
              ? "border-sky-300/20 bg-sky-500/10 text-sky-100"
              : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] opacity-65">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/15">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
            Stock alerts
          </p>

          <h2 className="mt-1 text-xl font-black">Things to check</h2>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-black text-white/70">
          {alerts.length}
        </div>
      </div>

      <div className="grid gap-3">
        {alerts.map((alert) => (
          <AlertCard key={`${alert.title}-${alert.message}`} alert={alert} />
        ))}
      </div>
    </section>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const style =
    alert.type === "danger"
      ? "border-red-300/20 bg-red-500/10 text-red-100"
      : alert.type === "warning"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : alert.type === "success"
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-sky-300/20 bg-sky-500/10 text-sky-100";

  const Icon =
    alert.type === "danger" || alert.type === "warning"
      ? AlertTriangle
      : alert.type === "success"
        ? CheckCircle2
        : ClipboardList;

  const content = (
    <div className={`rounded-3xl border p-4 ${style}`}>
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/15">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-black">{alert.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-80">{alert.message}</p>

          {alert.href && alert.action ? (
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-black">
              {alert.action}
              <ArrowRight className="h-4 w-4" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!alert.href) return content;

  return (
    <Link href={alert.href} className="block transition hover:scale-[1.01]">
      {content}
    </Link>
  );
}

function QuickAccessGrid({ cards }: { cards: DashboardCard[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
          Quick access
        </p>

        <h2 className="mt-1 text-xl font-black">Open Stock Control tools</h2>

        <p className="mt-2 text-sm leading-6 text-white/55">
          Manage stock records, suppliers, orders, alerts, reports and inventory
          movements from one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <QuickAccessCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}

function QuickAccessCard({ card }: { card: DashboardCard }) {
  const Icon = card.icon;

  return (
    <Link href={card.href} className="block h-full">
      <div
        className={`h-full rounded-3xl border p-5 shadow-xl transition hover:-translate-y-0.5 hover:bg-white/10 ${
          card.primary
            ? "border-blue-300/25 bg-blue-500/15"
            : "border-white/10 bg-black/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
            <Icon className="h-6 w-6" />
          </div>

          {card.badge ? (
            <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-100">
              {card.badge}
            </span>
          ) : null}
        </div>

        <h3 className="mt-4 text-lg font-black">{card.title}</h3>

        <p className="mt-2 text-sm leading-6 text-white/60">
          {card.description}
        </p>

        <div className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-200">
          {card.cta}
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function RecentStockPanel({ items }: { items: RecentStockItem[] }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
            Recent inventory
          </p>

          <h2 className="mt-1 text-xl font-black">Latest stock items</h2>
        </div>

        <Link
          href={ROUTES.allStock}
          className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
        >
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-5 text-sm leading-6 text-white/55">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Warehouse className="h-6 w-6 text-white/70" />
          </div>

          <p className="mt-4 font-black text-white">No stock items yet</p>

          <p className="mt-2">
            Add your first item to begin tracking stock quantities and reorder
            levels.
          </p>

          <Link
            href={ROUTES.addStock}
            className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-200"
          >
            Add stock item
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.slice(0, 5).map((item) => {
            const lowStock = item.quantity <= item.reorderLevel;

            return (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.name}</p>
                    <p className="mt-1 text-sm text-white/55">
                      {item.sku} · {item.category}
                    </p>
                  </div>

                  <MiniBadge tone={lowStock ? "danger" : "success"}>
                    {item.quantity} units
                  </MiniBadge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function HelpfulLinksPanel() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
        Common actions
      </p>

      <h2 className="mt-1 text-xl font-black">Useful stock links</h2>

      <div className="mt-4 grid gap-3">
        <SmallLink href={ROUTES.addStock} icon={PackagePlus}>
          Add a new stock item
        </SmallLink>

        <SmallLink href={ROUTES.stockMovements} icon={RefreshCcw}>
          Record stock movement
        </SmallLink>

        <SmallLink href={ROUTES.lowStock} icon={AlertTriangle}>
          Review low stock
        </SmallLink>

        <SmallLink href={ROUTES.purchaseOrders} icon={ShoppingCart}>
          Create purchase order
        </SmallLink>

        <SmallLink href={ROUTES.suppliers} icon={Truck}>
          Manage suppliers
        </SmallLink>

        <SmallLink href={ROUTES.reports} icon={FileSpreadsheet}>
          Export stock report
        </SmallLink>
      </div>
    </section>
  );
}

function SecurityPanel() {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-100 ring-1 ring-sky-300/20">
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div>
          <p className="font-black">Stock security reminder</p>

          <p className="mt-2 text-sm leading-6 text-white/55">
            Every stock adjustment should record who made the change and why.
            Deleting stock records, changing quantities and approving purchase
            orders should be limited to authorised admins.
          </p>
        </div>
      </div>
    </section>
  );
}

function StatusPill({
  type,
  icon: Icon,
  label,
}: {
  type: "success" | "warning" | "danger" | "info";
  icon: LucideIcon;
  label: string;
}) {
  const className =
    type === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : type === "warning"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : type === "danger"
          ? "border-red-300/20 bg-red-500/10 text-red-100"
          : "border-sky-300/20 bg-sky-500/10 text-sky-100";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black capitalize ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function MiniBadge({
  tone,
  children,
}: {
  tone: "success" | "danger" | "muted";
  children: ReactNode;
}) {
  const className =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "danger"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : "border-white/10 bg-white/10 text-white/60";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-[11px] font-black ${className}`}
    >
      {children}
    </span>
  );
}

function SmallLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-blue-200" />
        {children}
      </span>

      <ArrowRight className="h-4 w-4 text-white/40" />
    </Link>
  );
}
