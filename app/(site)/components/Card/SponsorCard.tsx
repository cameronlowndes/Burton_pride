"use client";

import { useEffect, useMemo, useState } from "react";

type SponsorshipType = "Normal Sponsor" | "Sponsorship in Kind";

type Sponsor = {
  id: string;
  sponsor_name: string;
  sponsorship_type: SponsorshipType | string;
  website: string | null;
  logo_url: string | null;
};

type ApiResponse = {
  ok: boolean;
  sponsors?: Sponsor[];
  error?: string;
};

function sectionTitle(type: SponsorshipType) {
  return type === "Sponsorship in Kind" ? "Sponsorship in Kind" : "Sponsors";
}

function sponsorTypeLabel(type: string) {
  if (type === "Sponsorship in Kind") return "Sponsorship in Kind";
  return "Normal Sponsor";
}

export default function SponsorCard() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSponsors() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/sponsors/approved", {
          cache: "no-store",
        });

        const data: ApiResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load sponsors");
        }

        if (active) {
          setSponsors(data.sponsors || []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSponsors();

    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => {
    return {
      "Normal Sponsor": sponsors.filter(
        (s) => s.sponsorship_type === "Normal Sponsor"
      ),
      "Sponsorship in Kind": sponsors.filter(
        (s) => s.sponsorship_type === "Sponsorship in Kind"
      ),
    };
  }, [sponsors]);

  if (loading) {
    return (
      <div className="py-10 text-center text-white/80">
        Loading sponsors...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10 text-center text-red-200">
        {error}
      </div>
    );
  }

  if (sponsors.length === 0) {
    return (
      <div className="py-10 text-center text-white/80">
        No approved sponsors yet.
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {(["Normal Sponsor", "Sponsorship in Kind"] as const).map((type) => {
        const items = grouped[type];
        if (items.length === 0) return null;

        return (
          <section key={type} className="space-y-6">
            <h3 className="text-center text-2xl font-bold text-white">
              {sectionTitle(type)}
            </h3>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((sponsor) => {
                const content = (
                  <div className="group overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-5 shadow-xl backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/15">
                    <div className="flex h-44 items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
                      {sponsor.logo_url ? (
                        <img
                          src={sponsor.logo_url}
                          alt={sponsor.sponsor_name}
                          className="max-h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-center text-lg font-semibold text-slate-700">
                          {sponsor.sponsor_name}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-2 text-center">
                      <h4 className="text-xl font-bold text-white">
                        {sponsor.sponsor_name}
                      </h4>

                      <div className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-400/20 px-3 py-1 text-sm font-medium text-yellow-100">
                        {sponsorTypeLabel(sponsor.sponsorship_type)}
                      </div>

                      {sponsor.website && (
                        <div className="pt-2">
                          <span className="text-sm text-white/70 group-hover:text-white/90">
                            Visit sponsor website
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );

                return sponsor.website ? (
                  <a
                    key={sponsor.id}
                    href={sponsor.website}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={sponsor.sponsor_name}
                    className="block"
                  >
                    {content}
                  </a>
                ) : (
                  <div key={sponsor.id}>{content}</div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}