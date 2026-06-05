"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Mail,
  Send,
  FileText,
  History,
  TestTube2,
  Settings,
  PenSquare,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

const EMAIL_ROOT = "/Admin/Email";

type EmailSidebarItem = {
  id: string;
  label: string;
  href: string;
  icon: string | null;
  is_enabled: boolean;
  sort_order?: number | null;
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getIcon(name: string | null | undefined) {
  switch (name) {
    case "Mail":
      return Mail;
    case "Send":
      return Send;
    case "FileText":
      return FileText;
    case "History":
      return History;
    case "TestTube2":
      return TestTube2;
    case "Settings":
      return Settings;
    case "PenSquare":
      return PenSquare;
    default:
      return Mail;
  }
}

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { rawResponse: text };
  }
}

export default function EmailSidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EmailSidebarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      setLoadError("");

      const res = await fetch("/api/admin/email-sidebar", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
            data.message ||
            data.rawResponse ||
            `Email sidebar API failed with HTTP ${res.status}`
        );
      }

      const nextItems = Array.isArray(data.items) ? data.items : [];

      setItems(
        nextItems
          .filter((item: EmailSidebarItem) => item.is_enabled)
          .sort(
            (a: EmailSidebarItem, b: EmailSidebarItem) =>
              Number(a.sort_order || 0) - Number(b.sort_order || 0)
          )
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load email sidebar.";

      console.error("Failed to load email sidebar:", err);
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentTitle = useMemo(() => {
    const current = items.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );

    return current?.label || "Admin Email";
  }, [pathname, items]);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white">
              BP
            </div>

            <div>
              <div className="text-base font-extrabold text-white">
                Burton Pride
              </div>
              <div className="text-[11px] text-white/70">{currentTitle}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl px-3 py-2 text-white hover:bg-white/10"
          >
            ☰
          </button>
        </div>
      </div>

      <div className="flex min-h-screen">
        <aside className="hidden w-72 bg-white/10 backdrop-blur-xl md:block">
          <DesktopSidebar
            pathname={pathname}
            items={items}
            loading={loading}
            loadError={loadError}
            onRetry={loadItems}
          />
        </aside>

        <main className="flex-1">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close email menu overlay"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-0 h-full w-80 bg-white/10 p-4 backdrop-blur-xl">
            <div className="mb-4 flex justify-between">
              <span className="font-bold text-white">Email Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white"
              >
                ✕
              </button>
            </div>

            <MobileEmailLink
              href="/Admin/Dashboard"
              label="Back to Dashboard"
              icon={ArrowLeft}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              exact
            />

            <div className="my-3 border-t border-white/10" />

            {loading ? (
              <div className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white/70">
                Loading email menu...
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-100">
                <p className="font-bold">Email menu failed</p>
                <p className="mt-1 text-xs leading-5">{loadError}</p>

                <button
                  type="button"
                  onClick={loadItems}
                  className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
                >
                  Retry
                </button>
              </div>
            ) : (
              items.map((item) => {
                const Icon = getIcon(item.icon);

                return (
                  <MobileEmailLink
                    key={item.id}
                    href={item.href}
                    label={item.label}
                    icon={Icon}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                    exact={item.href === EMAIL_ROOT}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DesktopSidebar({
  pathname,
  items,
  loading,
  loadError,
  onRetry,
}: {
  pathname: string;
  items: EmailSidebarItem[];
  loading: boolean;
  loadError: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-6">
      <div className="mb-8 text-lg font-bold text-white">Emailing APP</div>

      <SideNavLink
        href="/Admin/Dashboard"
        label="Back to Dashboard"
        pathname={pathname}
        icon={ArrowLeft}
        exact
      />

      <div className="my-3 border-t border-white/10" />

      {loading ? (
        <div className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white/70">
          Loading email menu...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/15 p-3 text-sm text-red-100">
          <p className="font-bold">Email menu failed</p>
          <p className="mt-1 text-xs leading-5">{loadError}</p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      ) : (
        items.map((item) => {
          const Icon = getIcon(item.icon);

          return (
            <SideNavLink
              key={item.id}
              href={item.href}
              label={item.label}
              pathname={pathname}
              icon={Icon}
              exact={item.href === EMAIL_ROOT}
            />
          );
        })
      )}
    </div>
  );
}

function SideNavLink({
  href,
  label,
  pathname,
  icon: Icon,
  exact = false,
}: {
  href: string;
  label: string;
  pathname: string;
  icon: any;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center justify-between rounded-xl px-4 py-3 text-sm",
        active ? "bg-white/15 text-white" : "text-white hover:bg-white/10"
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function MobileEmailLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
  exact = false,
}: {
  href: string;
  label: string;
  icon: any;
  pathname: string;
  onNavigate: () => void;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={clsx(
        "flex items-center justify-between rounded-xl px-4 py-3 text-sm",
        active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10"
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}