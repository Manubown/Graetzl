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
