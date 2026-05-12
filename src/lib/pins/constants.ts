import type { Category } from "@/lib/supabase/database.types";

/**
 * Pin categories shown in the drop-pin modal.
 * Labels are German for the Vienna launch; we'll i18n later.
 */
export const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "food_drink",  label: "Essen & Trinken",   emoji: "🍴" },
  { value: "view",        label: "Aussicht",          emoji: "🌅" },
  { value: "art_history", label: "Kunst & Geschichte", emoji: "🏛️" },
  { value: "nightlife",   label: "Nachtleben",        emoji: "🌙" },
  { value: "hidden_gem",  label: "Geheimtipp",        emoji: "💎" },
  { value: "warning",     label: "Achtung",           emoji: "⚠️" },
  { value: "other",       label: "Sonstiges",         emoji: "📍" },
];

export const LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];
