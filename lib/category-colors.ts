/**
 * Unified category color palette — botanical/mineral tones that complement
 * the app's sage green primary. Used for both badge classes and chart bars.
 *
 * Badge classes: very light 50-level backgrounds, readable 600-700 foregrounds.
 * Chart colors: muted mid-tone hex values at consistent saturation.
 */

export const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  Housing:              "bg-stone-100 text-stone-600",
  "Groceries + Dining": "bg-emerald-50 text-emerald-700",
  Transport:            "bg-slate-100 text-slate-600",
  Kids:                 "bg-amber-50 text-amber-700",
  "Fun + Entertainment":"bg-violet-50 text-violet-600",
  "Personal Care":      "bg-rose-50 text-rose-600",
  Health:               "bg-teal-50 text-teal-700",
  Shopping:             "bg-pink-50 text-pink-600",
  Subscriptions:        "bg-indigo-50 text-indigo-600",
  Insurance:            "bg-sky-50 text-sky-700",
  Other:                "bg-zinc-100 text-zinc-500",
};

export const CATEGORY_CHART_COLORS: Record<string, string> = {
  Housing:              "#9a8a7a",  // warm stone
  "Groceries + Dining": "#5aaf89",  // muted emerald
  Transport:            "#7b92a8",  // cool slate
  Kids:                 "#d49a56",  // warm amber
  "Fun + Entertainment":"#9b82c0",  // muted violet
  "Personal Care":      "#d4788a",  // soft rose
  Health:               "#5aaaa6",  // sage teal
  Shopping:             "#d4788a",  // soft rose
  Subscriptions:        "#7b7ec0",  // muted indigo
  Insurance:            "#68aaD2",  // sky cerulean
  Other:                "#a0a0a0",  // neutral zinc
};

export const DEFAULT_BADGE_CLASS = "bg-zinc-100 text-zinc-500";
export const DEFAULT_CHART_COLOR = "#a0a0a0";
