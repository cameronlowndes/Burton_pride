"use client"; // ✅ Required for client-side React hooks

import React, { useState, useRef, useEffect } from "react";
import { FaBars, FaTimes, FaCaretDown } from "react-icons/fa"; // Import icons
import Link from "next/link"; // Use Next.js Link for navigation

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false); // State for Events dropdown
  const eventsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/about" className="hover:underline">About</Link>
        <div ref={eventsRef} className="relative">
          <button
            onClick={toggleEvents}
            className="hover:underline flex items-center gap-1"
          >
            Events <FaCaretDown className="text-sm" />
          </button>
          {isEventsOpen && (
            <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <Link href="/events" className="block px-4 py-2 text-gray-800 hover:bg-gray-100" >
                All Events
              </Link>
              <Link href="/pride-event-2025" className="block px-4 py-2 text-gray-800 hover:bg-gray-100">
                Pride Event 2025
              </Link>
            </div>
          )}
        </div>
        <Link href="/MeetUS" className="hover:underline">Meet Us</Link>
        <Link href="/ContactUS" className="hover:underline">Contact Us</Link>
        <Link href="/JoinUS" className="hover:underline">Join The Team</Link>
        <Link href="/Sponsor" className="hover:underline">See Your Sponers</Link>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-2xl">
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white shadow-lg  py-4 md:hidden">
          <div className="flex flex-col sm:flex-row items-center justify-around">
            <Link href="/" className="py-2 hover:underline whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>Home</Link>
            <Link href="/about" className="py-2 hover:underline whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>About</Link>
            <div ref={eventsRef} className="relative whitespace-nowrap">
              <button
                onClick={toggleEvents}
                className="py-2 hover:underline   flex items-center gap-1"
              >
                Events <FaCaretDown className="text-sm" />
              </button>
              {isEventsOpen && (
                <div className="absolute  bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <Link href="/events" className="block px-4 py-2 text-gray-800 hover:bg-gray-100 whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>
                    All Events
                  </Link>
                  <Link href="/pride-event-2025" className="block px-4 py-2 text-gray-800 hover:bg-gray-100 whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>
                    Pride Event 2025
                  </Link>
                </div>
              )}
            </div>
            <Link href="/MeetUS" className="py-2 hover:underline whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>Meet Us</Link>
            <Link href="/ContactUS" className="py-2 hover:underline whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>Contact Us</Link>
            <Link href="/JoinUS" className="py-2 hover:underline whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>Join The Team</Link>
            <Link href="/Sponsor" className="py-2 hover:underline whitespace-nowrap" onClick={() => setIsMenuOpen(false)}>See Your Sponers</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
