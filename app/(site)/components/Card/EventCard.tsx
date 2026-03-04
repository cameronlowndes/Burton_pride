"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

type EventRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  image_url: string | null;
  ticket_url: string | null;
  website_url: string | null;
  is_published: boolean;
  is_free?: boolean | null;
  price_type?: "free" | "paid" | null;
  price_gbp?: number | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function formatTimeRange(startIso: string, endIso?: string | null) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "";
  const s = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!endIso) return s;

  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return s;

  const e = end.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${s} - ${e}`;
}

function isEventToday(eventIso: string) {
  const d = new Date(eventIso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function mapsLink(location?: string | null) {
  const loc = String(location || "").trim();
  return loc
    ? `https://www.google.com/maps?q=${encodeURIComponent(loc)}`
    : "https://www.google.com/maps";
}

function isFreeEvent(ev: EventRow) {
  return (
    ev.is_free === true ||
    ev.price_type === "free" ||
    (typeof ev.price_gbp === "number" && ev.price_gbp <= 0)
  );
}

export default function EventPage() {
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ✅ needed so createPortal doesn’t run during SSR/hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ✅ lock page scroll when modal open
  useEffect(() => {
    if (!mounted) return;
    if (!modalImage) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalImage, mounted]);

  // ✅ ESC key closes modal
  useEffect(() => {
    if (!mounted) return;
    if (!modalImage) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalImage, mounted]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/events", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(json?.error || "Failed to load events");

        if (!cancelled) setEvents(Array.isArray(json?.events) ? json.events : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => {
    return (events || [])
      .slice()
      .sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      );
  }, [events]);

  return (
    <section
      id="events"
      className="mt-8 text-center w-full flex flex-col items-center max-w-6xl mx-auto pb-24"
    >
      <h2 className="text-3xl font-semibold mb-6">Upcoming Events</h2>

      {loading && <div className="text-white/70">Loading…</div>}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 w-full max-w-4xl">
          {error}
        </div>
      )}

      {!loading && !error && upcoming.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6 w-full">
          {upcoming.map((ev) => {
            const today = isEventToday(ev.start_at);

            return (
              <div
                key={ev.id}
                className={`bg-white text-black p-6 rounded-lg shadow-md w-full max-w-sm transition-transform hover:scale-105 ${
                  today ? "border-4 border-yellow-400 shadow-yellow-300" : ""
                }`}
              >
                {ev.image_url && (
                  <button
                    type="button"
                    className="mb-4 w-full cursor-pointer"
                    onClick={() => setModalImage(ev.image_url!)}
                    aria-label="Open event image"
                  >
                    <img
                      src={ev.image_url}
                      alt={`${ev.title} image`}
                      className="w-full h-48 object-cover rounded-md hover:opacity-90 transition"
                    />
                  </button>
                )}

                <h3 className="text-xl font-bold">{ev.title}</h3>
                <p className="text-sm">{ev.description || ""}</p>

                <div className="mt-1">
                  <p className="text-pink-600 font-semibold">
                    {formatDate(ev.start_at)}
                  </p>
                  <p className="text-pink-600 font-semibold">
                    {formatTimeRange(ev.start_at, ev.end_at)}
                  </p>
                </div>

                {isFreeEvent(ev) && (
                  <div className="mt-4 bg-yellow-300 text-black text-base font-bold px-4 py-2 rounded shadow-md text-center">
                    🎉 This event is FREE and open to the public!
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  {ev.ticket_url && (
                    <Link href={ev.ticket_url} target="_blank">
                      <span className="text-blue-500 hover:underline cursor-pointer">
                        Tickets
                      </span>
                    </Link>
                  )}

                  {ev.website_url && (
                    <Link href={ev.website_url} target="_blank">
                      <span className="text-blue-500 hover:underline cursor-pointer">
                        Website
                      </span>
                    </Link>
                  )}
                </div>

                <div className="mt-4">
                  <a
                    href={mapsLink(ev.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-500 hover:underline"
                  >
                    View on Google Maps
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && upcoming.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-400 rounded-2xl shadow-lg w-full max-w-4xl">
          <h3 className="text-4xl font-extrabold text-white mb-4">
            🌈 No Upcoming Events Right Now
          </h3>
          <p className="text-lg text-white mb-6 max-w-2xl">
            But don’t worry – Burton Pride is always working behind the scenes to
            bring more events. 💖
          </p>
          <Link
            href="https://www.facebook.com/profile.php?id=61556621159422"
            target="_blank"
            className="bg-blue-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-blue-500 transition"
          >
            Follow us on Facebook
          </Link>
        </div>
      )}

      {/* ✅ TRUE fullscreen modal (Portal fixes “half out screen” issues) */}
      {mounted &&
        modalImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setModalImage(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative max-w-[95vw] max-h-[95vh]"
              onClick={(e) => e.stopPropagation()}
            >
             

              <img
                src={modalImage}
                alt="Enlarged Event"
                className="block max-w-[95vw] max-h-[95vh] w-auto h-auto rounded-lg object-contain shadow-2xl"
              />

              <p className="mt-3 text-center text-white/80 text-sm">
                Click outside or press ESC to close
              </p>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}