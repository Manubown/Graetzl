/**
 * Hand-written types for the v1 schema. We'll replace this with
 * generated types via `supabase gen types typescript` once the
 * Supabase project is live. Mirrors the migrations in
 * supabase/migrations/.
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

/** Shape returned by the pins_with_coords view + pins_in_bbox RPC. */
export interface PinWithCoordsRow {
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

export interface Database {
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
          created_at: string;
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
          created_at?: string;
        };
        Update: Partial<{
          title: string;
          body: string;
          category: Category;
          language: string;
          precision: Precision;
          photo_url: string | null;
          is_hidden: boolean;
        }>;
      };
      upvotes: {
        Row: { user_id: string; pin_id: string; created_at: string };
        Insert: { user_id: string; pin_id: string; created_at?: string };
        Update: never;
      };
      saves: {
        Row: { user_id: string; pin_id: string; created_at: string };
        Insert: { user_id: string; pin_id: string; created_at?: string };
        Update: never;
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
        Update: never;
      };
    };
    Views: {
      pins_with_coords: {
        Row: PinWithCoordsRow;
      };
    };
    Functions: {
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
    };
  };
}
