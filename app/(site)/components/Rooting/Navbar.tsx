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

type NavbarItem = {
  id: string;
  label: string;
  href: string | null;
  item_type: "link" | "dropdown";
  parent_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  open_in_new_tab: boolean;
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

    const commonClass = mobile
      ? `block transform py-2 text-lg font-semibold transition hover:scale-105 ${
          isActive(item.href) ? rainbowClass : ""
        }`
      : isActive(item.href)
      ? rainbowClass
      : "hover:underline";

    const isExternal =
      item.href.startsWith("http://") || item.href.startsWith("https://");

    if (isExternal || item.open_in_new_tab) {
      return (
        <Link
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
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
      <Link
        key={item.id}
        href={item.href}
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
    <nav className="fixed left-0 right-0 top-0 z-50 flex w-full items-center justify-between bg-gradient-to-r from-red-500 via-orange-400 via-yellow-300 via-green-500 via-blue-500 to-purple-600 px-8 py-3 text-white shadow-md backdrop-blur-md">
      <div className="flex flex-col leading-tight">
        <Link href="/" className="text-xl font-bold text-white drop-shadow-md">
          Burton Pride
        </Link>

        <Link
          href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-semibold tracking-wide text-white transition hover:text-white md:text-xs"
        >
          Built & Powered by Cameron Digital Works
        </Link>
      </div>

      <div className="hidden gap-6 md:flex">
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
                        className="absolute left-0 z-20 mt-2 w-56 rounded-md border border-gray-200 bg-white text-black shadow-lg"
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

      <div className="md:hidden">
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="relative z-50 text-2xl rainbow-text"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute left-0 top-full z-40 flex w-full flex-col items-center gap-4 bg-gradient-to-b from-purple-600 via-pink-600 to-red-500 py-6 text-white shadow-xl backdrop-blur-lg"
          >
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
                        onClick={() => toggleDropdown(item.id)}
                        className="flex items-center gap-1 text-lg font-semibold transition hover:scale-105"
                      >
                        {item.label} <FaCaretDown />
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex w-56 flex-col overflow-hidden rounded-md bg-white text-black shadow-lg"
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
                                  className="px-4 py-2 hover:bg-gray-100"
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
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}