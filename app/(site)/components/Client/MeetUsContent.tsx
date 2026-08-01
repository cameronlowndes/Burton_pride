"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  type Variants,
} from "framer-motion";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
  visible: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.55,
      ease: "easeOut",
    },
  }),
};

function slugifyName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function clamp(
  number: number,
  minimum: number,
  maximum: number
) {
  return Math.min(Math.max(number, minimum), maximum);
}

function getImagePosition(member: Member) {
  const x =
    typeof member.image_position_x === "number"
      ? member.image_position_x
      : 50;

  const rawY =
    typeof member.image_position_y === "number"
      ? member.image_position_y
      : 50;

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
  if (!member) {
    return null;
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/75
            p-4
            backdrop-blur-md
            sm:p-6

            dark:bg-black/90
          "
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.97,
              y: 18,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: 18,
            }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
            onClick={(event) => event.stopPropagation()}
            className="
              relative
              max-h-[90vh]
              w-full
              max-w-4xl
              overflow-y-auto
              rounded-[32px]
              border
              border-white/20
              bg-gradient-to-br
              from-violet-700/95
              via-purple-700/95
              to-fuchsia-700/95
              p-6
              text-white
              shadow-[0_24px_80px_rgba(0,0,0,0.45)]
              backdrop-blur-xl
              sm:p-8

              dark:border-white/10
              dark:bg-none
              dark:bg-zinc-950
              dark:shadow-[0_24px_100px_rgba(0,0,0,0.9)]
            "
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-story-title"
          >
            <div
              className="
                pointer-events-none
                absolute
                inset-0
                bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_30%)]

                dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_35%)]
              "
            />

            <button
              type="button"
              onClick={onClose}
              className="
                absolute
                right-4
                top-4
                z-20
                rounded-full
                border
                border-white/20
                bg-white/15
                px-4
                py-2
                text-sm
                font-semibold
                text-white
                backdrop-blur
                transition
                hover:bg-white/25
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-white

                dark:border-white/10
                dark:bg-white/[0.06]
                dark:hover:bg-white/[0.12]
              "
            >
              Close
            </button>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div
                className="
                  relative
                  mb-5
                  h-28
                  w-28
                  overflow-hidden
                  rounded-full
                  border-4
                  border-white/70
                  shadow-[0_0_30px_rgba(255,255,255,0.18)]

                  dark:border-white/20
                  dark:shadow-[0_0_30px_rgba(255,255,255,0.08)]
                "
              >
                <Image
                  src={member.image_url || "/image/Logo.png"}
                  alt={member.full_name}
                  fill
                  unoptimized
                  sizes="112px"
                  style={{
                    objectFit: "cover",
                    objectPosition: getImagePosition(member),
                  }}
                />
              </div>

              <h2
                id="team-story-title"
                className="
                  text-3xl
                  font-extrabold
                  text-white
                  drop-shadow
                  sm:text-4xl
                "
              >
                {member.full_name}
              </h2>

              <p className="mt-2 text-lg font-semibold text-white/85">
                {member.role}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {member.pronouns ? (
                  <span
                    className="
                      rounded-full
                      border
                      border-pink-200/30
                      bg-white/15
                      px-4
                      py-2
                      text-sm
                      font-semibold
                      text-white

                      dark:border-white/10
                      dark:bg-white/[0.06]
                    "
                  >
                    {member.pronouns}
                  </span>
                ) : null}

                {member.section_title ? (
                  <span
                    className="
                      rounded-full
                      border
                      border-white/20
                      bg-white/15
                      px-4
                      py-2
                      text-sm
                      font-semibold
                      text-white/95

                      dark:border-white/10
                      dark:bg-white/[0.06]
                    "
                  >
                    {member.section_title}
                  </span>
                ) : null}
              </div>

              {member.email ? (
                <a
                  href={`mailto:${member.email}`}
                  className="
                    mt-5
                    rounded-2xl
                    border
                    border-white/25
                    bg-black/20
                    px-5
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-black/30

                    dark:border-white/10
                    dark:bg-black
                    dark:hover:bg-zinc-900
                  "
                >
                  {member.email}
                </a>
              ) : null}

              {member.story_title ? (
                <h3 className="mt-8 text-2xl font-bold text-white">
                  {member.story_title}
                </h3>
              ) : null}
            </div>

            <div
              className="
                relative
                z-10
                mt-6
                space-y-5
                text-base
                leading-8
                text-white/90
                sm:text-lg

                dark:text-zinc-200
              "
            >
              {(member.story ?? "")
                .split("\n")
                .filter((paragraph) => paragraph.trim())
                .map((paragraph, index) => (
                  <p key={`${member.id}-story-${index}`}>
                    {paragraph}
                  </p>
                ))}

              {!member.story?.trim() ? (
                <p className="italic text-white/70 dark:text-zinc-400">
                  Story coming soon.
                </p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
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
  const hasStory = Boolean(member.story?.trim());

  return (
    <div className="mt-auto flex flex-col gap-3 pt-6">
      <Link
        href={`/team/${slugifyName(member.full_name)}`}
        className="
          inline-flex
          items-center
          justify-center
          rounded-full
          border
          border-white/25
          bg-white/10
          px-6
          py-3
          text-sm
          font-bold
          text-white
          transition
          hover:bg-white/20
          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-white

          dark:border-white/15
          dark:bg-white/[0.05]
          dark:hover:bg-white/[0.1]
        "
      >
        View Profile
      </Link>

      {hasStory ? (
        <button
          type="button"
          onClick={() => onOpenStory(member)}
          className="
            inline-flex
            items-center
            justify-center
            rounded-full
            bg-gradient-to-r
            from-pink-600
            via-fuchsia-600
            to-rose-700
            px-6
            py-3
            text-sm
            font-bold
            text-white
            shadow-lg
            transition
            hover:scale-[1.01]
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-white

            dark:bg-none
            dark:bg-zinc-800
            dark:ring-1
            dark:ring-white/15
            dark:hover:bg-zinc-700
          "
        >
          Read Story
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="
            inline-flex
            cursor-not-allowed
            items-center
            justify-center
            rounded-full
            border
            border-white/15
            bg-white/10
            px-6
            py-3
            text-sm
            font-bold
            text-white/60

            dark:border-white/10
            dark:bg-white/[0.03]
            dark:text-white/40
          "
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
      viewport={{
        once: true,
        amount: 0.18,
      }}
      variants={fadeUp}
      className="h-full"
    >
      <article
        className="
          flex
          h-full
          flex-col
          overflow-hidden
          rounded-[32px]
          border
          border-violet-300/40
          bg-gradient-to-br
          from-violet-500
          via-purple-500
          to-fuchsia-500
          text-white
          shadow-[0_20px_60px_rgba(0,0,0,0.14)]
          transition
          duration-300
          hover:-translate-y-1
          hover:shadow-[0_24px_70px_rgba(0,0,0,0.18)]

          dark:border-white/10
          dark:bg-none
          dark:bg-zinc-950
          dark:shadow-[0_20px_60px_rgba(0,0,0,0.65)]
          dark:hover:border-white/20
          dark:hover:bg-zinc-900
          dark:hover:shadow-[0_24px_80px_rgba(0,0,0,0.85)]
        "
      >
        <div className="relative aspect-[4/3] w-full bg-zinc-900">
          <Image
            src={member.image_url || "/image/Logo.png"}
            alt={member.full_name}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            style={{
              objectFit: "cover",
              objectPosition: getImagePosition(member),
            }}
          />

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-t
              from-black/30
              via-black/5
              to-transparent

              dark:from-black/70
              dark:via-black/10
            "
          />
        </div>

        <div className="flex flex-1 flex-col p-6 text-white">
          <h3 className="text-2xl font-extrabold leading-tight text-white">
            {member.full_name}
          </h3>

          <p className="mt-2 text-base font-semibold text-white/90">
            {member.role}
          </p>

          {member.pronouns ? (
            <div className="mt-4">
              <span
                className="
                  inline-flex
                  rounded-full
                  border
                  border-white/20
                  bg-white/10
                  px-4
                  py-2
                  text-sm
                  font-semibold
                  text-white

                  dark:border-white/10
                  dark:bg-white/[0.05]
                "
              >
                {member.pronouns}
              </span>
            </div>
          ) : null}

          {member.email ? (
            <a
              href={`mailto:${member.email}`}
              className="
                mt-4
                inline-flex
                w-fit
                max-w-full
                rounded-2xl
                border
                border-white/20
                bg-black/15
                px-4
                py-3
                text-sm
                font-semibold
                text-white/95
                transition
                hover:bg-black/25

                dark:border-white/10
                dark:bg-black
                dark:hover:bg-zinc-900
              "
            >
              <span className="truncate">{member.email}</span>
            </a>
          ) : null}

          <CardButtons
            member={member}
            onOpenStory={onOpenStory}
          />
        </div>
      </article>
    </motion.div>
  );
}

export default function MeetUsContent() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStoryMember, setActiveStoryMember] =
    useState<Member | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMembers() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/committee", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const data =
          (await response.json()) as CommitteeApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error || "Failed to load committee members"
          );
        }

        setMembers(
          (data.members ?? []).filter(
            (member) => member.is_published
          )
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load members"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      controller.abort();
    };
  }, []);

  const sections = useMemo<Section[]>(() => {
    const grouped = new Map<string, Member[]>();

    for (const member of members) {
      const title =
        member.section_title?.trim() || "Committee";

      const existingMembers = grouped.get(title) ?? [];

      grouped.set(title, [...existingMembers, member]);
    }

    return Array.from(grouped.entries()).map(
      ([title, groupedMembers]) => ({
        title,
        members: [...groupedMembers].sort(
          (firstMember, secondMember) =>
            (firstMember.display_order ?? 999) -
            (secondMember.display_order ?? 999)
        ),
      })
    );
  }, [members]);

  const boardSection = sections.find(
    (section) => section.title === "Committed Board"
  );

  const otherSections = sections.filter(
    (section) => section.title !== "Committed Board"
  );

  return (
    <>
      <div
        className="
          min-h-screen
          px-4
          pb-24
          pt-8
          text-slate-900
          transition-colors
          duration-300
          sm:px-8
          lg:px-12

          dark:text-white
        "
      >
        <div className="mx-auto max-w-7xl">
          <motion.header
            initial={{
              opacity: 0,
              y: 22,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
            }}
            className="
              relative
              mt-16
              overflow-hidden
              rounded-[36px]
              border
              border-slate-200
              bg-gradient-to-br
              from-violet-500
              via-purple-500
              to-fuchsia-500
              px-6
              py-12
              text-white
              shadow-[0_25px_80px_rgba(0,0,0,0.12)]
              sm:mt-10
              sm:px-10
              sm:py-16
              lg:px-14

              dark:border-white/10
              dark:bg-none
              dark:bg-zinc-950
              dark:shadow-[0_25px_90px_rgba(0,0,0,0.75)]
            "
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div
                className="
                  mb-6
                  overflow-hidden
                  rounded-full
                  border-4
                  border-white/80
                  shadow-[0_0_45px_rgba(255,255,255,0.35)]

                  dark:border-white/20
                  dark:shadow-[0_0_45px_rgba(255,255,255,0.08)]
                "
              >
                <Image
                  src="/image/Logo.png"
                  alt="Burton Pride Team"
                  width={150}
                  height={150}
                  priority
                  className="
                    h-[130px]
                    w-[130px]
                    rounded-full
                    object-cover
                    sm:h-[150px]
                    sm:w-[150px]
                  "
                />
              </div>

              <h1
                className="
                  mt-4
                  max-w-5xl
                  text-4xl
                  font-black
                  leading-tight
                  text-white
                  sm:text-5xl
                  lg:text-6xl
                "
              >
                Meet the Burton Pride Team
              </h1>

              <p
                className="
                  mt-6
                  max-w-3xl
                  text-base
                  leading-8
                  text-white/90
                  sm:text-lg

                  dark:text-zinc-300
                "
              >
                Meet the people behind Burton Pride, learn more about
                our team, and discover the stories that help shape our
                community.
              </p>
            </div>
          </motion.header>

          {loading ? (
            <div
              className="
                mt-12
                rounded-3xl
                border
                border-slate-200
                bg-slate-50
                px-6
                py-5
                text-center
                text-lg
                text-slate-900
                shadow-sm
                transition-colors

                dark:border-white/10
                dark:bg-zinc-950
                dark:text-white
                dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)]
              "
              role="status"
            >
              Loading team members...
            </div>
          ) : null}

          {error ? (
            <div
              className="
                mt-12
                rounded-3xl
                border
                border-red-200
                bg-red-50
                px-6
                py-5
                text-center
                text-lg
                text-red-700
                shadow-sm

                dark:border-red-500/25
                dark:bg-red-950/40
                dark:text-red-200
              "
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {!loading && !error && boardSection ? (
            <section className="mt-16">
              <div className="mb-8 text-center">
                <h2
                  className="
                    mt-2
                    text-3xl
                    font-black
                    text-slate-900
                    sm:text-4xl

                    dark:text-white
                  "
                >
                  {boardSection.title}
                </h2>
              </div>

              <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
                {boardSection.members.map(
                  (member, index) => (
                    <CommitteeMemberCard
                      key={member.id}
                      member={member}
                      index={index}
                      onOpenStory={setActiveStoryMember}
                    />
                  )
                )}
              </div>
            </section>
          ) : null}

          {!loading && !error
            ? otherSections.map((section, sectionIndex) => (
                <section
                  key={`${section.title}-${sectionIndex}`}
                  className="mt-20"
                >
                  <div className="mb-8 text-center">
                    <h2
                      className="
                        mt-2
                        text-3xl
                        font-black
                        text-slate-900
                        sm:text-4xl

                        dark:text-white
                      "
                    >
                      {section.title}
                    </h2>
                  </div>

                  <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
                    {section.members.map(
                      (member, index) => (
                        <CommitteeMemberCard
                          key={member.id}
                          member={member}
                          index={index + 100}
                          onOpenStory={setActiveStoryMember}
                        />
                      )
                    )}
                  </div>
                </section>
              ))
            : null}

          {!loading && !error && sections.length === 0 ? (
            <div
              className="
                mt-16
                rounded-3xl
                border
                border-slate-200
                bg-slate-50
                px-6
                py-10
                text-center
                text-lg
                text-slate-700

                dark:border-white/10
                dark:bg-zinc-950
                dark:text-zinc-300
              "
            >
              No published team members are currently available.
            </div>
          ) : null}

          <motion.section
            initial={{
              opacity: 0,
              y: 24,
            }}
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{ once: true }}
            transition={{
              duration: 0.55,
              ease: "easeOut",
            }}
            className="
              mt-20
              overflow-hidden
              rounded-[34px]
              border
              border-slate-200
              bg-slate-50
              p-8
              text-center
              shadow-sm
              transition-colors
              sm:p-10
              lg:p-12

              dark:border-white/10
              dark:bg-zinc-950
              dark:text-white
              dark:shadow-[0_20px_60px_rgba(0,0,0,0.65)]
            "
          >
            <h2
              className="
                text-3xl
                font-black
                text-slate-900
                sm:text-4xl
                lg:text-5xl

                dark:text-white
              "
            >
              Want to Connect?
            </h2>

            <p
              className="
                mx-auto
                mt-5
                max-w-3xl
                text-base
                leading-8
                text-slate-600
                sm:text-lg

                dark:text-zinc-300
              "
            >
              Reach out to us for collaborations, volunteering,
              sponsorship, partnerships, or general enquiries.
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                href="/ContactUS"
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-full
                  bg-gradient-to-r
                  from-yellow-300
                  via-pink-400
                  to-purple-500
                  px-8
                  py-4
                  text-lg
                  font-bold
                  text-black
                  shadow-lg
                  transition
                  hover:scale-[1.03]
                  hover:shadow-[0_0_35px_rgba(168,85,247,0.18)]
                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-purple-500
                  focus-visible:ring-offset-2

                  dark:bg-none
                  dark:bg-white
                  dark:text-black
                  dark:hover:bg-zinc-200
                  dark:focus-visible:ring-white
                  dark:focus-visible:ring-offset-black
                "
              >
                🌟 Contact Us
              </Link>
            </div>
          </motion.section>
        </div>
      </div>

      <TeamStoryModal
        member={activeStoryMember}
        open={Boolean(activeStoryMember)}
        onClose={() => setActiveStoryMember(null)}
      />
    </>
  );
}