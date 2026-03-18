"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Sponsor } from "@/types/sponsor";

type Props = {
  sponsor: Sponsor;
  onDesktopOpen: (sponsor: Sponsor) => void;
};

function sponsorBadgeClass(type: string | null) {
  const value = (type || "").toLowerCase();

  if (value.includes("gold")) {
    return "bg-yellow-400/20 text-yellow-100 border border-yellow-300/30";
  }
  if (value.includes("silver")) {
    return "bg-slate-300/20 text-slate-100 border border-slate-200/30";
  }
  if (value.includes("bronze")) {
    return "bg-orange-400/20 text-orange-100 border border-orange-300/30";
  }

  return "bg-pink-400/20 text-pink-100 border border-pink-200/30";
}

export default function SponsorCard({ sponsor, onDesktopOpen }: Props) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const hasStory = Boolean(sponsor.story?.trim());

  function handleOpenStory() {
    if (!hasStory) return;

    if (isMobile) {
      if (!sponsor.slug) return;
      router.push(`/Sponsor/${sponsor.slug}`);
      return;
    }

    onDesktopOpen(sponsor);
  }

  return (
    <div className="group rounded-3xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/15">
      <div className="relative mb-4 h-40 w-full overflow-hidden rounded-2xl bg-white">
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

      <h3 className="text-center text-2xl font-bold text-white">
        {sponsor.sponsor_name}
      </h3>

      <div className="mt-3 flex justify-center">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${sponsorBadgeClass(
            sponsor.sponsorship_type
          )}`}
        >
          {sponsor.sponsorship_type || "Sponsor"}
        </span>
      </div>

      {hasStory ? (
        <button
          onClick={handleOpenStory}
          disabled={isMobile && !sponsor.slug}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 px-4 py-3 text-sm font-bold text-black shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Read Their Story
        </button>
      ) : (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white/60">
          No story available
        </div>
      )}
    </div>
  );
}