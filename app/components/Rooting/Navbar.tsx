"use client";
import React, { useState, useRef, useEffect } from "react";
import { FaBars, FaTimes, FaCaretDown } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav className="w-full bg-gradient-to-r from-red-500 via-orange-400 via-yellow-300 via-green-500 via-blue-500 to-purple-600 text-white shadow-md py-4 px-8 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
      <Link href="/" className="text-xl font-bold text-white drop-shadow-md">
        Burton Pride
      </Link>

      {/* Desktop Menu */}
      <div className="hidden md:flex gap-6">
        <Link href="/" className={isActive("/") ? rainbowClass : "hover:underline"}>
          Home
        </Link>

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
            <div className="absolute left-0 mt-2 w-48 bg-white text-black border border-gray-200 rounded-md shadow-lg z-10">
              <Link href="/about" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>
                About Us
              </Link>
              <Link
                href="/about/OurCoreValues"
                className="block px-4 py-2 hover:bg-gray-100"
                onClick={() => setIsMenuOpen(false)}
              >
                Our Values
              </Link>
            </div>
          )}
        </div>

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
            <div className="absolute left-0 mt-2 w-48 bg-white text-black border border-gray-200 rounded-md shadow-lg z-10">
              <Link href="/events" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>
                All Events
              </Link>
              <Link
                href="/events/Pride2025"
                className="block px-4 py-2 hover:bg-gray-100"
                onClick={() => setIsMenuOpen(false)}
              >
                Pride Event 2025
              </Link>
            </div>
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
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-2xl rainbow-text"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white text-black shadow-lg py-4 md:hidden">
          <div className="flex flex-col sm:flex-row items-center justify-around gap-2">
            <Link
              href="/"
              className={`py-2 ${isActive("/") ? rainbowClass : "hover:underline"}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>

            <div ref={aboutRef} className="relative">
              <button
                onClick={toggleAbout}
                className={`py-2 flex items-center gap-1 cursor-pointer ${
                  pathname.startsWith("/about") || pathname.startsWith("/OurCoreValues")
                    ? rainbowClass
                    : "hover:underline"
                }`}
              >
                About <FaCaretDown className="text-sm" />
              </button>
              {isAboutOpen && (
                <div className="absolute bg-white text-black border border-gray-200 rounded-md shadow-lg z-10 left-0 mt-2 w-48">
                  <Link href="/about" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>
                    About Us
                  </Link>
                  <Link
                    href="/about/OurCoreValues"
                    className="block px-4 py-2 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Our Values
                  </Link>
                </div>
              )}
            </div>

            <div ref={eventsRef} className="relative">
              <button
                onClick={toggleEvents}
                className={`py-2 flex items-center gap-1 cursor-pointer ${
                  pathname.startsWith("/events") || pathname === "/Pride2025"
                    ? rainbowClass
                    : "hover:underline"
                }`}
              >
                Events <FaCaretDown className="text-sm" />
              </button>
              {isEventsOpen && (
                <div className="absolute bg-white text-black border border-gray-200 rounded-md shadow-lg z-10 left-0 mt-2 w-48">
                  <Link href="/events" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>
                    All Events
                  </Link>
                  <Link
                    href="/events/Pride2025"
                    className="block px-4 py-2 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Pride Event 2025
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/MeetUS"
              className={`py-2 ${isActive("/MeetUS") ? rainbowClass : "hover:underline"}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Meet Us
            </Link>
            <Link
              href="/ContactUS"
              className={`py-2 ${isActive("/ContactUS") ? rainbowClass : "hover:underline"}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Contact Us
            </Link>
            <Link
              href="/JoinUS"
              className={`py-2 ${isActive("/JoinUS") ? rainbowClass : "hover:underline"}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Join The Team
            </Link>
            <Link
              href="/Sponsor"
              className={`py-2 ${isActive("/Sponsor") ? rainbowClass : "hover:underline"}`}
              onClick={() => setIsMenuOpen(false)}
            >
              See Your Sponsors
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
