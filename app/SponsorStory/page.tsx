"use client";

import Link from "next/link";

export default function BeenCoffeePage() {
  const story = [
    "Tucked just off the beaten path, Been Coffee is an award-winning independent coffee shop known for doing things a little differently - and a lot more thoughtfully.",
    "We’re passionate about serving specialty coffee that’s expertly roasted and brewed with care, alongside a menu of loose-leaf teas, locally sourced food, and house-made treats.",
    "But we’re more than a coffee shop. We’re a community space, a dog-friendly haven, and a place where sustainability meets sincerity.",
    "We believe a great coffee shop should be more than good coffee. It should be a space that reflects the values of the people who gather there: welcoming, thoughtful, inclusive, and real.",
    "So whether you’re here for a quick espresso, a slow morning, or a spontaneous catch-up with a friend, there’s always a seat - and a warm smile - waiting for you at Been.",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-6 sm:px-6 sm:py-6 mt-16 sm:mt-24 border-b border-white/20">
        <h1 className="text-2xl sm:text-3xl font-bold">Been Coffee</h1>
        <Link
          href="/Sponsor"
          className="text-base sm:text-lg font-semibold text-yellow-300 hover:underline"
        >
          ← Back
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 mt-6">
        {story.map((paragraph, index) => (
          <p key={index} className="text-base sm:text-lg leading-relaxed">
            {paragraph}
          </p>
        ))}
      </main>

      {/* Footer */}
      <footer className="p-4 sm:p-6 border-t border-white/20 text-center">
        <Link
          href="/Sponsor"
          className="inline-block bg-gradient-to-r from-pink-600 via-pink-700 to-pink-800 px-6 py-3 rounded-full text-white font-semibold shadow-lg hover:from-pink-700 hover:via-pink-800 hover:to-pink-900 transition transform hover:-translate-y-1 hover:scale-105"
        >
          Back to Sponsors
        </Link>
      </footer>
    </div>
  );
}
