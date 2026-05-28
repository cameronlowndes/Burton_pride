"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Sponsor } from "@/types/sponsor";

type SponsorWithMain = Sponsor & {
  is_main_sponsor?: boolean | null;
  story?: string | null;
  message?: string | null;
  slug?: string | null;
  sponsorship_type?: string | null;
  sponsor_display_type?: string | null;
  logo_link?: string | null;
  sponsor_name?: string | null;
};

type Props = {
  sponsor: SponsorWithMain;
  onDesktopOpen: (sponsor: SponsorWithMain) => void;
};

function formatSponsorType(type?: string | null) {
  if (!type) return "Sponsor";

  return String(type)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sponsorBadgeClass(
  type?: string | null,
  isMainSponsor: boolean = false
) {
  if (isMainSponsor) {
    return "bg-yellow-400 text-purple-950 border-2 border-yellow-200 shadow-xl shadow-yellow-400/50 ring-4 ring-yellow-300/50";
  }

  const value = String(type || "").toLowerCase();

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

  const isMainSponsor = Boolean(sponsor.is_main_sponsor);

  const sponsorName = sponsor.sponsor_name || "Sponsor";
  const sponsorType = sponsor.sponsorship_type ?? null;

  // Story is optional. It can come from story or message.
  const sponsorStory = String(sponsor.story || sponsor.message || "").trim();

  // Button only shows if there is real story/message text.
  const hasStory = sponsorStory.length > 0;

  function handleOpenStory() {
    if (!hasStory) return;

    if (isMobile) {
      if (!sponsor.slug) return;
      router.push(`/Sponsor/${sponsor.slug}`);
      return;
    }

    onDesktopOpen({
      ...sponsor,
      story: sponsorStory,
    });
  }

  return (
    <div
      className={
        isMainSponsor
          ? "group relative overflow-hidden rounded-[42px] border-[5px] border-yellow-300 bg-gradient-to-br from-yellow-300 via-orange-200 to-pink-300 p-2 shadow-[0_0_85px_rgba(250,204,21,0.85)] transition duration-300 hover:-translate-y-3 hover:scale-[1.035]"
          : "group rounded-3xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/15"
      }
    >
      {isMainSponsor && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.45),transparent_42%)]" />
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-300/70 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-pink-500/40 blur-3xl" />
          <div className="absolute left-1/2 top-0 h-1/2 w-1/2 -translate-x-1/2 rounded-full bg-white/40 blur-3xl" />
        </>
      )}

      <div
        className={
          isMainSponsor
            ? "relative rounded-[36px] bg-white/95 p-7 text-purple-950 backdrop-blur-md"
            : ""
        }
      >
        {isMainSponsor && (
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center rounded-full bg-purple-950 px-7 py-3 text-sm font-black uppercase tracking-[0.28em] text-yellow-300 shadow-2xl ring-4 ring-yellow-300/70">
              ⭐ Main Sponsor ⭐
            </span>
          </div>
        )}

        <div
          className={
            isMainSponsor
              ? "relative mb-7 h-72 w-full overflow-hidden rounded-[34px] border-[5px] border-yellow-300 bg-white shadow-2xl shadow-yellow-500/50"
              : "relative mb-4 h-40 w-full overflow-hidden rounded-2xl bg-white"
          }
        >
          {sponsor.logo_link ? (
            <Image
              src={sponsor.logo_link}
              alt={sponsorName}
              fill
              className={
                isMainSponsor ? "object-contain p-10" : "object-contain p-4"
              }
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              No logo
            </div>
          )}
        </div>

        <h3
          className={
            isMainSponsor
              ? "text-center text-5xl font-black leading-tight text-purple-950 drop-shadow-sm"
              : "text-center text-2xl font-bold text-white"
          }
        >
          {sponsorName}
        </h3>

        {isMainSponsor && (
          <div className="mt-5 flex justify-center">
            <span className="inline-flex rounded-full bg-yellow-400 px-8 py-3 text-base font-black uppercase tracking-[0.25em] text-purple-950 shadow-2xl ring-4 ring-yellow-200">
              Main Sponsor
            </span>
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <span
            className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-wide ${sponsorBadgeClass(
              sponsorType,
              isMainSponsor
            )}`}
          >
            {isMainSponsor
              ? "Main Sponsor"
              : sponsor.sponsor_display_type || formatSponsorType(sponsorType)}
          </span>
        </div>

        {isMainSponsor && (
          <div className="mx-auto mt-6 max-w-md rounded-3xl border-2 border-yellow-300 bg-yellow-50 px-5 py-4 text-center shadow-xl">
            <p className="text-base font-black uppercase tracking-wide text-purple-950">
              Proud Main Sponsor of Burton Pride
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-purple-900/80">
              A huge thank you for your outstanding support in helping make
              Burton Pride possible.
            </p>
          </div>
        )}

        {hasStory && (
          <button
            type="button"
            onClick={handleOpenStory}
            disabled={isMobile && !sponsor.slug}
            className={
              isMainSponsor
                ? "mt-7 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-2xl transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
                : "mt-5 w-full rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 px-4 py-3 text-sm font-bold text-black shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            Read Their Story
          </button>
        )}
      </div>
    </div>
  );
}