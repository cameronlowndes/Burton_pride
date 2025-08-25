"use client";
//fix
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

type SponsorCardProps = {
  imageSrc: string;
  altText: string;
  name: string;
  description: string;
  link?: string;
  story?: string[];
};

const sponsors: SponsorCardProps[] = [
  {
    imageSrc: "/image/CompanyLogoPng/SocialRoots&GreenShootsPrideLogo.png",
    altText: "Social Roots & Green Shoots",
    name: "Social Roots & Green Shoots",
    description: "Committed to supporting LGBTQ+ communities.",
    link: "https://www.youtube.com/@SocialRootsGreenShoots",
  },
  {
    imageSrc: "/image/CompanyLogoPng/WincantonLogo.png",
    altText: "Wincanton",
    name: "Wincanton",
    description: "Proud to support Burton Pride.",
  },
  {
    imageSrc: "/image/CompanyLogoPng/DavidWilson.png",
    altText: "David Wilson Homes",
    name: "David Wilson Home",
    description: "Proud to support Burton Pride.",
    link: "https://www.dwh.co.uk",
  },
  {
    imageSrc: "/image/CompanyLogoPng/Central_Co-op_logo.png",
    altText: "Central England co-op",
    name: "Central England Co-Op",
    description: "Proud to support Burton Pride.",
    link: "https://www.centralcoop.co.uk",
  },
  {
    imageSrc: "/image/CompanyLogoPng/EastMidland.png",
    altText: "East Midlands Airport",
    name: "East Midlands Airport",
    description: "Proud to support Burton Pride.",
    link: "https://www.eastmidlandsairport.com",
  },
  {
    imageSrc: "/image/CompanyLogoPng/BeenCoffee.png",
    altText: "Been Coffee",
    name: "Been Coffee",
    description: "Proud to support Burton Pride.",
    link: "https://www.been.coffee",
    story: [
      "Tucked just off the beaten path, Been Coffee is an award-winning independent coffee shop known for doing things a little differently - and a lot more thoughtfully.",
      "We’re passionate about serving specialty coffee that’s expertly roasted and brewed with care, alongside a menu of loose-leaf teas, locally sourced food, and house-made treats.",
      "But we’re more than a coffee shop. We’re a community space, a dog-friendly haven, and a place where sustainability meets sincerity.",
      "We believe a great coffee shop should be more than good coffee. It should be a space that reflects the values of the people who gather there: welcoming, thoughtful, inclusive, and real.",
      "So whether you’re here for a quick espresso, a slow morning, or a spontaneous catch-up with a friend, there’s always a seat - and a warm smile - waiting for you at Been.",
    ],
  },
];

export default function SponsorCard() {
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const toggleFlip = (index: number) => {
    setFlippedIndex(flippedIndex === index ? null : index);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFlippedIndex(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) setFlippedIndex(null);
  };

  const buttonClasses = `
    inline-block
    bg-gradient-to-r from-pink-600 via-pink-700 to-pink-800
    text-white
    px-6 py-2
    rounded-full
    font-semibold
    shadow-lg
    hover:from-pink-700 hover:via-pink-800 hover:to-pink-900
    transition
    duration-300
    transform
    hover:-translate-y-1 hover:scale-105
    focus:outline-none focus:ring-4 focus:ring-pink-300
    select-none
    cursor-pointer
  `;

  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {sponsors.map((sponsor, index) => (
          <div
            key={index}
            className="cursor-pointer bg-white/10 backdrop-blur-md text-white shadow-[0_8px_25px_rgba(0,0,0,0.4)] border border-white/20 rounded-2xl p-6 flex flex-col items-center hover:scale-105 hover:shadow-[0_12px_45px_rgba(255,255,255,0.5)] transition-all duration-500"
            onClick={() => sponsor.story && toggleFlip(index)}
          >
            <div className="w-40 h-32 mb-4 relative">
              <Image
                src={sponsor.imageSrc}
                alt={sponsor.altText}
                fill
                style={{ objectFit: "contain" }}
                className="rounded-lg shadow-md"
              />
            </div>
            <h2 className="text-xl font-bold text-center mb-2">{sponsor.name}</h2>
            <p className="text-gray-200 text-center mb-4">{sponsor.description}</p>

            {sponsor.link && (
              <Link
                href={sponsor.link}
                target="_blank"
                className={buttonClasses}
                onClick={(e) => e.stopPropagation()}
              >
                Visit Sponsor
              </Link>
            )}

            {sponsor.story && (
              <button
                className={buttonClasses + " mt-4"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFlip(index);
                }}
              >
                Read Story →
              </button>
            )}
          </div>
        ))}
      </div>

      {flippedIndex !== null && sponsors[flippedIndex]?.story && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 bg-opacity-90 p-6"
        >
          <div className="relative max-w-3xl max-h-[80vh] overflow-y-auto rounded-3xl p-8 shadow-2xl bg-white/90 text-black border border-white/20">
            <h2 className="text-3xl font-bold text-center mb-6">{sponsors[flippedIndex].name}</h2>
            <div className="text-gray-800 text-lg leading-relaxed space-y-6">
              {sponsors[flippedIndex].story!.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            <button
              onClick={() => setFlippedIndex(null)}
              className="mt-8 block mx-auto text-pink-600 text-lg font-bold hover:underline cursor-pointer"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </>
  );
}
