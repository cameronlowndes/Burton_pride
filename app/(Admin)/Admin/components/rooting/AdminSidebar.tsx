"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import type { AdminSidebarItem, AdminSidebarResponse } from "@/types/admin-sidebar";

export default function AdminSidebar() {
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminSidebarItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [mobileGroupOpen, setMobileGroupOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadItems = async () => {
      try {
        const res = await fetch("/api/admin/sidebar", { cache: "no-store" });
        const data: AdminSidebarResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load sidebar");
        }

        const enabledItems = (data.items || []).filter((item) => item.is_enabled);
        setItems(enabledItems);

        const initialOpen: Record<string, boolean> = {};
        enabledItems
          .filter((item) => item.item_type === "group")
          .forEach((item) => {
            initialOpen[item.id] = true;
          });
        setMobileGroupOpen(initialOpen);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMobileGroupOpen({});
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const topLevelItems = useMemo(
    () =>
      items
        .filter((item) => !item.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const childMap = useMemo(() => {
    const map = new Map<string, AdminSidebarItem[]>();

    for (const item of items) {
      if (!item.parent_id) continue;
      const current = map.get(item.parent_id) || [];
      current.push(item);
      map.set(item.parent_id, current);
    }

    for (const [key, value] of map.entries()) {
      map.set(
        key,
        [...value].sort((a, b) => a.sort_order - b.sort_order)
      );
    }

    return map;
  }, [items]);

  if (loading) {
    return (
      <>
        <div className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl md:hidden">
          <div className="px-4 py-3 text-sm text-white/70">Loading menu...</div>
        </div>

        <aside className="relative hidden w-72 bg-white/10 shadow-xl backdrop-blur-xl md:block">
          <div className="p-6 text-sm text-white/70">Loading menu...</div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white">
              BP
            </div>
            <div className="leading-tight">
              <div className="text-base font-extrabold text-white">
                Burton Pride
              </div>
              <div className="text-[11px] text-white/70">Committee Admin</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <span className="mb-1.5 block h-[2px] w-6 bg-current" />
            <span className="mb-1.5 block h-[2px] w-6 bg-current" />
            <span className="block h-[2px] w-6 bg-current" />
          </button>
        </div>
      </div>

      <aside className="relative hidden w-72 bg-white/10 shadow-xl backdrop-blur-xl md:block">
        <SidebarContent
          items={topLevelItems}
          childMap={childMap}
          signOut={() => signOut({ redirectUrl: "/Admin/Login" })}
        />
      </aside>

      <div
        className={[
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
      >
        <div
          onClick={() => setOpen(false)}
          className={[
            "absolute inset-0 bg-black/60 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        <div
          className={[
            "absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white/10 shadow-2xl backdrop-blur-xl transition-transform",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="font-bold text-white">Menu</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="rounded-xl px-3 py-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            <div className="space-y-2">
              {topLevelItems.map((item) => {
                const children = childMap.get(item.id) || [];
                const isGroup = item.item_type === "group";
                const isOpen = mobileGroupOpen[item.id] ?? true;

                if (isGroup) {
                  return (
                    <div key={item.id}>
                      <div className="flex items-center gap-2">
                        <Link
                          href={item.href || "#"}
                          onClick={() => setOpen(false)}
                          target={item.open_in_new_tab ? "_blank" : undefined}
                          rel={item.open_in_new_tab ? "noreferrer" : undefined}
                          className="flex-1 rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
                        >
                          {item.label}
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            setMobileGroupOpen((prev) => ({
                              ...prev,
                              [item.id]: !isOpen,
                            }))
                          }
                          aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                          className="shrink-0 rounded-xl px-4 py-3 text-white/80 transition hover:bg-white/10 hover:text-white"
                        >
                          <span className={`block transition ${isOpen ? "rotate-180" : ""}`}>
                            ▾
                          </span>
                        </button>
                      </div>

                      {isOpen && children.length > 0 && (
                        <div className="ml-2 space-y-1 border-l border-white/10 pl-3">
                          {children.map((child) => (
                            <MobileSubLink
                              key={child.id}
                              href={child.href || "#"}
                              label={child.label}
                              onNavigate={() => setOpen(false)}
                              openInNewTab={child.open_in_new_tab}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <MobileLink
                    key={item.id}
                    href={item.href || "#"}
                    label={item.label}
                    onNavigate={() => setOpen(false)}
                    openInNewTab={item.open_in_new_tab}
                  />
                );
              })}
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: "/Admin/Login" })}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Log out →
              </button>
            </div>

            <div className="mt-6 text-xs text-white/60">Burton Pride C.I.C</div>
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarContent({
  items,
  childMap,
  signOut,
}: {
  items: AdminSidebarItem[];
  childMap: Map<string, AdminSidebarItem[]>;
  signOut: () => void;
}) {
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    items
      .filter((item) => item.item_type === "group")
      .forEach((item) => {
        initial[item.id] = true;
      });
    setGroupOpen(initial);
  }, [items]);

  return (
    <div className="relative h-full p-6">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white">
          BP
        </div>
        <div>
          <div className="text-lg font-extrabold text-white">Burton Pride</div>
          <div className="text-xs text-white/70">Committee Admin</div>
        </div>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const children = childMap.get(item.id) || [];
          const isGroup = item.item_type === "group";
          const isOpen = groupOpen[item.id] ?? true;

          if (isGroup) {
            return (
              <div key={item.id}>
                <div className="flex items-center gap-2">
                  <Link
                    href={item.href || "#"}
                    target={item.open_in_new_tab ? "_blank" : undefined}
                    rel={item.open_in_new_tab ? "noreferrer" : undefined}
                    className="group flex flex-1 items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    <span>{item.label}</span>
                    <span className="text-white/70 opacity-0 transition group-hover:opacity-100">
                      →
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      setGroupOpen((prev) => ({
                        ...prev,
                        [item.id]: !isOpen,
                      }))
                    }
                    aria-label={isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`}
                    className="shrink-0 rounded-xl px-3 py-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    <span className={`block transition ${isOpen ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </button>
                </div>

                {isOpen && children.length > 0 && (
                  <div className="ml-2 space-y-1 border-l border-white/10 pl-2">
                    {children.map((child) => (
                      <SubNavLink
                        key={child.id}
                        href={child.href || "#"}
                        label={child.label}
                        openInNewTab={child.open_in_new_tab}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <SideNavLink
              key={item.id}
              href={item.href || "#"}
              label={item.label}
              openInNewTab={item.open_in_new_tab}
            />
          );
        })}

        <div className="mt-6 border-t border-white/20 pt-6">
          <button
            type="button"
            onClick={signOut}
            className="group flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <span>Log out</span>
            <span className="text-white/70 opacity-0 transition group-hover:opacity-100">
              →
            </span>
          </button>
        </div>
      </nav>

      <div className="absolute bottom-6 left-6 text-xs text-white/60">
        Burton Pride C.I.C
      </div>
    </div>
  );
}

function SideNavLink({
  href,
  label,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className="group flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
    >
      <span>{label}</span>
      <span className="text-white/70 opacity-0 transition group-hover:opacity-100">
        →
      </span>
    </Link>
  );
}

function SubNavLink({
  href,
  label,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className="block rounded-xl px-4 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}

function MobileLink({
  href,
  label,
  onNavigate,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className="block rounded-xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}

function MobileSubLink({
  href,
  label,
  onNavigate,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className="block rounded-xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}