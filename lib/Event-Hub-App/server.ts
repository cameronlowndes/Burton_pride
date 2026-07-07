import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { BurtonPrideEvent } from "./types";

async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export async function getActiveBurtonPrideEvent(): Promise<BurtonPrideEvent | null> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("burton_pride_events")
    .select("*")
    .eq("is_active", true)
    .eq("is_archived", false)
    .order("event_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BurtonPrideEvent | null;
}

export async function getRequestBurtonPrideEvent(): Promise<BurtonPrideEvent> {
  const requestHeaders = await headers();
  const eventIdFromHeader = requestHeaders.get("x-burton-pride-event-id");
  const supabase = await getSupabaseServerClient();

  if (eventIdFromHeader) {
    const { data, error } = await supabase
      .from("burton_pride_events")
      .select("*")
      .eq("id", eventIdFromHeader)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data as BurtonPrideEvent;
  }

  const activeEvent = await getActiveBurtonPrideEvent();
  if (!activeEvent) throw new Error("No active Burton Pride event has been set.");
  return activeEvent;
}

export async function requireUnlockedBurtonPrideEvent() {
  const event = await getRequestBurtonPrideEvent();

  if (event.is_locked) {
    throw new Error(`${event.event_name} is locked. Unlock this event before making changes.`);
  }

  return event;
}
