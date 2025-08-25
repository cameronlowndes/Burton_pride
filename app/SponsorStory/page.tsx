"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SponsorStoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [name, setName] = useState<string>("");
  const [story, setStory] = useState<string[]>([]);

  useEffect(() => {
    const nameParam = searchParams.get("name") || "";
    const storyParam = searchParams.get("story") || "[]";

    setName(nameParam);
    try {
      setStory(JSON.parse(decodeURIComponent(storyParam)));
    } catch (e) {
      console.error("Failed to parse story", e);
      setStory([]);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br  text-white p-6 flex flex-col">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">{name}</h1>
        <button
          onClick={() => router.back()}
          className="text-lg font-semibold text-yellow-300 hover:underline"
        >
          ← Back
        </button>
      </header>

      <main className="flex-1 overflow-y-auto space-y-6">
        {story.map((paragraph, index) => (
          <p key={index} className="text-lg leading-relaxed">
            {paragraph}
          </p>
        ))}
      </main>

      <footer className="mt-6 text-center">
        <Link
          href="/Sponsor"
          className="bg-gradient-to-r from-pink-600 via-pink-700 to-pink-800 px-6 py-3 rounded-full text-white font-semibold shadow-lg hover:from-pink-700 hover:via-pink-800 hover:to-pink-900 transition transform hover:-translate-y-1 hover:scale-105"
        >
          Back to Sponsors
        </Link>
      </footer>
    </div>
  );
}
