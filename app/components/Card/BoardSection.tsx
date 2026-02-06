"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { sections } from "@/data/TeamData";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" },
  }),
};

export default function BoardSection() {
  const board = sections.find((s) => s.title === "Committed Board");
  const [activeMember, setActiveMember] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!board) return null;

  const handleStoryClick = (member: any, index: number) => {
    if (!member.story) return;

    if (isMobile) {
      const query = encodeURIComponent(member.story);
      router.push(
        `/team/${member.name.replace(/\s+/g, "-").toLowerCase()}?story=${query}`
      );
    } else {
      setActiveMember(index);
    }
  };

  return (
    <>
      {/* BOARD GRID */}
      <section className="w-full max-w-6xl mx-auto mt-24 text-center">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="text-4xl font-bold mb-12 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]"
        >
          Committed Board
        </motion.h2>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {board.members.map((member, i) => (
            <motion.div
              key={i}
              className="bg-white/10 backdrop-blur-md text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/20 rounded-2xl p-6 flex flex-col items-center transition-all duration-300 hover:scale-105"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
            >
              <Image
                src={member.image}
                alt={member.name}
                width={120}
                height={120}
                className="w-28 h-28 rounded-full mb-4 object-cover shadow-[0_0_20px_rgba(255,255,255,0.6)]"
              />

              <h3 className="text-2xl font-semibold">{member.name}</h3>
              <p className="text-sm text-gray-200 mt-2">{member.role}</p>

              {member.story && (
                <button
                  onClick={() => handleStoryClick(member, i)}
                  className="mt-4 bg-gradient-to-r from-pink-600 via-pink-700 to-pink-800 text-white px-6 py-2 rounded-full font-semibold shadow-lg transition hover:scale-105 cursor-pointer"
                >
                  Read Story →
                </button>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* 💻 DESKTOP STORY MODAL */}
      {activeMember !== null &&
        board.members[activeMember].story &&
        !isMobile && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 bg-opacity-90 p-6"
            onClick={() => setActiveMember(null)}
          >
            <div
              className="relative max-w-3xl max-h-[80vh] overflow-y-auto rounded-3xl p-8 shadow-2xl bg-white/90 text-black border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* IMAGE + NAME */}
              <div className="flex flex-col items-center mb-6">
                <Image
                  src={board.members[activeMember].image}
                  alt={board.members[activeMember].name}
                  width={150}
                  height={150}
                  className="w-36 h-36 rounded-full object-cover mb-4 shadow-[0_0_25px_rgba(236,72,153,0.9)]"
                />

                <h2 className="text-3xl font-bold text-center">
                  {board.members[activeMember].name}
                </h2>

                <p className="text-center text-gray-600 mt-1">
                  {board.members[activeMember].role}
                </p>
              </div>

              {/* STORY */}
              <div className="text-lg leading-relaxed space-y-6">
                {board.members[activeMember].storyTitle && (
                  <h3 className="text-2xl font-bold text-pink-700 text-center mb-4">
                    {board.members[activeMember].storyTitle}
                  </h3>
                )}

                {board.members[activeMember].story
                  .split("\n")
                  .map((p, i) => (
                    <p key={i} className="text-gray-800">
                      {p}
                    </p>
                  ))}
              </div>

              {/* CLOSE */}
              <button
                onClick={() => setActiveMember(null)}
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
