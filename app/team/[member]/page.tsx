"use client";

import { useParams, useRouter } from "next/navigation";
import { sections } from "@/data/TeamData";

export default function TeamMemberPage() {
  const params = useParams();
  const router = useRouter();
  const memberName = params.member as string;

  const member = sections
    .flatMap((section) => section.members)
    .find((m) => m.name.replace(/\s+/g, "-").toLowerCase() === memberName);

  if (!member) {
    return <p className="text-white p-8">Member not found</p>;
  }

  const storyLines =
    member.story?.trim()
      ? member.story.split("\n").filter((line) => line.trim())
      : [];

  return (
    <div
      className="
        min-h-screen
        flex flex-col items-center
        px-6
        pt-[calc(env(safe-area-inset-top)+96px)]
        pb-24
      "
    >
      {/* IMAGE */}
      <img
        src={member.image}
        alt={member.name}
        className="w-40 h-40 rounded-full mb-6 object-cover shadow-[0_0_30px_rgba(236,72,153,0.9)]"
      />

      {/* NAME */}
      <h1 className="text-4xl font-bold text-white mb-2 text-center">
        {member.name}
      </h1>

      {/* ROLE */}
      <h2 className="text-xl text-white/80 mb-6 text-center">{member.role}</h2>

      {/* STORY TITLE */}
      {member.storyTitle && (
        <h2 className="text-2xl font-bold text-yellow-300 mb-4 text-center">
          {member.storyTitle}
        </h2>
      )}

      {/* STORY */}
      <div className="text-white max-w-2xl text-center space-y-4 leading-relaxed mb-10">
        {storyLines.length > 0 ? (
          storyLines.map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p className="text-white/80 italic">
            Story coming soon.
          </p>
        )}
      </div>

      {/* BACK BUTTON */}
      <button
        onClick={() => router.back()}
        className="
          mt-auto
          bg-white/20 hover:bg-white/30
          text-white px-6 py-3
          rounded-full font-semibold
          shadow-md transition
          backdrop-blur-md cursor-pointer
        "
      >
        ← Back to Team
      </button>
    </div>
  );
}
