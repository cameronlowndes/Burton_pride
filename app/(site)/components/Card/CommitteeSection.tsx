"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

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

type CommitteeSectionProps = {
  onlySection?: string;
  hideOtherSections?: boolean;
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
      duration: 0.45,
      ease: "easeInOut" as const,
    },
  }),
};

function slugifyName(value: string) {
  return value.replace(/\s+/g, "-").toLowerCase();
}

function groupMembers(members: Member[]): Section[] {
  const map = new Map<string, Member[]>();

  for (const member of members) {
    const key = (member.section_title || "Committee").trim() || "Committee";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(member);
  }

  return Array.from(map.entries()).map(([title, grouped]) => ({
    title,
    members: [...grouped].sort(
      (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
    ),
  }));
}

function getImagePosition(member: Member) {
  return `${member.image_position_x ?? 50}% ${member.image_position_y ?? 50}%`;
}

function MemberModal({
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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.22, ease: "easeOut" as const }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-white/20 bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 p-6 text-white shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/25"
            >
              Close
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="relative mb-5 h-32 w-32 overflow-hidden rounded-full border-4 border-white/70 shadow-xl">
                <Image
                  src={member.image_url || "/image/Logo.png"}
                  alt={member.full_name}
                  fill
                  unoptimized
                  className="object-cover"
                  style={{
                    objectPosition: getImagePosition(member),
                  }}
                />
              </div>

              <h2 className="text-4xl font-black text-white">
                {member.full_name}
              </h2>

              <p className="mt-2 text-lg font-bold text-white/85">
                {member.role}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {member.pronouns && (
                  <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold">
                    {member.pronouns}
                  </span>
                )}

                {member.section_title && (
                  <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm font-bold">
                    {member.section_title}
                  </span>
                )}
              </div>

              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="mt-5 rounded-2xl border border-white/25 bg-black/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-black/30"
                >
                  {member.email}
                </a>
              )}

              {member.story_title && (
                <h3 className="mt-8 text-2xl font-black text-yellow-300">
                  {member.story_title}
                </h3>
              )}
            </div>

            <div className="mt-8 space-y-5 text-base leading-8 text-white/90 sm:text-lg">
              {(member.story || "")
                .split("\n")
                .filter((p) => p.trim())
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}

              {!member.story?.trim() && (
                <p className="text-center italic text-white/70">
                  Story coming soon.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function CommitteeSection({ onlySection }: CommitteeSectionProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMember, setActiveMember] = useState<Member | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadMembers() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/committee", { cache: "no-store" });
        const json: CommitteeApiResponse = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Failed to load committee members");
        }

        if (!ignore) {
          const published = (json.members || []).filter((m) => m.is_published);

          const filtered = onlySection
            ? published.filter(
                (m) =>
                  (m.section_title || "").trim().toLowerCase() ===
                  onlySection.trim().toLowerCase()
              )
            : published;

          setMembers(filtered);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load committee members"
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      ignore = true;
    };
  }, [onlySection]);

  const sections = useMemo(() => groupMembers(members), [members]);

  if (loading) {
    return (
      <section className="w-full">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[420px] animate-pulse rounded-[28px] border border-white/15 bg-white/10"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="w-full">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-300/30 bg-rose-500/10 px-6 py-5 text-center text-white">
          {error}
        </div>
      </section>
    );
  }

  if (!sections.length) {
    return null;
  }

  return (
    <>
      <section className="w-full">
        <div className="mx-auto max-w-7xl space-y-14">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="mb-8 text-center text-3xl font-bold text-black sm:text-5xl">
                {section.title}
              </h2>

              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                {section.members.map((member, index) => (
                  <motion.article
                    key={member.id}
                    custom={index}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    variants={fadeUp}
                    className="overflow-hidden rounded-[30px] border border-white/20 bg-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-md"
                  >
                    <div className="relative h-[300px] w-full overflow-hidden">
                      <Image
                        src={member.image_url || "/image/Logo.png"}
                        alt={member.full_name}
                        fill
                        unoptimized
                        className="object-cover"
                        style={{
                          objectPosition: getImagePosition(member),
                        }}
                      />
                    </div>

                    <div className="space-y-4 p-5 text-white">
                      <div>
                        <h3 className="text-2xl font-bold">
                          {member.full_name}
                        </h3>

                        <p className="mt-1 text-base font-semibold text-white/90">
                          {member.role}
                        </p>
                      </div>

                      {member.pronouns && (
                        <p className="text-sm font-medium text-white/85">
                          {member.pronouns}
                        </p>
                      )}

                      {member.email && (
                        <div className="inline-flex max-w-full rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/95">
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}

                      <div className="flex flex-col gap-3 pt-2">
                        <Link
                          href={`/team/${slugifyName(member.full_name)}`}
                          className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                        >
                          View Profile
                        </Link>

                        {member.story ? (
                          <button
                            type="button"
                            onClick={() => setActiveMember(member)}
                            className="inline-flex items-center justify-center rounded-full bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-700"
                          >
                            Read Story
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white/60"
                          >
                            Story Coming Soon
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <MemberModal
        member={activeMember}
        open={!!activeMember}
        onClose={() => setActiveMember(null)}
      />
    </>
  );
}