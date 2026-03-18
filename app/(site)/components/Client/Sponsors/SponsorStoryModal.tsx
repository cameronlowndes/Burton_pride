"use client";

import { useEffect } from "react";
import Image from "next/image";
import type { Sponsor } from "@/types/sponsor";

type Props = {
  sponsor: Sponsor | null;
  open: boolean;
  onClose: () => void;
};

function sponsorBadge(type: string | null) {
  if (!type) return "Sponsor";

  const value = type.toLowerCase();

  if (value.includes("gold")) return "Gold Sponsor";
  if (value.includes("silver")) return "Silver Sponsor";
  if (value.includes("bronze")) return "Bronze Sponsor";

  return type;
}

export default function SponsorStoryModal({ sponsor, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !sponsor) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white hover:bg-white/25"
        >
          ✕
        </button>

        <div className="grid gap-0 md:grid-cols-[280px_1fr]">
          <div className="flex items-center justify-center bg-white/10 p-6">
            <div className="relative h-48 w-full max-w-[220px] overflow-hidden rounded-2xl bg-white">
              {sponsor.logo_link ? (
                <Image
                  src={sponsor.logo_link}
                  alt={sponsor.sponsor_name}
                  fill
                  className="object-contain p-4"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  No logo
                </div>
              )}
            </div>
          </div>

          <div className="p-6 text-white md:p-8">
            <div className="mb-4">
              <span className="inline-flex rounded-full border border-yellow-300/20 bg-yellow-400/20 px-3 py-1 text-xs font-semibold text-yellow-200">
                {sponsorBadge(sponsor.sponsorship_type)}
              </span>
            </div>

            <h2 className="text-3xl font-extrabold leading-tight">
              {sponsor.sponsor_name}
            </h2>

            <p className="mt-5 whitespace-pre-line text-base leading-7 text-white/90">
              {sponsor.story?.trim() || "No sponsor story has been added yet."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}