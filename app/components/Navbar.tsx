"use client"; // ✅ Required for client-side React hooks

import { useState } from "react";
import { FaBars, FaTimes } from "react-icons/fa"; // Import icons
import Link from "next/link"; // Use Next.js Link for navigation

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="w-full bg-white text-black shadow-md py-4 px-8 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
      <Link href="/" className="text-xl font-bold text-pink-600">
        Burton Pride
      </Link>

      {/* Desktop Menu */}
      <div className="hidden md:flex gap-6">
        <Link href="/" className="hover:underline">Home</Link>
        <Link href="/About" className="hover:underline">About</Link>
        <Link href="/Events" className="hover:underline">Events</Link>
        <Link href="/MeetUS" className="hover:underline">Meet Us</Link>
        <Link href="/ContactUS" className="hover:underline">Contact Us</Link>
        <Link href="/JoinUS" className="hover:underline">Join The Team</Link>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-2xl">
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white shadow-lg flex flex-col items-center py-4 md:hidden">
          <Link href="/" className="py-2 hover:underline" onClick={() => setIsMenuOpen(false)}>Home</Link>
          <Link href="/About" className="py-2 hover:underline" onClick={() => setIsMenuOpen(false)}>About</Link>
          <Link href="/Events" className="py-2 hover:underline" onClick={() => setIsMenuOpen(false)}>Events</Link>
          <Link href="/MeetUS" className="py-2 hover:underline" onClick={() => setIsMenuOpen(false)}>Meet Us</Link>    
          <Link href="/ContactUS" className="py-2 hover:underline" onClick={() => setIsMenuOpen(false)}>Contact Us</Link>    
          <Link href="/JoinUS" className="py-2 hover:underline" onClick={() => setIsMenuOpen(false)}>Join The Team</Link>  

       
        </div>
      )}
    </nav>
  );
}
