"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  AdminSidebarItem,
  AdminSidebarResponse,
} from "@/types/admin-sidebar";

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getActiveHref(pathname: string, items: AdminSidebarItem[]) {
  const enabled = items.filter((item) => item.is_enabled && item.href);

  const exactMatch = enabled.find((item) => pathname === item.href);
  if (exactMatch?.href) return exactMatch.href;

  const sortedMatches = enabled
    .filter((item) => item.href && pathname.startsWith(`${item.href}/`))
    .sort((a, b) => String(b.href).length - String(a.href).length);

  return sortedMatches[0]?.href || "";
}

export default function AdminSidebar() {
  const { signOut } = useClerk();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminSidebarItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [mobileGroupOpen, setMobileGroupOpen] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const loadItems = async () => {
      try {
        const res = await fetch("/api/admin/sidebar", { cache: "no-store" });
        const data: AdminSidebarResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load sidebar");
        }

        const enabledItems = (data.items || []).filter(
          (item) => item.is_enabled
        );

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
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      return;
    }

    const oldBodyOverflow = document.body.style.overflow;
    const oldHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = oldBodyOverflow;
      document.documentElement.style.overflow = oldHtmlOverflow;
    };
  }, [open]);

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

  const activeHref = useMemo(() => {
    return getActiveHref(pathname, items);
  }, [pathname, items]);

  if (loading) {
    return (
      <>
        <div className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 backdrop-blur-xl md:hidden">
          <div className="px-4 py-3 text-sm text-white/80">Loading menu...</div>
        </div>

        <aside className="relative hidden min-h-full w-72 shrink-0 self-stretch overflow-hidden bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 md:flex md:flex-col">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 flex min-h-full flex-1 flex-col p-6 text-sm text-white/80">
            Loading menu...
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      {/* MOBILE TOP BAR */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-lg font-black text-white shadow-lg">
              BP
            </div>

            <div className="min-w-0 leading-tight">
              <div className="truncate text-lg font-black text-white">
                Burton Pride
              </div>
              <div className="truncate text-sm font-medium text-white/75">
                Committee Admin
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-xl p-2 text-white transition hover:bg-white/10"
          >
            <span className="mb-1.5 block h-[2px] w-7 bg-current" />
            <span className="mb-1.5 block h-[2px] w-7 bg-current" />
            <span className="block h-[2px] w-7 bg-current" />
          </button>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="relative hidden min-h-full w-72 shrink-0 self-stretch overflow-hidden border-r border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl md:flex md:flex-col">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute -left-20 top-10 h-52 w-52 rounded-full bg-pink-300/25 blur-3xl" />
        <div className="absolute -right-20 top-72 h-60 w-60 rounded-full bg-blue-300/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-black/45 to-transparent" />

        <SidebarContent
          items={topLevelItems}
          childMap={childMap}
          pathname={pathname}
          activeHref={activeHref}
          signOut={() => signOut({ redirectUrl: "/Admin/Login" })}
        />
      </aside>

      {/* MOBILE DRAWER */}
      <div
        className={clsx(
          "fixed inset-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className={clsx(
            "absolute inset-0 bg-black/70 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          className={clsx(
            "absolute right-0 top-0 flex h-dvh w-80 max-w-[86vw] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-pink-600 via-purple-700 to-blue-700 text-white shadow-2xl transition-transform overscroll-contain",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="absolute inset-0 bg-black/25" />
          <div className="absolute -left-20 top-16 h-52 w-52 rounded-full bg-pink-300/25 blur-3xl" />
          <div className="absolute -right-20 bottom-20 h-56 w-56 rounded-full bg-blue-300/25 blur-3xl" />

          <div className="relative shrink-0 border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="font-black text-white">Menu</div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
              <div className="space-y-2">
                {topLevelItems.map((item) => {
                  const children = childMap.get(item.id) || [];
                  const isGroup = item.item_type === "group";
                  const isOpen = mobileGroupOpen[item.id] ?? true;
                  const itemActive = item.href
                    ? activeHref === item.href
                    : false;

                  if (isGroup) {
                    const groupHasActiveChild = children.some(
                      (child) => child.href && activeHref === child.href
                    );

                    return (
                      <div key={item.id}>
                        <div className="flex items-center gap-2">
                          <Link
                            href={item.href || "#"}
                            onClick={() => setOpen(false)}
                            target={
                              item.open_in_new_tab ? "_blank" : undefined
                            }
                            rel={
                              item.open_in_new_tab ? "noreferrer" : undefined
                            }
                            className={clsx(
                              "flex-1 rounded-2xl px-4 py-3 text-left text-sm font-black transition",
                              itemActive
                                ? "bg-white text-purple-700 shadow-lg"
                                : groupHasActiveChild
                                ? "bg-white/20 text-white"
                                : "bg-white/10 text-white hover:bg-white/20"
                            )}
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
                            aria-label={
                              isOpen
                                ? `Collapse ${item.label}`
                                : `Expand ${item.label}`
                            }
                            className="shrink-0 rounded-2xl bg-white/10 px-4 py-3 text-white/90 transition hover:bg-white/20 hover:text-white"
                          >
                            <span
                              className={clsx(
                                "block transition",
                                isOpen ? "rotate-180" : ""
                              )}
                            >
                              ▾
                            </span>
                          </button>
                        </div>

                        {isOpen && children.length > 0 && (
                          <div className="ml-2 mt-1 space-y-1 border-l border-white/15 pl-3">
                            {children.map((child) => (
                              <MobileSubLink
                                key={child.id}
                                href={child.href || "#"}
                                label={child.label}
                                active={
                                  child.href ? activeHref === child.href : false
                                }
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
                      active={item.href ? activeHref === item.href : false}
                      onNavigate={() => setOpen(false)}
                      openInNewTab={item.open_in_new_tab}
                    />
                  );
                })}

                {/* LOG OUT AS LAST NORMAL MOBILE MENU ITEM */}
                <div className="border-t border-white/15 pt-4">
                  <button
                    type="button"
                    onClick={() => signOut({ redirectUrl: "/Admin/Login" })}
                    className="w-full rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white transition hover:bg-white/20"
                  >
                    Log out →
                  </button>
                </div>
              </div>
            </div>

            {/* ONLY THIS IS FORCED TO MOBILE BOTTOM */}
            <div className="shrink-0 px-4 pb-6 pt-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                  Burton Pride
                </p>
                <p className="mt-1 text-sm font-black text-white">
                  Burton Pride C.I.C
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SidebarContent({
  items,
  childMap,
  pathname,
  activeHref,
  signOut,
}: {
  items: AdminSidebarItem[];
  childMap: Map<string, AdminSidebarItem[]>;
  pathname: string;
  activeHref: string;
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
    <div className="relative z-10 flex min-h-full flex-1 flex-col p-6">
      {/* TOP BRAND */}
      <div className="shrink-0">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-white/20 bg-white/20 text-xl font-black text-white shadow-lg backdrop-blur">
          BP
        </div>

        <div className="text-2xl font-black text-white drop-shadow">
          Burton Pride
        </div>
        <div className="text-sm font-medium text-white/75">
          Committee Admin
        </div>
      </div>

      {/* SCROLLING NAV */}
      <nav className="mt-8 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const children = childMap.get(item.id) || [];
          const isGroup = item.item_type === "group";
          const isOpen = groupOpen[item.id] ?? true;
          const itemActive = item.href ? activeHref === item.href : false;
          const groupHasActiveChild = children.some(
            (child) => child.href && activeHref === child.href
          );

          if (isGroup) {
            return (
              <div key={item.id}>
                <div className="flex items-center gap-2">
                  <Link
                    href={item.href || "#"}
                    target={item.open_in_new_tab ? "_blank" : undefined}
                    rel={item.open_in_new_tab ? "noreferrer" : undefined}
                    className={clsx(
                      "group flex flex-1 items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition",
                      itemActive
                        ? "bg-white text-purple-700 shadow-lg"
                        : groupHasActiveChild
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    <span>{item.label}</span>
                    <span
                      className={clsx(
                        "transition",
                        itemActive ? "text-purple-700" : "text-white/80"
                      )}
                    >
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
                    aria-label={
                      isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`
                    }
                    className="shrink-0 rounded-2xl bg-white/10 px-3 py-3 text-white/90 transition hover:bg-white/20 hover:text-white"
                  >
                    <span
                      className={clsx(
                        "block transition",
                        isOpen ? "rotate-180" : ""
                      )}
                    >
                      ▾
                    </span>
                  </button>
                </div>

                {isOpen && children.length > 0 && (
                  <div className="ml-2 mt-1 space-y-1 border-l border-white/15 pl-2">
                    {children.map((child) => (
                      <SubNavLink
                        key={child.id}
                        href={child.href || "#"}
                        label={child.label}
                        active={child.href ? activeHref === child.href : false}
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
              active={item.href ? activeHref === item.href : false}
              openInNewTab={item.open_in_new_tab}
            />
          );
        })}

        {/* LOG OUT AS LAST NORMAL DESKTOP MENU ITEM */}
        <div className="border-t border-white/15 pt-4">
          <button
            type="button"
            onClick={signOut}
            className="w-full rounded-2xl bg-white/10 px-4 py-3 text-left text-sm font-black text-white transition hover:bg-white/20"
          >
            Log out →
          </button>
        </div>
      </nav>

      {/* ONLY THIS IS FORCED TO DESKTOP BOTTOM */}
      <div className="mt-auto shrink-0 pt-4">
        <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
            Burton Pride
          </p>
          <p className="mt-1 text-sm font-black text-white">
            Burton Pride C.I.C
          </p>
        </div>
      </div>
    </div>
  );
}

function SideNavLink({
  href,
  label,
  active,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  active: boolean;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className={clsx(
        "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      <span>{label}</span>
      <span
        className={clsx(
          "transition",
          active ? "text-purple-700" : "text-white/80"
        )}
      >
        →
      </span>
    </Link>
  );
}

function SubNavLink({
  href,
  label,
  active,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  active: boolean;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className={clsx(
        "block rounded-2xl px-4 py-2 text-sm font-bold transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "text-white/85 hover:bg-white/15 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}

function MobileLink({
  href,
  label,
  active,
  onNavigate,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className={clsx(
        "block rounded-2xl px-4 py-3 text-sm font-black transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      {label}
    </Link>
  );
}

function MobileSubLink({
  href,
  label,
  active,
  onNavigate,
  openInNewTab = false,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
  openInNewTab?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noreferrer" : undefined}
      className={clsx(
        "block rounded-2xl px-3 py-2 text-sm font-bold transition",
        active
          ? "bg-white text-purple-700 shadow-lg"
          : "text-white/85 hover:bg-white/15 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}