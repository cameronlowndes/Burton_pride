"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  image_url: string | null;
  role: string;
  pronouns: string | null;
  section_title: string;
  story_title?: string | null;
  story: string | null;
  display_order: number;
  is_published: boolean;
  image_position_x: number | null;
  image_position_y: number | null;
};

type Section = {
  title: string;
  members: Member[];
};

type CommitteeApiResponse = {
  ok: boolean;
  error?: string;
  members?: Member[];
};

const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.55,
      ease: "easeOut" as const,
    },
  }),
};

function slugifyName(value: string) {
  return value.replace(/\s+/g, "-").toLowerCase();
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function getImagePosition(member: Member) {
  const x =
    typeof member.image_position_x === "number" ? member.image_position_x : 50;
  const rawY =
    typeof member.image_position_y === "number" ? member.image_position_y : 50;

  const y = clamp(rawY + 18, 0, 100);

  return `${x}% ${y}%`;
}

function TeamStoryModal({
  member,
  open,
  onClose,
}: {
  member: Member | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!member) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 18 }}
            transition={{ duration: 0.22, ease: "easeOut" as const }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/20 bg-gradient-to-br from-violet-700/95 via-purple-700/95 to-fuchsia-700/95 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_30%)]" />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              Close
            </button>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="relative mb-5 h-28 w-28 overflow-hidden rounded-full border-4 border-white/70 shadow-[0_0_30px_rgba(255,255,255,0.18)]">
                <Image
                  src={member.image_url || "/image/Logo.png"}
                  alt={member.full_name}
                  fill
                  unoptimized
                  style={{
                    objectFit: "cover",
                    objectPosition: getImagePosition(member),
                  }}
                />
              </div>

              <h2 className="text-3xl font-extrabold text-white drop-shadow sm:text-4xl">
                {member.full_name}
              </h2>

              <p className="mt-2 text-lg font-semibold text-white/85">
                {member.role}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {member.pronouns && (
                  <span className="rounded-full border border-pink-200/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white">
                    {member.pronouns}
                  </span>
                )}

                {member.section_title && (
                  <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-semibold text-white/95">
                    {member.section_title}
                  </span>
                )}
              </div>

              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="mt-5 rounded-2xl border border-white/25 bg-black/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/30"
                >
                  {member.email}
                </a>
              )}

              {member.story_title && (
                <h3 className="mt-8 text-2xl font-bold text-white">
                  {member.story_title}
                </h3>
              )}
            </div>

            <div className="relative z-10 mt-6 space-y-5 text-base leading-8 text-white/90 sm:text-lg">
              {(member.story ?? "")
                .split("\n")
                .filter((p) => p.trim())
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}

              {!member.story?.trim() && (
                <p className="italic text-white/70">Story coming soon.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CardButtons({
  member,
  onOpenStory,
}: {
  member: Member;
  onOpenStory: (member: Member) => void;
}) {
  const hasStory = !!member.story?.trim();

  return (
    <div className="mt-auto flex flex-col gap-3 pt-6">
      <Link
        href={`/team/${slugifyName(member.full_name)}`}
        className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
      >
        View Profile
      </Link>

      {hasStory ? (
        <button
          type="button"
          onClick={() => onOpenStory(member)}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-600 via-fuchsia-600 to-rose-700 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.01]"
        >
          Read Story
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-bold text-white/60"
        >
          Story Coming Soon
        </button>
      )}
    </div>
  );
}

function CommitteeMemberCard({
  member,
  index,
  onOpenStory,
}: {
  member: Member;
  index: number;
  onOpenStory: (member: Member) => void;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      variants={fadeUp}
      className="h-full"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-violet-300/40 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-[0_20px_60px_rgba(0,0,0,0.14)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
        <div className="relative aspect-[4/3] w-full">
          <Image
            src={member.image_url || "/image/Logo.png"}
            alt={member.full_name}
            fill
            unoptimized
            style={{
              objectFit: "cover",
              objectPosition: getImagePosition(member),
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
        </div>

        <div className="flex flex-1 flex-col p-6 text-white">
          <h3 className="text-2xl font-extrabold leading-tight">
            {member.full_name}
          </h3>

          <p className="mt-2 text-base font-semibold text-white/90">
            {member.role}
          </p>

          {member.pronouns && (
            <div className="mt-4">
              <span className="rounded-full px-4 py-2 text-sm font-semibold text-white">
                {member.pronouns}
              </span>
            </div>
          )}

          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="mt-4 inline-flex w-fit max-w-full rounded-2xl border border-white/20 bg-black/15 px-4 py-3 text-sm font-semibold text-white/95 transition hover:bg-black/25"
            >
              <span className="truncate">{member.email}</span>
            </a>
          )}

          <CardButtons member={member} onOpenStory={onOpenStory} />
        </div>
      </div>
    </motion.div>
  );
}

export default function MeetUsContent() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStoryMember, setActiveStoryMember] = useState<Member | null>(null);

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

        setMembers((data.members || []).filter((member) => member.is_published));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load members"
        );
      } finally {
        setLoading(false);
      }
    }

    loadMembers();
  }, []);

  const sections: Section[] = useMemo(() => {
    const grouped = new Map<string, Member[]>();

    for (const member of members) {
      const title = member.section_title?.trim() || "Committee";
      if (!grouped.has(title)) grouped.set(title, []);
      grouped.get(title)!.push(member);
    }

    return Array.from(grouped.entries()).map(([title, groupedMembers]) => ({
      title,
      members: [...groupedMembers].sort(
        (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
      ),
    }));
  }, [members]);

  const boardSection = sections.find(
    (section) => section.title === "Committed Board"
  );

  const otherSections = sections.filter(
    (section) => section.title !== "Committed Board"
  );

  return (
    <>
      <div className="min-h-screen px-4 pb-24 pt-8 text-slate-900 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <motion.header
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" as const }}
            className="relative mt-16 overflow-hidden rounded-[36px] border border-slate-200 bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 px-6 py-12 text-white shadow-[0_25px_80px_rgba(0,0,0,0.12)] sm:mt-10 sm:px-10 sm:py-16 lg:px-14"
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="mb-6 overflow-hidden rounded-full border-4 border-white/80 shadow-[0_0_45px_rgba(255,255,255,0.35)]">
                <Image
                  src="/image/Logo.png"
                  alt="Burton Pride Team"
                  width={150}
                  height={150}
                  className="h-[130px] w-[130px] rounded-full object-cover sm:h-[150px] sm:w-[150px]"
                />
              </div>

              <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
                Meet the Burton Pride Team
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-8 text-white/90 sm:text-lg">
                Meet the people behind Burton Pride, learn more about our team,
                and discover the stories that help shape our community.
              </p>
            </div>
          </motion.header>

          {loading && (
            <div className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 px-6 py-5 text-center text-lg shadow-sm">
              Loading team members...
            </div>
          )}

          {error && (
            <div className="mt-12 rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-center text-lg text-red-700 shadow-sm">
              {error}
            </div>
          )}

          {!loading && !error && boardSection && (
            <section className="mt-16">
              <div className="mb-8 text-center">
                <h2 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">
                  {boardSection.title}
                </h2>
              </div>

              <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
                {boardSection.members.map((member, i) => (
                  <CommitteeMemberCard
                    key={member.id}
                    member={member}
                    index={i}
                    onOpenStory={setActiveStoryMember}
                  />
                ))}
              </div>
            </section>
          )}

          {!loading &&
            !error &&
            otherSections.map((section, sIndex) => (
              <section key={`${section.title}-${sIndex}`} className="mt-20">
                <div className="mb-8 text-center">
                  <h2 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">
                    {section.title}
                  </h2>
                </div>

                <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
                  {section.members.map((member, i) => (
                    <CommitteeMemberCard
                      key={member.id}
                      member={member}
                      index={i + 100}
                      onOpenStory={setActiveStoryMember}
                    />
                  ))}
                </div>
              </section>
            ))}

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: "easeOut" as const }}
            className="mt-20 overflow-hidden rounded-[34px] border border-slate-200 bg-slate-50 p-8 text-center shadow-sm sm:p-10 lg:p-12"
          >
            <h2 className="text-3xl font-black text-slate-900 sm:text-4xl lg:text-5xl">
              Want to Connect?
            </h2>

            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
              Reach out to us for collaborations, volunteering, sponsorship,
              partnerships, or general enquiries.
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                href="/ContactUS"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 px-8 py-4 text-lg font-bold text-black shadow-lg transition hover:scale-[1.03] hover:shadow-[0_0_35px_rgba(168,85,247,0.18)]"
              >
                🌟 Contact Us
              </Link>
            </div>
          </motion.section>
        </div>
      </div>

      <TeamStoryModal
        member={activeStoryMember}
        open={!!activeStoryMember}
        onClose={() => setActiveStoryMember(null)}
      />
    </>
  );
}