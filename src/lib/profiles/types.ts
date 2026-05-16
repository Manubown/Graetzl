import type { Pin } from "@/lib/pins/types";

export interface Profile {
  id: string;
  handle: string;
  bio: string | null;
  home_city: string;
  created_at: string;
}

export interface ProfileWithStats extends Profile {
  pin_count: number;
  recent_pins: Pin[];
}

/** Saved pin with the timestamp the user saved it (not pin.created_at). */
export interface SavedPin extends Pin {
  saved_at: string;
}
