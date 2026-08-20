"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaBars, FaTimes, FaCaretDown } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type NavbarChild = {
  id: string;
  label: string;
  href: string | null;
  item_type: "link" | "dropdown";
  parent_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  open_in_new_tab: boolean;
};

type NavbarItem = NavbarChild & {
  children?: NavbarChild[];
};

type NavbarApiResponse = {
  ok: boolean;
  error?: string;
  items?: NavbarItem[];
};

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [items, setItems] = useState<NavbarItem[]>([]);
  const [loading, setLoading] = useState(true);

  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pathname = usePathname();

  useEffect(() => {
    async function loadNavbar() {
      try {
        setLoading(true);

        const res = await fetch("/api/navbar", {
          cache: "no-store",
        });

        const json: NavbarApiResponse = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load navbar");
        }

        setItems(json.items || []);
      } catch (error) {
        console.error("Navbar load failed:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadNavbar();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const clickedInsideAnyDropdown = Object.values(dropdownRefs.current).some(
        (ref) => ref && ref.contains(target)
      );

      if (!clickedInsideAnyDropdown) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setOpenDropdownId(null);
  }, [pathname]);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  const isActive = (path: string) => {
    if (!path) return false;
    return pathname === path;
  };

  const isDropdownActive = (item: NavbarItem) => {
    if (!item.children?.length) return false;
    return item.children.some((child) => child.href && pathname === child.href);
  };

  const toggleDropdown = (id: string) => {
    setOpenDropdownId((prev) => (prev === id ? null : id));
  };

  const topItems = useMemo(() => {
    return items.filter((item) => item.is_enabled !== false);
  }, [items]);

  function renderNavLink(item: NavbarItem | NavbarChild, mobile = false) {
    if (!item.href) return null;

    const isExternal =
      item.href.startsWith("http://") || item.href.startsWith("https://");

    const commonClass = mobile
      ? `flex min-h-14 w-full items-center rounded-2xl border px-4 py-3 text-left text-base font-black backdrop-blur-md transition ${
          isActive(item.href)
            ? "border-white bg-white text-purple-700 shadow-lg dark:bg-white dark:text-slate-950"
            : "border-white/15 bg-white/10 text-white hover:bg-white/15 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
        }`
      : `rounded-full px-3 py-2.5 text-sm font-black transition duration-200 xl:px-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/70 ${
          isActive(item.href)
            ? "bg-white text-purple-700 shadow-lg dark:text-slate-950"
            : "text-white hover:bg-white/15"
        }`;

    return (
      <Link
        key={item.id}
        href={item.href}
        target={isExternal || item.open_in_new_tab ? "_blank" : undefined}
        rel={
          isExternal || item.open_in_new_tab ? "noopener noreferrer" : undefined
        }
        className={commonClass}
        onClick={() => {
          if (mobile) setIsMenuOpen(false);
        }}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <>
      <nav
        className="fixed left-0 right-0 top-0 z-[9999] w-full border-b border-white/20 bg-gradient-to-r from-pink-500 via-fuchsia-500 via-purple-500 to-blue-500 text-white shadow-[0_12px_40px_rgba(76,29,149,0.30)] backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-[linear-gradient(180deg,#0c1119_0%,#0d111a_55%,#13182d_100%)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
      >
        <div className="flex min-h-[76px] w-full items-center justify-between gap-4 px-3 sm:px-4 lg:px-5 xl:px-6">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/70"
            aria-label="Burton Pride home"
          >
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/80 bg-white shadow-xl transition duration-200 group-hover:scale-105 sm:h-14 sm:w-14">
              <Image
                src="/image/Logo.png"
                alt="Burton Pride logo"
                fill
                sizes="56px"
                className="object-cover"
                priority
              />
            </span>

            <span className="hidden leading-tight sm:block">
              <span className="block whitespace-nowrap text-lg font-black tracking-tight text-white sm:text-xl">
                Burton Pride
              </span>
              <span className="block whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 sm:text-[11px]">
                Community Led • Grassroots Pride
              </span>
            </span>
          </Link>

          <div className="ml-auto hidden flex-1 items-center justify-end gap-2 lg:flex">
            {!loading && topItems.map((item) => {
              if (item.item_type === "dropdown") {
                const active = isDropdownActive(item);
                const isOpen = openDropdownId === item.id;
                return (
                  <div key={item.id} ref={(el) => { dropdownRefs.current[item.id] = el; }} className="relative">
                    <button type="button" onClick={() => toggleDropdown(item.id)} aria-expanded={isOpen} className={`inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm font-black transition duration-200 xl:px-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/70 ${active ? "bg-white text-purple-700 shadow-lg dark:bg-white dark:text-slate-950" : "text-white hover:bg-white/15"}`}>
                      {item.label}
                      <FaCaretDown className={`text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.16 }} className="absolute right-0 z-[9999] mt-3 w-72 overflow-hidden rounded-3xl border border-white/50 bg-white/95 p-2 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0f172a]/95 dark:text-white dark:shadow-[0_24px_60px_rgba(0,0,0,0.65)]">
                          {(item.children || []).map((child) => {
                            if (!child.href) return null;
                            const external = child.href.startsWith("http://") || child.href.startsWith("https://");
                            const childActive = isActive(child.href);
                            return (
                              <Link key={child.id} href={child.href} target={external || child.open_in_new_tab ? "_blank" : undefined} rel={external || child.open_in_new_tab ? "noopener noreferrer" : undefined} onClick={() => setOpenDropdownId(null)} className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition ${childActive ? "bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white shadow-md" : "hover:bg-slate-100 dark:hover:bg-white/10"}`}>
                                <span>{child.label}</span><span aria-hidden="true" className="text-xs opacity-60">→</span>
                              </Link>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }
              return renderNavLink(item, false);
            })}
            <Link href="/DonateToUs" className="ml-1 inline-flex items-center justify-center rounded-full bg-yellow-300 px-5 py-2.5 text-sm font-black text-purple-950 shadow-lg transition duration-200 hover:scale-105 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200">💖 Donate</Link>
          </div>

          <div className="ml-auto flex items-center justify-end gap-2 lg:hidden">
            <Link href="/DonateToUs" className="hidden rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-purple-950 shadow-lg transition hover:bg-white sm:inline-flex">Donate</Link>
            <button type="button" onClick={() => setIsMenuOpen((prev) => !prev)} aria-label={isMenuOpen ? "Close menu" : "Open menu"} aria-expanded={isMenuOpen} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-xl text-white shadow-lg backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/70 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.10]">
              {isMenuOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.button type="button" aria-label="Close navigation menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 z-[9997] bg-black/45 backdrop-blur-sm lg:hidden" />
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed bottom-0 right-0 top-[76px] z-[9998] w-full overflow-y-auto overscroll-contain border-l border-white/15 bg-gradient-to-b from-pink-500 via-purple-600 to-blue-600 text-white shadow-[-20px_0_60px_rgba(76,29,149,0.30)] dark:border-white/10 dark:bg-[linear-gradient(180deg,#0c1119_0%,#0f172a_55%,#13182d_100%)] dark:shadow-[-20px_0_60px_rgba(0,0,0,0.55)] sm:max-w-md lg:hidden"
            >
              <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
                <div className="mb-3 rounded-2xl border border-white/15 bg-black/10 px-4 py-4 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
                    Burton Pride
                  </p>
                  <h2 className="mt-1 text-2xl font-black leading-tight">
                    Explore the website
                  </h2>
                  <p className="mt-2 text-sm leading-5 text-white/75">
                    Pride information, events, community pages and ways to get involved.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {loading && (
                    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-bold text-white/90">
                      Loading menu...
                    </div>
                  )}

                  {!loading &&
                    topItems.map((item) => {
                      if (item.item_type === "dropdown") {
                        const isOpen = openDropdownId === item.id;
                        const active = isDropdownActive(item);

                        return (
                          <div
                            key={item.id}
                            className={`overflow-hidden rounded-2xl border backdrop-blur-md transition ${
                              active
                                ? "border-white/35 bg-white/15"
                                : "border-white/15 bg-white/[0.08] dark:border-white/10 dark:bg-white/[0.04]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleDropdown(item.id)}
                              aria-expanded={isOpen}
                              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-yellow-300/60"
                            >
                              <span>{item.label}</span>
                              <FaCaretDown
                                className={`shrink-0 text-sm transition-transform duration-200 ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-2 border-t border-white/10 p-2.5">
                                    {(item.children || []).map((child) => {
                                      if (!child.href) return null;

                                      const external =
                                        child.href.startsWith("http://") ||
                                        child.href.startsWith("https://");
                                      const childActive = isActive(child.href);

                                      return (
                                        <Link
                                          key={child.id}
                                          href={child.href}
                                          target={
                                            external || child.open_in_new_tab
                                              ? "_blank"
                                              : undefined
                                          }
                                          rel={
                                            external || child.open_in_new_tab
                                              ? "noopener noreferrer"
                                              : undefined
                                          }
                                          className={`flex min-h-12 items-center rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                                            childActive
                                              ? "bg-white text-purple-700 shadow-md dark:text-slate-950"
                                              : "bg-white/[0.07] text-white hover:bg-white/15"
                                          }`}
                                          onClick={() => setIsMenuOpen(false)}
                                        >
                                          {child.label}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      }

                      return renderNavLink(item, true);
                    })}
                </div>

                <div className="mt-4 grid gap-2.5">
                  <Link
                    href="/DonateToUs"
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-yellow-300 px-5 py-3 text-base font-black text-purple-950 shadow-xl transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-100"
                  >
                    💖 Support Burton Pride
                  </Link>

                  <Link
                    href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 text-center text-xs font-semibold text-white/60 transition hover:text-white"
                  >
                    Built &amp; Powered by Cameron Digital Works
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
