"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaBars, FaTimes, FaCaretDown } from "react-icons/fa";
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

  const rainbowClass = "font-bold rainbow-underline";

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
      ? `block w-full rounded-2xl px-5 py-3 text-center text-lg font-bold text-white transition hover:bg-white/15 ${
          isActive(item.href) ? "bg-white/20" : ""
        }`
      : isActive(item.href)
      ? rainbowClass
      : "hover:underline";

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
    <nav className="fixed left-0 right-0 top-0 z-[9999] w-full bg-gradient-to-r from-red-500 via-orange-400 via-yellow-300 via-green-500 via-blue-500 to-purple-600 px-4 py-3 text-white shadow-md backdrop-blur-md sm:px-6 md:px-8">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="min-w-0 flex-1 leading-tight">
          <Link
            href="/"
            className="block truncate text-xl font-bold text-white drop-shadow-md sm:text-2xl"
          >
            Burton Pride
          </Link>

          <Link
            href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[10px] font-semibold tracking-wide text-white transition hover:text-white md:text-xs"
          >
            Built & Powered by Cameron Digital Works
          </Link>
        </div>

        <div className="hidden items-center gap-6 md:flex">
          {!loading &&
            topItems.map((item) => {
              if (item.item_type === "dropdown") {
                const active = isDropdownActive(item);

                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      dropdownRefs.current[item.id] = el;
                    }}
                    className="relative"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDropdown(item.id)}
                      className={`flex cursor-pointer items-center gap-1 ${
                        active ? rainbowClass : "hover:underline"
                      }`}
                    >
                      {item.label}
                      <FaCaretDown className="text-sm" />
                    </button>

                    <AnimatePresence>
                      {openDropdownId === item.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 z-[9999] mt-2 w-56 rounded-md border border-gray-200 bg-white text-black shadow-lg"
                        >
                          {(item.children || []).map((child) => {
                            if (!child.href) return null;

                            const external =
                              child.href.startsWith("http://") ||
                              child.href.startsWith("https://");

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
                                className="block px-4 py-2 hover:bg-gray-100"
                              >
                                {child.label}
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
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-2xl text-purple-700 shadow-lg ring-2 ring-white/60 md:hidden"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 top-[68px] z-[9998] max-h-[calc(100vh-68px)] overflow-y-auto bg-gradient-to-b from-purple-700 via-pink-600 to-red-500 px-5 py-6 text-white shadow-2xl md:hidden"
          >
            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
              {loading && (
                <p className="text-sm font-semibold text-white/90">
                  Loading menu...
                </p>
              )}

              {!loading &&
                topItems.map((item) => {
                  if (item.item_type === "dropdown") {
                    const isOpen = openDropdownId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="flex w-full flex-col items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => toggleDropdown(item.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-lg font-bold text-white transition hover:bg-white/15"
                        >
                          {item.label}
                          <FaCaretDown
                            className={`transition ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="flex w-full flex-col overflow-hidden rounded-2xl bg-white text-black shadow-lg"
                            >
                              {(item.children || []).map((child) => {
                                if (!child.href) return null;

                                const external =
                                  child.href.startsWith("http://") ||
                                  child.href.startsWith("https://");

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
                                    className="px-4 py-3 text-center font-semibold hover:bg-gray-100"
                                    onClick={() => setIsMenuOpen(false)}
                                  >
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  return renderNavLink(item, true);
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}