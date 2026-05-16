import type { Category, Precision } from "@/lib/supabase/database.types";

export interface Pin {
  id: string;
  author_id: string | null;
  author_handle: string | null;
  title: string;
  body: string;
  category: Category;
  language: string;
  precision: Precision;
  city: string;
  photo_url: string | null;
  is_hidden: boolean;
  created_at: string;
  lng: number;
  lat: number;
  /**
   * Vienna Bezirk (1..23) the pin's location falls inside, or `null`
   * if outside any seeded district. Server-computed via ST_Contains at
   * write time (createPin) and backfilled for existing rows by the
   * B-4 migration. Exposed by the `pins_with_coords` view.
   */
  district_id: number | null;
}

export interface PinWithStats extends Pin {
  upvote_count: number;
  save_count: number;
  has_upvoted: boolean;
  has_saved: boolean;
}

export const VIENNA_BBOX = {
  minLng: 16.18,
  minLat: 48.10,
  maxLng: 16.58,
  maxLat: 48.33,
} as const;

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
