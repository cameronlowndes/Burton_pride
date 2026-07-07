export type EventStatus = "planning" | "open" | "live" | "finished" | "archived";

export type BurtonPrideEvent = {
  id: string;
  event_name: string;
  event_year: number;
  event_date: string;
  setup_date: string | null;
  setup_start_time: string | null;
  public_start_time: string | null;
  public_end_time: string | null;
  pack_down_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  event_theme: string | null;
  status: EventStatus;
  is_active: boolean;
  is_locked: boolean;
  is_archived: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CurrentEventResponse = {
  ok: boolean;
  error?: string;
  event?: BurtonPrideEvent | null;
};

export type EventListResponse = {
  ok: boolean;
  error?: string;
  events?: BurtonPrideEvent[];
  event?: BurtonPrideEvent;
};
