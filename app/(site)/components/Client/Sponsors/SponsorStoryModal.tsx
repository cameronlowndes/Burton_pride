"use client";

import { useEffect } from "react";
import Image from "next/image";
import type { Sponsor } from "@/types/sponsor";

type SponsorWithMain = Sponsor & {
  is_main_sponsor?: boolean | null;
  sponsor_display_type?: string | null;
  sponsorship_type?: string | null;
  logo_link?: string | null;
  sponsor_name?: string | null;
  story?: string | null;
  message?: string | null;
};

type Props = {
  sponsor: SponsorWithMain | null;
  open: boolean;
  onClose: () => void;
};

function sponsorBadge(sponsor: SponsorWithMain) {
  if (Boolean(sponsor.is_main_sponsor)) {
    return "Main Sponsor";
  }

  if (sponsor.sponsor_display_type) {
    return sponsor.sponsor_display_type;
  }

  const type = sponsor.sponsorship_type;

  if (!type) return "Sponsor";

  const value = type.toLowerCase();

  if (value.includes("gold")) return "Gold Sponsor";
  if (value.includes("silver")) return "Silver Sponsor";
  if (value.includes("bronze")) return "Bronze Sponsor";

  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  const isMainSponsor = Boolean(sponsor.is_main_sponsor);
  const sponsorName = sponsor.sponsor_name || "Sponsor";
  const sponsorStory =
    String(sponsor.story || sponsor.message || "").trim() ||
    "No sponsor story has been added yet.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={
          isMainSponsor
            ? "relative z-10 w-full max-w-4xl overflow-hidden rounded-[34px] border-4 border-yellow-300 bg-gradient-to-br from-yellow-300 via-orange-200 to-pink-200 p-1 shadow-[0_0_70px_rgba(250,204,21,0.65)]"
            : "relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl"
        }
      >
        <button
          type="button"
          onClick={onClose}
          className={
            isMainSponsor
              ? "absolute right-4 top-4 z-20 rounded-full bg-purple-950 px-3 py-1 text-sm font-bold text-yellow-300 shadow-lg hover:bg-purple-900"
              : "absolute right-4 top-4 z-20 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white hover:bg-white/25"
          }
        >
          ✕
        </button>

        <div
          className={
            isMainSponsor
              ? "relative overflow-hidden rounded-[30px] bg-white/90 backdrop-blur-xl"
              : ""
          }
        >
          {isMainSponsor && (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.35),transparent_40%)]" />
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-300/50 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-pink-400/30 blur-3xl" />
            </>
          )}

          <div
            className={
              isMainSponsor
                ? "relative grid gap-0 md:grid-cols-[320px_1fr]"
                : "grid gap-0 md:grid-cols-[280px_1fr]"
            }
          >
            <div
              className={
                isMainSponsor
                  ? "flex items-center justify-center p-7"
                  : "flex items-center justify-center bg-white/10 p-6"
              }
            >
              <div
                className={
                  isMainSponsor
                    ? "relative h-60 w-full max-w-[260px] overflow-hidden rounded-3xl border-4 border-yellow-300 bg-white shadow-2xl shadow-yellow-500/40"
                    : "relative h-48 w-full max-w-[220px] overflow-hidden rounded-2xl bg-white"
                }
              >
                {sponsor.logo_link ? (
                  <Image
                    src={sponsor.logo_link}
                    alt={sponsorName}
                    fill
                    className={
                      isMainSponsor
                        ? "object-contain p-7"
                        : "object-contain p-4"
                    }
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500">
                    No logo
                  </div>
                )}
              </div>
            </div>

            <div
              className={
                isMainSponsor
                  ? "p-7 text-purple-950 md:p-9"
                  : "p-6 text-white md:p-8"
              }
            >
              <div className="mb-4">
                <span
                  className={
                    isMainSponsor
                      ? "inline-flex rounded-full bg-yellow-400 px-5 py-2 text-xs font-black uppercase tracking-[0.24em] text-purple-950 shadow-xl ring-4 ring-yellow-200"
                      : "inline-flex rounded-full border border-yellow-300/20 bg-yellow-400/20 px-3 py-1 text-xs font-semibold text-yellow-200"
                  }
                >
                  {sponsorBadge(sponsor)}
                </span>
              </div>

              <h2
                className={
                  isMainSponsor
                    ? "text-4xl font-black leading-tight text-purple-950 md:text-5xl"
                    : "text-3xl font-extrabold leading-tight"
                }
              >
                {sponsorName}
              </h2>

              {isMainSponsor && (
                <div className="mt-4">
                  <span className="inline-flex rounded-full bg-purple-950 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-yellow-300 shadow-lg">
                    Proud Main Sponsor of Burton Pride
                  </span>
                </div>
              )}

              <p
                className={
                  isMainSponsor
                    ? "mt-6 whitespace-pre-line text-base font-semibold leading-8 text-purple-900/90"
                    : "mt-5 whitespace-pre-line text-base leading-7 text-white/90"
                }
              >
                {sponsorStory}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}