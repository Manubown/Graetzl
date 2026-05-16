/**
 * Hand-written types for the v1 schema. Mirrors the migrations in
 * supabase/migrations/. We'll switch to generated types via
 * `supabase gen types typescript` once the project is settled.
 *
 * Shape MUST match what `@supabase/supabase-js` expects (Tables /
 * Views / Functions / Enums / CompositeTypes, all as `type` not
 * `interface`). Missing branches collapse the inferred table row
 * types to `never`, which surfaces as confusing build errors like
 * "Object literal may only specify known properties, and 'X' does
 * not exist in type 'never[]'".
 */

export type Category =
  | "food_drink"
  | "view"
  | "art_history"
  | "nightlife"
  | "hidden_gem"
  | "warning"
  | "other";

export type Precision = "exact" | "approximate";

export type ReportReason =
  | "spam"
  | "commercial"
  | "illegal"
  | "harassment"
  | "inaccurate"
  | "unsafe"
  | "other";

export type ReportStatus = "open" | "reviewed" | "dismissed";

export type PinWithCoordsRow = {
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
  /** Admin-marked "Geheimtipp" flag. Added by D-3 migration. */
  is_special: boolean;
  created_at: string;
  lng: number;
  lat: number;
  /** Vienna Bezirk (1..23) or null. Added by B-2 + B-6. */
  district_id: number | null;
};

export type PinWithStatsRow = PinWithCoordsRow & {
  upvote_count: number;
  save_count: number;
  has_upvoted: boolean;
  has_saved: boolean;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          bio: string | null;
          home_city: string;
          created_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          bio?: string | null;
          home_city?: string;
          created_at?: string;
        };
        Update: Partial<{
          handle: string;
          bio: string | null;
          home_city: string;
        }>;
        Relationships: [];
      };
      pins: {
        Row: {
          id: string;
          author_id: string | null;
          title: string;
          body: string;
          category: Category;
          language: string;
          location: unknown;
          precision: Precision;
          city: string;
          photo_url: string | null;
          is_hidden: boolean;
          is_special: boolean;
          created_at: string;
          district_id: number | null;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          body: string;
          category: Category;
          language?: string;
          location: string;
          precision?: Precision;
          city?: string;
          photo_url?: string | null;
          is_hidden?: boolean;
          is_special?: boolean;
          created_at?: string;
          district_id?: number | null;
        };
        Update: Partial<{
          title: string;
          body: string;
          category: Category;
          language: string;
          precision: Precision;
          photo_url: string | null;
          is_hidden: boolean;
          is_special: boolean;
          district_id: number | null;
        }>;
        Relationships: [];
      };
      upvotes: {
        Row: { user_id: string; pin_id: string; created_at: string };
        Insert: { user_id: string; pin_id: string; created_at?: string };
        Update: Partial<{ user_id: string; pin_id: string; created_at: string }>;
        Relationships: [];
      };
      saves: {
        Row: { user_id: string; pin_id: string; created_at: string };
        Insert: { user_id: string; pin_id: string; created_at?: string };
        Update: Partial<{ user_id: string; pin_id: string; created_at: string }>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          pin_id: string;
          reporter_id: string | null;
          reason: ReportReason;
          notes: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          pin_id: string;
          reporter_id: string;
          reason: ReportReason;
          notes?: string | null;
          status?: ReportStatus;
          created_at?: string;
        };
        Update: Partial<{
          status: ReportStatus;
          notes: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: {
      pins_with_coords: { Row: PinWithCoordsRow; Relationships: [] };
    };
    Functions: {
      district_at_point: {
        Args: { p_lng: number; p_lat: number };
        Returns: number | null;
      };
      pins_in_bbox: {
        Args: {
          min_lng: number;
          min_lat: number;
          max_lng: number;
          max_lat: number;
          max_rows?: number;
        };
        Returns: PinWithCoordsRow[];
      };
      pins_in_bbox_filtered: {
        Args: {
          min_lng: number;
          min_lat: number;
          max_lng: number;
          max_lat: number;
          p_bezirk?: number | null;
          max_rows?: number;
        };
        Returns: PinWithCoordsRow[];
      };
      pin_with_stats: {
        Args: { p_pin_id: string };
        Returns: PinWithStatsRow[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
