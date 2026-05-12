import type { Category, Precision } from "@/lib/supabase/database.types";

/**
 * Pin as we deal with it client- and server-side.
 * Mirrors the `public.pins_with_coords` view.
 */
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
}

/** Vienna's max bounds — matches the map's maxBounds config. */
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
