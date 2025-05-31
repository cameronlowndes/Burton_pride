"use client";

import React, { useState, useRef, useEffect } from "react";
import { FaBars, FaTimes, FaCaretDown } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation"; // ✅ Import hook

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const eventsRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname(); // ✅ Get current path

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (eventsRef.current && !eventsRef.current.contains(event.target as Node)) {
        setIsEventsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isActive = (path: string) => pathname === path;

  const toggleEvents = () => {
    setIsEventsOpen(!isEventsOpen);
  };

  return (
    <nav className="w-full bg-white text-black shadow-md py-4 px-8 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
      <Link href="/" className="text-xl font-bold text-pink-600">
        Burton Pride
      </Link>

      {/* Desktop Menu */}
      <div className="hidden md:flex gap-6">
        <Link href="/" className={isActive("/") ? "text-pink-600 font-bold underline" : "hover:underline"}>
          Home
        </Link>
        <Link href="/about" className={isActive("/about") ? "text-pink-600 font-bold underline" : "hover:underline"}>
          About
        </Link>
        <div ref={eventsRef} className="relative">
          <button
            onClick={toggleEvents}
            className={`flex items-center gap-1 ${pathname.startsWith("/events") || pathname === "/Pride2025" ? "text-pink-600 font-bold underline" : "hover:underline"}`}
          >
            Events <FaCaretDown className="text-sm" />
          </button>
          {isEventsOpen && (
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <Link href="/events" className="block px-4 py-2 hover:bg-gray-100">
                All Events
              </Link>
              <Link href="/Pride2025" className="block px-4 py-2 hover:bg-gray-100">
                Pride Event 2025
              </Link>
            </div>
          )}
        </div>
        <Link href="/MeetUS" className={isActive("/MeetUS") ? "text-pink-600 font-bold underline" : "hover:underline"}>
          Meet Us
        </Link>
        <Link href="/ContactUS" className={isActive("/ContactUS") ? "text-pink-600 font-bold underline" : "hover:underline"}>
          Contact Us
        </Link>
        <Link href="/JoinUS" className={isActive("/JoinUS") ? "text-pink-600 font-bold underline" : "hover:underline"}>
          Join The Team
        </Link>
        <Link href="/Sponsor" className={isActive("/Sponsor") ? "text-pink-600 font-bold underline" : "hover:underline"}>
          See Your Sponsors
        </Link>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-2xl">
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white shadow-lg py-4 md:hidden">
          <div className="flex flex-col sm:flex-row items-center justify-around">
            <Link href="/" className={`py-2 ${isActive("/") ? "text-pink-600 font-bold underline" : "hover:underline"}`} onClick={() => setIsMenuOpen(false)}>Home</Link>
            <Link href="/about" className={`py-2 ${isActive("/about") ? "text-pink-600 font-bold underline" : "hover:underline"}`} onClick={() => setIsMenuOpen(false)}>About</Link>
            <div ref={eventsRef} className="relative">
              <button
                onClick={toggleEvents}
                className={`py-2 flex items-center gap-1 ${pathname.startsWith("/events") || pathname === "/Pride2025" ? "text-pink-600 font-bold underline" : "hover:underline"}`}
              >
                Events <FaCaretDown className="text-sm" />
              </button>
              {isEventsOpen && (
                <div className="absolute bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <Link href="/events" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>All Events</Link>
                  <Link href="/Pride2025" className="block px-4 py-2 hover:bg-gray-100" onClick={() => setIsMenuOpen(false)}>Pride Event 2025</Link>
                </div>
              )}
            </div>
            <Link href="/MeetUS" className={`py-2 ${isActive("/MeetUS") ? "text-pink-600 font-bold underline" : "hover:underline"}`} onClick={() => setIsMenuOpen(false)}>Meet Us</Link>
            <Link href="/ContactUS" className={`py-2 ${isActive("/ContactUS") ? "text-pink-600 font-bold underline" : "hover:underline"}`} onClick={() => setIsMenuOpen(false)}>Contact Us</Link>
            <Link href="/JoinUS" className={`py-2 ${isActive("/JoinUS") ? "text-pink-600 font-bold underline" : "hover:underline"}`} onClick={() => setIsMenuOpen(false)}>Join The Team</Link>
            <Link href="/Sponsor" className={`py-2 ${isActive("/Sponsor") ? "text-pink-600 font-bold underline" : "hover:underline"}`} onClick={() => setIsMenuOpen(false)}>See Your Sponsors</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
