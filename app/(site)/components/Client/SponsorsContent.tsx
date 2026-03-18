"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import SponsorCard from "../Card/SponsorCard";
import SponsorStoryModal from "../Client/Sponsors/SponsorStoryModal";
import type { Sponsor } from "@/types/sponsor";

type ApiResponse = {
  ok: boolean;
  sponsors?: Sponsor[];
  error?: string;
};

export default function SponsorsContent() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSponsors() {
      try {
        const res = await fetch("/api/sponsors/approved", {
          cache: "no-store",
        });

        const text = await res.text();
        const data: ApiResponse = text ? JSON.parse(text) : { ok: false };

        if (!res.ok) {
          console.error("Sponsors API error:", data?.error);
          setSponsors([]);
          return;
        }

        if (data.ok && Array.isArray(data.sponsors)) {
          setSponsors(data.sponsors);
        } else {
          setSponsors([]);
        }
      } catch (error) {
        console.error("Failed to load sponsors:", error);
        setSponsors([]);
      } finally {
        setLoading(false);
      }
    }

    loadSponsors();
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-4 pt-28 pb-16 text-white sm:px-6 md:px-10 md:pt-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">
              Our Sponsors
            </h1>

            <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/20 bg-white/10 px-6 py-4 shadow-lg backdrop-blur-md">
              <p className="text-base leading-8 text-white/95 sm:text-lg">
                A huge thank you to our sponsors for making{" "}
                <span className="font-extrabold text-yellow-300">Burton Pride</span>{" "}
                possible! Your support helps us celebrate diversity, inclusion,
                and love.
              </p>
            </div>
          </div>

          <section className="mt-16 rounded-[32px] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-10">
            <h2 className="text-center text-3xl font-extrabold sm:text-4xl">
              Proudly Supported By
            </h2>
            <p className="mt-4 text-center text-lg font-semibold text-white/90 sm:text-xl">
              Sponsors
            </p>

            {loading ? (
              <div className="py-16 text-center text-white/80">
                Loading sponsors...
              </div>
            ) : sponsors.length === 0 ? (
              <div className="py-16 text-center text-white/80">
                No sponsors to show yet.
              </div>
            ) : (
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sponsors.map((sponsor) => (
                  <SponsorCard
                    key={sponsor.id}
                    sponsor={sponsor}
                    onDesktopOpen={setSelectedSponsor}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="mx-auto mt-20 max-w-3xl text-center">
            <h3 className="text-3xl font-extrabold sm:text-4xl">
              Want to Sponsor Us?
            </h3>
            <p className="mt-5 text-lg leading-8 text-white/95 sm:text-xl">
              Join our amazing sponsors in making a difference! Support{" "}
              <span className="font-extrabold text-yellow-300">Burton Pride</span>{" "}
              and help create an unforgettable event.
            </p>

            <a
              href="/Collaborate"
              className="mt-8 inline-flex rounded-full bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 px-8 py-4 text-lg font-bold text-black shadow-xl transition hover:scale-[1.03]"
            >
              🤝 Become a Sponsor
            </a>
          </section>
        </div>
      </motion.div>

      <SponsorStoryModal
        sponsor={selectedSponsor}
        open={!!selectedSponsor}
        onClose={() => setSelectedSponsor(null)}
      />
    </>
  );
}