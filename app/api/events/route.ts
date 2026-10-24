import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RepeatRule =
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "triweekly"
  | "monthly";

type EventRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;

  start_at: string;
  end_at: string | null;

  image_url: string | null;
  ticket_url: string | null;
  website_url: string | null;

  is_published: boolean;
  is_planning: boolean | null;

  repeat_rule: RepeatRule | null;

  price_type: "free" | "paid" | null;
  price_gbp: number | null;
  is_free: boolean | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

function addRepeatInterval(
  date: Date,
  repeatRule: RepeatRule,
): Date {
  const next = new Date(date.getTime());

  switch (repeatRule) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;

    case "weekly":
      next.setDate(next.getDate() + 7);
      break;

    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;

    case "triweekly":
      next.setDate(next.getDate() + 21);
      break;

    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;

    case "none":
    default:
      break;
  }

  return next;
}

function getCurrentOrNextOccurrence(
  event: EventRow,
  now: Date,
) {
  const originalStart = new Date(
    event.start_at,
  );

  if (
    Number.isNaN(
      originalStart.getTime(),
    )
  ) {
    return null;
  }

  let originalEnd: Date | null = null;

  if (event.end_at) {
    const parsedEnd =
      new Date(event.end_at);

    if (
      !Number.isNaN(
        parsedEnd.getTime(),
      )
    ) {
      originalEnd = parsedEnd;
    }
  }

  const repeatRule: RepeatRule =
    event.repeat_rule || "none";
  const originalStartIso =
    originalStart.toISOString();

  const originalEndIso =
    originalEnd
      ? originalEnd.toISOString()
      : null;


  if (repeatRule === "none") {
    if (originalEnd) {
      if (
        originalEnd.getTime() <
        now.getTime()
      ) {
        return null;
      }

      return {
        ...event,

        original_start_at:
          originalStartIso,

        original_end_at:
          originalEndIso,

        start_at:
          originalStartIso,

        end_at:
          originalEndIso,

        occurrence_start_at:
          originalStartIso,

        occurrence_end_at:
          originalEndIso,

        is_repeating: false,

        is_current_occurrence:
          originalStart.getTime() <=
            now.getTime() &&
          originalEnd.getTime() >=
            now.getTime(),
      };
    }

   
    if (
      originalStart.getTime() <
      now.getTime()
    ) {
      return null;
    }

    return {
      ...event,

      original_start_at:
        originalStartIso,

      original_end_at: null,

      start_at:
        originalStartIso,

      end_at: null,

      occurrence_start_at:
        originalStartIso,

      occurrence_end_at: null,

      is_repeating: false,
      is_current_occurrence: false,
    };
  }


  const durationMs =
    originalEnd
      ? Math.max(
          0,
          originalEnd.getTime() -
            originalStart.getTime(),
        )
      : 0;

  let occurrenceStart =
    new Date(
      originalStart.getTime(),
    );
  if (
    occurrenceStart.getTime() >
    now.getTime()
  ) {
    const occurrenceEnd =
      durationMs > 0
        ? new Date(
            occurrenceStart.getTime() +
              durationMs,
          )
        : null;

    const occurrenceStartIso =
      occurrenceStart.toISOString();

    const occurrenceEndIso =
      occurrenceEnd
        ? occurrenceEnd.toISOString()
        : null;

    return {
      ...event,

      original_start_at:
        originalStartIso,

      original_end_at:
        originalEndIso,

      /*
       * Public start_at represents
       * the occurrence being displayed.
       */
      start_at:
        occurrenceStartIso,

      end_at:
        occurrenceEndIso,

      occurrence_start_at:
        occurrenceStartIso,

      occurrence_end_at:
        occurrenceEndIso,

      is_repeating: true,
      is_current_occurrence: false,
    };
  }

  let safety = 0;

  while (safety < 10000) {
    const nextStart =
      addRepeatInterval(
        occurrenceStart,
        repeatRule,
      );

    if (
      nextStart.getTime() >
      now.getTime()
    ) {
      break;
    }

    occurrenceStart =
      nextStart;

    safety += 1;
  }

  if (safety >= 10000) {
    console.error(
      "Repeat event exceeded safety limit:",
      event.id,
    );

    return null;
  }

  let occurrenceEnd =
    durationMs > 0
      ? new Date(
          occurrenceStart.getTime() +
            durationMs,
        )
      : null;

  const currentOccurrenceRunning =
    occurrenceStart.getTime() <=
      now.getTime() &&
    occurrenceEnd !== null &&
    occurrenceEnd.getTime() >=
      now.getTime();

  if (currentOccurrenceRunning) {
    const occurrenceStartIso =
      occurrenceStart.toISOString();

    const occurrenceEndIso =
      occurrenceEnd
        ? occurrenceEnd.toISOString()
        : null;

    return {
      ...event,

      original_start_at:
        originalStartIso,

      original_end_at:
        originalEndIso,

      start_at:
        occurrenceStartIso,

      end_at:
        occurrenceEndIso,

      occurrence_start_at:
        occurrenceStartIso,

      occurrence_end_at:
        occurrenceEndIso,

      is_repeating: true,
      is_current_occurrence: true,
    };
  }
  if (
    occurrenceEnd &&
    occurrenceEnd.getTime() <
      now.getTime()
  ) {
    occurrenceStart =
      addRepeatInterval(
        occurrenceStart,
        repeatRule,
      );

    occurrenceEnd =
      durationMs > 0
        ? new Date(
            occurrenceStart.getTime() +
              durationMs,
          )
        : null;
  }
  if (
    !occurrenceEnd &&
    occurrenceStart.getTime() <
      now.getTime()
  ) {
    occurrenceStart =
      addRepeatInterval(
        occurrenceStart,
        repeatRule,
      );
  }

  const occurrenceStartIso =
    occurrenceStart.toISOString();

  const occurrenceEndIso =
    occurrenceEnd
      ? occurrenceEnd.toISOString()
      : null;

  return {
    ...event,
    original_start_at:
      originalStartIso,

    original_end_at:
      originalEndIso,

    start_at:
      occurrenceStartIso,

    end_at:
      occurrenceEndIso,

    occurrence_start_at:
      occurrenceStartIso,

    occurrence_end_at:
      occurrenceEndIso,

    is_repeating: true,
    is_current_occurrence: false,
  };
}

export async function GET() {
  try {
    /*
     * Generate "now" once so every event
     * is calculated against exactly the
     * same timestamp.
     */
    const now = new Date();

    const {
      data,
      error,
    } = await supabase
      .from("events")
      .select(
        `
        id,
        title,
        slug,
        description,
        location,
        start_at,
        end_at,
        image_url,
        ticket_url,
        website_url,
        is_published,
        is_planning,
        repeat_rule,
        price_type,
        price_gbp,
        is_free
        `,
      )
      .eq("is_published", true);

    if (error) {
      console.error(
        "Failed to load public events:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Failed to load events",
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, max-age=0",

            Pragma: "no-cache",
            Expires: "0",
          },
        },
      );
    }

    const events =
      ((data || []) as EventRow[])
        .map((event) =>
          getCurrentOrNextOccurrence(
            event,
            now,
          ),
        )
        .filter(
          (
            event,
          ): event is NonNullable<
            ReturnType<
              typeof getCurrentOrNextOccurrence
            >
          > => event !== null,
        )
        /*
         * Sort using the current/next
         * PUBLIC occurrence date.
         */
        .sort(
          (a, b) =>
            new Date(
              a.start_at,
            ).getTime() -
            new Date(
              b.start_at,
            ).getTime(),
        );

    return NextResponse.json(
      {
        events,

        /*
         * Useful while debugging.
         * Shows when the occurrence list
         * was generated.
         */
        generated_at:
          now.toISOString(),
      },
      {
        status: 200,
        headers: {
          /*
           * Prevent Next.js, browsers and
           * intermediary caches from holding
           * yesterday's occurrence or an old
           * planning status.
           */
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",

          Pragma: "no-cache",
          Expires: "0",

          "Surrogate-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Unexpected public events API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Failed to load events",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  }
}