'use client';
import React, { useState, useRef, useEffect } from "react";
import { FaBars, FaTimes, FaCaretDown } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const eventsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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
    <nav className="w-full bg-gradient-to-r from-red-500 via-orange-400 via-yellow-300 via-green-500 via-blue-500 to-purple-600 text-white shadow-md py-3 px-8 flex justify-between items-center fixed top-0 left-0 right-0 z-50 backdrop-blur-md">
      
      {/* Logo with small watermark under it */}
      <div className="flex flex-col leading-tight">
        <Link href="/" className="text-xl font-bold text-white drop-shadow-md">
          Burton Pride
        </Link>
        <Link
          href="https://camerondigitalworks.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] md:text-xs font-semibold text-white tracking-wide hover:text-white transition"
        >
          Built & Powered by Cameron Digital Works
        </Link>
      </div>

      {/* Desktop Menu */}
      <div className="hidden md:flex gap-6">
        <Link href="/" className={isActive("/") ? rainbowClass : "hover:underline"}>
          Home
        </Link>

        {/* About Dropdown */}
        <div ref={aboutRef} className="relative">
          <button
            onClick={toggleAbout}
            className={`flex items-center gap-1 cursor-pointer ${
              pathname.startsWith("/about") || pathname.startsWith("/OurCoreValues")
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
              className="absolute left-0 mt-2 w-48 bg-white text-black border border-gray-200 rounded-md shadow-lg z-20"
            >
              <Link href="/about" className="block px-4 py-2 hover:bg-gray-100">
                About Us
              </Link>
              <Link href="/about/OurCoreValues" className="block px-4 py-2 hover:bg-gray-100">
                Our Values
              </Link>
            </motion.div>
          )}
        </div>

        {/* Events Dropdown */}
        <div ref={eventsRef} className="relative">
          <button
            onClick={toggleEvents}
            className={`flex items-center gap-1 cursor-pointer ${
              pathname.startsWith("/events") || pathname === "/Pride2025"
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
              className="absolute left-0 mt-2 w-48 bg-white text-black border border-gray-200 rounded-md shadow-lg z-20"
            >
              <Link href="/events" className="block px-4 py-2 hover:bg-gray-100">
                All Events
              </Link>
              <Link href="/events/Pride2025" className="block px-4 py-2 hover:bg-gray-100">
                Pride Event 2025
              </Link>
              <Link href="/events/NightParty" className="block px-4 py-2 hover:bg-gray-100">
                Pride Party 2025
              </Link>
            </motion.div>
          )}
        </div>

        <Link href="/MeetUS" className={isActive("/MeetUS") ? rainbowClass : "hover:underline"}>
          Meet Us
        </Link>
        <Link href="/ContactUS" className={isActive("/ContactUS") ? rainbowClass : "hover:underline"}>
          Contact Us
        </Link>
        <Link href="/JoinUS" className={isActive("/JoinUS") ? rainbowClass : "hover:underline"}>
          Join The Team
        </Link>
        <Link href="/Sponsor" className={isActive("/Sponsor") ? rainbowClass : "hover:underline"}>
          See Your Sponsors
        </Link>
        <Link
          href="https://camerondigitalworks.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Cameron Digital Works
        </Link>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-2xl rainbow-text z-50 relative"
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
            className="absolute top-full left-0 w-full bg-gradient-to-b from-purple-600 via-pink-600 to-red-500 text-white shadow-xl py-6 flex flex-col items-center gap-4 backdrop-blur-lg z-40"
          >
            <Link
              href="/"
              className={`block py-2 text-lg font-semibold hover:scale-105 transition transform ${
                isActive("/") ? rainbowClass : ""
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>

            {/* About in Mobile */}
            <div className="w-full flex flex-col items-center gap-2">
              <button
                onClick={toggleAbout}
                className="flex items-center gap-1 text-lg font-semibold hover:scale-105 transition transform"
              >
                About <FaCaretDown />
              </button>
              <AnimatePresence>
                {isAboutOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col bg-white text-black rounded-md shadow-lg w-48 overflow-hidden"
                  >
                    <Link href="/about" className="px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>
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
            <div className="w-full flex flex-col items-center gap-2">
              <button
                onClick={toggleEvents}
                className="flex items-center gap-1 text-lg font-semibold hover:scale-105 transition transform"
              >
                Events <FaCaretDown />
              </button>
              <AnimatePresence>
                {isEventsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col bg-white text-black rounded-md shadow-lg w-48 overflow-hidden"
                  >
                    <Link href="/events" className="px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>
                      All Events
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
                className={`block py-2 text-lg font-semibold hover:scale-105 transition transform ${
                  isActive(link.href) ? rainbowClass : ""
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}

            {/* External Link */}
            <Link
              href="https://camerondigitalworks.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block py-2 text-lg font-semibold hover:scale-105 transition transform"
              onClick={() => setIsMenuOpen(false)}
            >
              Cameron Digital Works
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
