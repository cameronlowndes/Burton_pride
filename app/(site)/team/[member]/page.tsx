"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  image_url: string | null;
  role: string;
  pronouns: string | null;
  section_title: string;
  story_title: string | null;
  story: string | null;
  display_order: number;
  is_published: boolean;
};

type CommitteeApiResponse = {
  ok: boolean;
  error?: string;
  members?: Member[];
};

function slugifyName(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export default function TeamMemberPage() {
  const params = useParams();
  const router = useRouter();
  const memberSlug = String(params.member || "");

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMembers() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/committee", {
          method: "GET",
          cache: "no-store",
        });

        const data: CommitteeApiResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load committee members");
        }

        setMembers(data.members || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load committee members"
        );
      } finally {
        setLoading(false);
      }
    }

    loadMembers();
  }, []);

  const member = useMemo(() => {
    return members.find(
      (item) => slugifyName(item.full_name) === memberSlug
    );
  }, [members, memberSlug]);

  const storyLines = useMemo(() => {
    if (!member?.story?.trim()) return [];
    return member.story
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [member]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-6 pb-24 pt-[calc(env(safe-area-inset-top)+96px)] text-white">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-white/20 bg-white/10 px-8 py-12 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-2xl font-bold">Loading team member...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-6 pb-24 pt-[calc(env(safe-area-inset-top)+96px)] text-white">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-red-300/30 bg-red-500/20 px-8 py-12 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="text-3xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-white/90">{error}</p>
          <button
            onClick={() => router.push("/MeetUs")}
            className="mt-6 rounded-full bg-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/30"
          >
            Back to Team
          </button>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-6 pb-24 pt-[calc(env(safe-area-inset-top)+96px)] text-white">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-white/20 bg-white/10 px-8 py-12 text-center shadow-2xl backdrop-blur-xl">
          <h1 className="text-3xl font-bold">Member not found</h1>
          <p className="mt-3 text-white/80">
            We couldn’t find that committee member.
          </p>
          <button
            onClick={() => router.push("/MeetUs")}
            className="mt-6 rounded-full bg-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/30"
          >
            Back to Team
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-6 pb-24 pt-[calc(env(safe-area-inset-top)+96px)] text-white">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[32px] border border-white/20 bg-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="bg-gradient-to-r from-white/10 to-white/5 px-6 py-10 sm:px-10 lg:px-14">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-white/25 blur-2xl" />
                <div className="relative overflow-hidden rounded-full border-4 border-white/70 shadow-[0_0_35px_rgba(255,255,255,0.35)]">
                  <Image
                    src={member.image_url || "/image/Logo.png"}
                    alt={member.full_name}
                    width={180}
                    height={180}
                    className="h-40 w-40 object-cover sm:h-44 sm:w-44"
                    unoptimized
                  />
                </div>
              </div>

              <h1 className="text-4xl font-extrabold leading-tight text-white drop-shadow sm:text-5xl">
                {member.full_name}
              </h1>

              <p className="mt-3 text-lg font-semibold text-white/95 sm:text-xl">
                {member.role}
              </p>

              {member.pronouns && (
                <div className="mt-4">
                  <span className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                    {member.pronouns}
                  </span>
                </div>
              )}

              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="mt-5 inline-block rounded-2xl border border-white/20 bg-black/15 px-5 py-3 text-center text-sm font-medium text-white/95 shadow-inner transition hover:bg-black/25 hover:text-white"
                >
                  <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                    Email
                  </span>
                  <span className="mt-1 block break-all text-sm font-semibold sm:text-base">
                    {member.email}
                  </span>
                </a>
              )}
            </div>
          </div>

          <div className="px-6 py-10 sm:px-10 lg:px-14">
            {member.story_title && (
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-yellow-300 sm:text-3xl">
                  {member.story_title}
                </h2>
              </div>
            )}

            <div className="mx-auto max-w-3xl space-y-5 text-center text-base leading-8 text-white/95 sm:text-lg">
              {storyLines.length > 0 ? (
                storyLines.map((paragraph, i) => (
                  <p
                    key={i}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-sm"
                  >
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 italic text-white/80">
                  Story coming soon.
                </p>
              )}
            </div>

            <div className="mt-10 flex justify-center">
              <button
                onClick={() => router.back()}
                className="rounded-full bg-white/20 px-8 py-3 font-semibold text-white shadow-md backdrop-blur-md transition hover:scale-[1.02] hover:bg-white/30"
              >
                ← Back to Team
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}