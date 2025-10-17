"use client";
import React, { useState, useRef, useEffect } from "react";
import { FaBars, FaTimes, FaCaretDown } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  // State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Refs
  const eventsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  // Router
  const pathname = usePathname();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        eventsRef.current &&
        !eventsRef.current.contains(event.target as Node) &&
        aboutRef.current &&
        !aboutRef.current.contains(event.target as Node)
      ) {
        setIsEventsOpen(false);
        setIsAboutOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helpers
  const isActive = (path: string) => pathname === path;
  const rainbowClass = "font-bold rainbow-underline";

  const toggleAbout = () => {
    setIsAboutOpen((prev) => !prev);
    setIsEventsOpen(false);
  };

  const toggleEvents = () => {
    setIsEventsOpen((prev) => !prev);
    setIsAboutOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex w-full items-center justify-between bg-gradient-to-r from-red-500 via-orange-400 via-yellow-300 via-green-500 via-blue-500 to-purple-600 px-8 py-3 text-white shadow-md backdrop-blur-md">
      {/* Logo with watermark */}
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

      {/* Desktop Menu */}
      <div className="hidden gap-6 md:flex">
        <Link
          href="/"
          className={isActive("/") ? rainbowClass : "hover:underline"}
        >
          Home
        </Link>

        {/* About Dropdown */}
        <div ref={aboutRef} className="relative">
          <button
            onClick={toggleAbout}
            className={`flex items-center gap-1 cursor-pointer ${pathname.startsWith("/about") ||
                pathname.startsWith("/OurCoreValues")
                ? rainbowClass
                : "hover:underline"
              }`}
          >
            About <FaCaretDown className="text-sm" />
          </button>
          {isAboutOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 mt-2 w-48 rounded-md border border-gray-200 bg-white text-black shadow-lg z-20"
            >
              <Link href="/about" className="block px-4 py-2 hover:bg-gray-100">
                About Us
              </Link>
              <Link
                href="/about/OurCoreValues"
                className="block px-4 py-2 hover:bg-gray-100"
              >
                Our Values
              </Link>
            </motion.div>
          )}
        </div>

        {/* Events Dropdown */}
        <div ref={eventsRef} className="relative">
          <button
            onClick={toggleEvents}
            className={`flex items-center gap-1 cursor-pointer ${pathname.startsWith("/events") || pathname === "/Pride2025"
                ? rainbowClass
                : "hover:underline"
              }`}
          >
            Events <FaCaretDown className="text-sm" />
          </button>
          {isEventsOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 mt-2 w-48 rounded-md border border-gray-200 bg-white text-black shadow-lg z-20"
            >
              <Link
                href="/events"
                className="block px-4 py-2 hover:bg-gray-100"
              >
                All Events
              </Link>

              <Link
                href="https://www.tickettailor.com/events/burtonpride"
                className="block px-4 py-2 hover:bg-gray-100"
              >
                Tickets
              </Link>

              <Link
                href="/events/Pride2025"
                className="block px-4 py-2 hover:bg-gray-100"
              >
                Pride Event 2025
              </Link>

              <Link
                href="/events/NightParty"
                className="block px-4 py-2 hover:bg-gray-100"
              >
                Pride Party 2025
              </Link>

            </motion.div>
          )}
        </div>

        <Link
          href="/MeetUS"
          className={isActive("/MeetUS") ? rainbowClass : "hover:underline"}
        >
          Meet Us
        </Link>
        <Link
          href="/ContactUS"
          className={isActive("/ContactUS") ? rainbowClass : "hover:underline"}
        >
          Contact Us
        </Link>
        <Link
          href="/JoinUS"
          className={isActive("/JoinUS") ? rainbowClass : "hover:underline"}
        >
          Join The Team
        </Link>
        <Link
          href="/Sponsor"
          className={isActive("/Sponsor") ? rainbowClass : "hover:underline"}
        >
          See Your Sponsors
        </Link>

        {/* External Link */}
        <Link
          href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
          target="_blank"
          rel="noopener noreferrer"
          className="
            relative font-extrabold tracking-wide
            text-transparent bg-clip-text
            bg-gradient-to-r from-pink-500 via-yellow-400 to-cyan-500
            bg-[length:200%_auto] animate-gradient-x
            drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]
            transition-transform duration-300 ease-out
            hover:scale-110 hover:drop-shadow-[0_0_20px_rgba(255,255,255,1)]
          "
        >
          Cameron&nbsp;Digital&nbsp;Works
        </Link>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="relative z-50 text-2xl rainbow-text"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-full left-0 z-40 flex w-full flex-col items-center gap-4 bg-gradient-to-b from-purple-600 via-pink-600 to-red-500 py-6 text-white shadow-xl backdrop-blur-lg"
          >
            {/* Main Links */}
            <Link
              href="/"
              className={`block transform py-2 text-lg font-semibold transition hover:scale-105 ${isActive("/") ? rainbowClass : ""
                }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>

            {/* About in Mobile */}
            <div className="flex w-full flex-col items-center gap-2">
              <button
                onClick={toggleAbout}
                className="flex items-center gap-1 text-lg font-semibold transition transform hover:scale-105"
              >
                About <FaCaretDown />
              </button>
              <AnimatePresence>
                {isAboutOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex w-48 flex-col overflow-hidden rounded-md bg-white text-black shadow-lg"
                  >
                    <Link
                      href="/about"
                      className="px-4 py-2 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      About Us
                    </Link>
                    <Link
                      href="/about/OurCoreValues"
                      className="px-4 py-2 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Our Values
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Events in Mobile */}
            <div className="flex w-full flex-col items-center gap-2">
              <button
                onClick={toggleEvents}
                className="flex items-center gap-1 text-lg font-semibold transition transform hover:scale-105"
              >
                Events <FaCaretDown />
              </button>
              <AnimatePresence>
                {isEventsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex w-48 flex-col overflow-hidden rounded-md bg-white text-black shadow-lg"
                  >
                    <Link
                      href="/events"
                      className="px-4 py-2 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      All Events
                    </Link>
                    
                    <Link
                      href="https://www.tickettailor.com/events/burtonpride"
                      className="block px-4 py-2 hover:bg-gray-100"
                    >
                      Tickets
                    </Link>

                    <Link
                      href="/events/Pride2025"
                      className="px-4 py-2 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Pride Event 2025
                    </Link>

                    <Link
                      href="/events/NightParty"
                      className="px-4 py-2 hover:bg-gray-100"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Pride Party 2025
                    </Link>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Other Mobile Links */}
            {[
              { name: "Meet Us", href: "/MeetUS" },
              { name: "Contact Us", href: "/ContactUS" },
              { name: "Join The Team", href: "/JoinUS" },
              { name: "See Your Sponsors", href: "/Sponsor" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block transform py-2 text-lg font-semibold transition hover:scale-105 ${isActive(link.href) ? rainbowClass : ""
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}

            {/* External Link */}
            <Link
              href="https://www.camerondigitalworks.com/BurtonPrideSupportPage"
              target="_blank"
              rel="noopener noreferrer"
              className="
                relative font-extrabold tracking-wide
                text-transparent bg-clip-text
                bg-gradient-to-r from-pink-500 via-yellow-400 to-cyan-500
                bg-[length:200%_auto] animate-gradient-x
                drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]
                transition-transform duration-300 ease-out
                hover:scale-110 hover:drop-shadow-[0_0_20px_rgba(255,255,255,1)]
              "
              onClick={() => setIsMenuOpen(false)}
            >
              Cameron&nbsp;Digital&nbsp;Works
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
