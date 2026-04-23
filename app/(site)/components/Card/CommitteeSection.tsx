"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
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

export default function CommitteeSection({
  onlySection,
}: CommitteeSectionProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
                      className="object-cover"
                      style={{
                        objectPosition: `${member.image_position_x ?? 50}% ${
                          member.image_position_y ?? 50
                        }%`,
                      }}
                    />
                  </div>

                  <div className="space-y-4 p-5 text-white">
                    <div>
                      <h3 className="text-2xl font-bold">{member.full_name}</h3>
                      <p className="mt-1 text-base font-semibold text-white/90">
                        {member.role}
                      </p>
                    </div>

                    {member.pronouns ? (
                      <p className="text-sm font-medium text-white/85">
                        {member.pronouns}
                      </p>
                    ) : null}

                    {member.email ? (
                      <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/95">
                        {member.email}
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 pt-2">
                      <Link
                        href={`/committee/${member.id}`}
                        className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        View Profile
                      </Link>

                      {member.story ? (
                        <Link
                          href={`/committee/${member.id}#story`}
                          className="inline-flex items-center justify-center rounded-full bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-700"
                        >
                          Read Story
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}