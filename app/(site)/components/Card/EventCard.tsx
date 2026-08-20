"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  MapPin,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";

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

  if (Number.isNaN(d.getTime())) {
    return dateStr;
  }

  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTimeRange(
  startIso: string,
  endIso?: string | null,
) {
  const start = new Date(startIso);

  if (Number.isNaN(start.getTime())) {
    return "";
  }

  const startTime = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!endIso) {
    return startTime;
  }

  const end = new Date(endIso);

  if (Number.isNaN(end.getTime())) {
    return startTime;
  }

  const endTime = end.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${startTime} – ${endTime}`;
}

function isEventToday(eventIso: string) {
  const eventDate = new Date(eventIso);
  const now = new Date();

  return eventDate.toDateString() === now.toDateString();
}

function mapsLink(location?: string | null) {
  const cleanLocation = String(location || "").trim();

  if (!cleanLocation) {
    return "https://www.google.com/maps";
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(
    cleanLocation,
  )}`;
}

function isFreeEvent(event: EventRow) {
  return (
    event.is_free === true ||
    event.price_type === "free" ||
    (typeof event.price_gbp === "number" &&
      event.price_gbp <= 0)
  );
}

function getPriceLabel(event: EventRow) {
  if (isFreeEvent(event)) {
    return "Free";
  }

  if (
    typeof event.price_gbp === "number" &&
    event.price_gbp > 0
  ) {
    return `£${event.price_gbp.toFixed(2)}`;
  }

  if (event.price_type === "paid") {
    return "Paid event";
  }

  return null;
}

export default function EventPage() {
  const [modalImage, setModalImage] =
    useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !modalImage) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [modalImage, mounted]);

  useEffect(() => {
    if (!mounted || !modalImage) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalImage(null);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [modalImage, mounted]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/events", {
          cache: "no-store",
        });

        const json = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            json?.error ||
              "Failed to load Burton Pride events.",
          );
        }

        if (!cancelled) {
          setEvents(
            Array.isArray(json?.events)
              ? json.events
              : [],
          );
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Something went wrong while loading events.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => {
    return events
      .slice()
      .sort(
        (a, b) =>
          new Date(a.start_at).getTime() -
          new Date(b.start_at).getTime(),
      );
  }, [events]);

  return (
    <section
      id="events"
      className="
        mx-auto
        mt-8
        flex
        w-full
        max-w-7xl
        flex-col
        items-center
        px-4
        pb-24

        sm:px-6

        lg:px-8
      "
    >
      {/* =====================================================
          SECTION HEADING
          ===================================================== */}
      <div className="mb-8 w-full text-center sm:mb-10">
        <p
          className="
            text-sm
            font-black
            uppercase
            tracking-[0.18em]
            text-yellow-300
          "
        >
          What&apos;s Coming Up
        </p>

        <h2
          className="
            mt-2
            text-3xl
            font-black
            text-white

            sm:text-4xl
            lg:text-5xl
          "
        >
          Upcoming Events
        </h2>

        <p
          className="
            mx-auto
            mt-3
            max-w-2xl
            text-base
            leading-7
            text-white/80

            sm:text-lg
          "
        >
          Discover Burton Pride events, community
          gatherings and opportunities to come together.
        </p>
      </div>

      {/* =====================================================
          LOADING
          ===================================================== */}
      {loading && (
        <div
          className="
            flex
            w-full
            max-w-4xl
            items-center
            justify-center
            rounded-3xl
            border
            border-white/10
            bg-white/[0.06]
            px-6
            py-14
            text-center
            text-white/75
            shadow-xl
            backdrop-blur-xl
          "
        >
          <div>
            <div
              className="
                mx-auto
                h-10
                w-10
                animate-spin
                rounded-full
                border-4
                border-white/20
                border-t-yellow-300
              "
            />

            <p className="mt-4 font-bold">
              Loading Burton Pride events...
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          ERROR
          ===================================================== */}
      {error && (
        <div
          role="alert"
          className="
            w-full
            max-w-4xl
            rounded-3xl
            border
            border-red-400/30
            bg-red-500/10
            p-6
            text-center
            text-red-100
            shadow-xl
            backdrop-blur-xl
          "
        >
          <p className="font-black">
            We couldn&apos;t load the events
          </p>

          <p className="mt-2 text-sm text-red-100/80">
            {error}
          </p>
        </div>
      )}

      {/* =====================================================
          EVENT CARDS
          ===================================================== */}
      {!loading &&
        !error &&
        upcoming.length > 0 && (
          <div
            className="
              grid
              w-full
              gap-6

              md:grid-cols-2

              xl:grid-cols-3
            "
          >
            {upcoming.map((event) => {
              const today = isEventToday(
                event.start_at,
              );

              const freeEvent =
                isFreeEvent(event);

              const priceLabel =
                getPriceLabel(event);

              return (
                <article
                  key={event.id}
                  className={`
                    group
                    relative
                    flex
                    h-full
                    flex-col
                    overflow-hidden
                    rounded-[2rem]
                    border
                    bg-white/10
                    shadow-2xl
                    backdrop-blur-xl
                    transition
                    duration-300

                    hover:-translate-y-1
                    hover:shadow-[0_30px_80px_rgba(91,33,182,0.28)]

                    dark:bg-[#111827]/90
                    dark:shadow-black/30

                    ${
                      today
                        ? "border-yellow-300 ring-2 ring-yellow-300/30"
                        : "border-white/15 dark:border-white/10"
                    }
                  `}
                >
                  {/* Pride stripe */}
                  <div
                    aria-hidden="true"
                    className="
                      h-1.5
                      w-full
                      bg-gradient-to-r
                      from-pink-500
                      via-purple-500
                      to-blue-500
                    "
                  />

                  {/* =====================================================
                      IMAGE
                      ===================================================== */}
                  {event.image_url ? (
                    <button
                      type="button"
                      onClick={() =>
                        setModalImage(
                          event.image_url,
                        )
                      }
                      className="
                        relative
                        block
                        h-56
                        w-full
                        overflow-hidden
                        text-left

                        focus-visible:outline
                        focus-visible:outline-4
                        focus-visible:outline-offset-[-4px]
                        focus-visible:outline-yellow-300
                      "
                      aria-label={`Open image for ${event.title}`}
                    >
                      <img
                        src={event.image_url}
                        alt={`${event.title} event`}
                        className="
                          h-full
                          w-full
                          object-cover
                          transition
                          duration-500

                          group-hover:scale-105
                        "
                      />

                      <div
                        className="
                          pointer-events-none
                          absolute
                          inset-0
                          bg-gradient-to-t
                          from-black/60
                          via-black/5
                          to-transparent
                        "
                      />

                      <div
                        className="
                          absolute
                          bottom-4
                          left-4
                          flex
                          flex-wrap
                          gap-2
                        "
                      >
                        {today && (
                          <span
                            className="
                              rounded-full
                              bg-yellow-300
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              uppercase
                              tracking-wide
                              text-black
                              shadow-lg
                            "
                          >
                            Happening Today
                          </span>
                        )}

                        {priceLabel && (
                          <span
                            className="
                              rounded-full
                              bg-white/90
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              text-purple-800
                              shadow-lg
                              backdrop-blur-md
                            "
                          >
                            {priceLabel}
                          </span>
                        )}
                      </div>
                    </button>
                  ) : (
                    <div
                      className="
                        relative
                        flex
                        h-48
                        items-center
                        justify-center
                        overflow-hidden
                        bg-gradient-to-br
                        from-pink-500
                        via-purple-600
                        to-blue-600
                      "
                    >
                      <div
                        aria-hidden="true"
                        className="
                          absolute
                          -left-12
                          -top-12
                          h-40
                          w-40
                          rounded-full
                          bg-white/20
                          blur-3xl
                        "
                      />

                      <div className="relative text-center">
                        <Sparkles
                          className="
                            mx-auto
                            h-10
                            w-10
                            text-yellow-300
                          "
                        />

                        <p
                          className="
                            mt-3
                            text-sm
                            font-black
                            uppercase
                            tracking-[0.16em]
                            text-white
                          "
                        >
                          Burton Pride Event
                        </p>
                      </div>
                    </div>
                  )}

                  {/* =====================================================
                      CONTENT
                      ===================================================== */}
                  <div
                    className="
                      flex
                      flex-1
                      flex-col
                      p-5

                      sm:p-6
                    "
                  >
                    {/* Tags */}
                    {!event.image_url && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {today && (
                          <span
                            className="
                              rounded-full
                              bg-yellow-300
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              uppercase
                              tracking-wide
                              text-black
                            "
                          >
                            Today
                          </span>
                        )}

                        {priceLabel && (
                          <span
                            className="
                              rounded-full
                              border
                              border-white/15
                              bg-white/10
                              px-3
                              py-1.5
                              text-xs
                              font-black
                              text-white
                            "
                          >
                            {priceLabel}
                          </span>
                        )}
                      </div>
                    )}

                    <h3
                      className="
                        text-balance
                        text-2xl
                        font-black
                        leading-tight
                        text-white
                      "
                    >
                      {event.title}
                    </h3>

                    {event.description && (
                      <p
                        className="
                          mt-3
                          line-clamp-4
                          text-sm
                          leading-6
                          text-white/75

                          sm:text-base
                        "
                      >
                        {event.description}
                      </p>
                    )}

                    {/* =====================================================
                        EVENT DETAILS
                        ===================================================== */}
                    <div className="mt-6 grid gap-3">
                      <div
                        className="
                          flex
                          items-start
                          gap-3
                          rounded-2xl
                          border
                          border-white/10
                          bg-white/[0.06]
                          p-4
                        "
                      >
                        <CalendarDays
                          className="
                            mt-0.5
                            h-5
                            w-5
                            shrink-0
                            text-pink-300
                          "
                        />

                        <div>
                          <p
                            className="
                              text-xs
                              font-black
                              uppercase
                              tracking-wider
                              text-white/45
                            "
                          >
                            Date
                          </p>

                          <p
                            className="
                              mt-1
                              font-bold
                              text-white
                            "
                          >
                            {formatDate(
                              event.start_at,
                            )}
                          </p>
                        </div>
                      </div>

                      <div
                        className="
                          flex
                          items-start
                          gap-3
                          rounded-2xl
                          border
                          border-white/10
                          bg-white/[0.06]
                          p-4
                        "
                      >
                        <Clock3
                          className="
                            mt-0.5
                            h-5
                            w-5
                            shrink-0
                            text-yellow-300
                          "
                        />

                        <div>
                          <p
                            className="
                              text-xs
                              font-black
                              uppercase
                              tracking-wider
                              text-white/45
                            "
                          >
                            Time
                          </p>

                          <p
                            className="
                              mt-1
                              font-bold
                              text-white
                            "
                          >
                            {formatTimeRange(
                              event.start_at,
                              event.end_at,
                            )}
                          </p>
                        </div>
                      </div>

                      {event.location && (
                        <a
                          href={mapsLink(
                            event.location,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="
                            flex
                            items-start
                            gap-3
                            rounded-2xl
                            border
                            border-white/10
                            bg-white/[0.06]
                            p-4
                            transition

                            hover:border-green-300/30
                            hover:bg-white/10
                          "
                        >
                          <MapPin
                            className="
                              mt-0.5
                              h-5
                              w-5
                              shrink-0
                              text-green-300
                            "
                          />

                          <div className="min-w-0">
                            <p
                              className="
                                text-xs
                                font-black
                                uppercase
                                tracking-wider
                                text-white/45
                              "
                            >
                              Location
                            </p>

                            <p
                              className="
                                mt-1
                                break-words
                                font-bold
                                text-white
                              "
                            >
                              {event.location}
                            </p>

                            <p
                              className="
                                mt-1
                                text-xs
                                font-semibold
                                text-green-300
                              "
                            >
                              View on Google Maps
                            </p>
                          </div>
                        </a>
                      )}
                    </div>

                    {/* =====================================================
                        FREE BANNER
                        ===================================================== */}
                    {freeEvent && (
                      <div
                        className="
                          mt-5
                          rounded-2xl
                          border
                          border-yellow-300/40
                          bg-yellow-300
                          px-4
                          py-3
                          text-center
                          text-sm
                          font-black
                          text-purple-950
                          shadow-lg
                        "
                      >
                        🎉 Free and open to the public
                      </div>
                    )}

                    {/* =====================================================
                        ACTIONS
                        ===================================================== */}
                    <div
                      className="
                        mt-auto
                        grid
                        gap-3
                        pt-6

                        sm:grid-cols-2
                      "
                    >
                      {event.ticket_url && (
                        <Link
                          href={event.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="
                            inline-flex
                            min-h-12
                            items-center
                            justify-center
                            gap-2
                            rounded-full
                            bg-yellow-300
                            px-5
                            py-3
                            text-sm
                            font-black
                            text-purple-950
                            shadow-lg
                            transition

                            hover:scale-[1.02]
                            hover:bg-white
                          "
                        >
                          <Ticket className="h-4 w-4" />
                          Tickets
                        </Link>
                      )}

                      {event.website_url && (
                        <Link
                          href={event.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="
                            inline-flex
                            min-h-12
                            items-center
                            justify-center
                            gap-2
                            rounded-full
                            border
                            border-white/15
                            bg-white/10
                            px-5
                            py-3
                            text-sm
                            font-black
                            text-white
                            transition

                            hover:bg-white
                            hover:text-purple-700
                          "
                        >
                          <ExternalLink className="h-4 w-4" />
                          Website
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      {/* =====================================================
          NO EVENTS
          ===================================================== */}
      {!loading &&
        !error &&
        upcoming.length === 0 && (
          <div
            className="
              relative
              w-full
              max-w-4xl
              overflow-hidden
              rounded-[2rem]
              border
              border-white/15
              bg-gradient-to-br
              from-pink-500
              via-purple-600
              to-blue-600
              px-6
              py-14
              text-center
              shadow-2xl

              sm:px-10
              sm:py-16
            "
          >
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -left-20
                -top-20
                h-64
                w-64
                rounded-full
                bg-white/20
                blur-3xl
              "
            />

            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -bottom-24
                -right-20
                h-72
                w-72
                rounded-full
                bg-blue-300/20
                blur-3xl
              "
            />

            <div className="relative">
              <Sparkles
                className="
                  mx-auto
                  h-10
                  w-10
                  text-yellow-300
                "
              />

              <h3
                className="
                  mt-4
                  text-3xl
                  font-black
                  text-white

                  sm:text-4xl
                "
              >
                No Upcoming Events Right Now
              </h3>

              <p
                className="
                  mx-auto
                  mt-4
                  max-w-2xl
                  text-base
                  leading-7
                  text-white/90

                  sm:text-lg
                "
              >
                Burton Pride is always working behind the
                scenes on future community events. Follow
                us so you&apos;re the first to hear when
                something new is announced.
              </p>

              <Link
                href="https://www.facebook.com/profile.php?id=61556621159422"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  mt-7
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  rounded-full
                  bg-yellow-300
                  px-6
                  py-3
                  text-sm
                  font-black
                  text-purple-950
                  shadow-xl
                  transition

                  hover:scale-105
                  hover:bg-white
                "
              >
                Follow Burton Pride
              </Link>
            </div>
          </div>
        )}

      {/* =====================================================
          IMAGE MODAL
          ===================================================== */}
      {mounted &&
        modalImage &&
        createPortal(
          <div
            className="
              fixed
              inset-0
              z-[99999]
              flex
              items-center
              justify-center
              bg-black/95
              p-4
              backdrop-blur-md
            "
            onClick={() =>
              setModalImage(null)
            }
            role="dialog"
            aria-modal="true"
            aria-label="Event image viewer"
          >
            <div
              className="
                relative
                flex
                max-h-[95dvh]
                max-w-[95vw]
                flex-col
                items-center
              "
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                type="button"
                onClick={() =>
                  setModalImage(null)
                }
                className="
                  absolute
                  -right-2
                  -top-14
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-white/20
                  bg-white/10
                  text-white
                  shadow-xl
                  backdrop-blur-md
                  transition

                  hover:bg-white
                  hover:text-black
                "
                aria-label="Close image"
              >
                <X className="h-5 w-5" />
              </button>

              <img
                src={modalImage}
                alt="Enlarged event"
                className="
                  block
                  max-h-[88dvh]
                  max-w-[95vw]
                  rounded-2xl
                  object-contain
                  shadow-2xl
                "
              />

              <p
                className="
                  mt-3
                  text-center
                  text-sm
                  font-medium
                  text-white/70
                "
              >
                Click outside or press ESC to close
              </p>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}