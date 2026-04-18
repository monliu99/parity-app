/**
 * Unified category color palette — botanical/mineral tones that complement
 * the app's sage green primary. Used for both badge classes and chart bars.
 *
 * Badge classes: very light 50-level backgrounds, readable 600-700 foregrounds.
 * Chart colors: muted mid-tone hex values at consistent saturation.
 */

export const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  Groceries:     "bg-emerald-50 text-emerald-700",
  Dining:        "bg-amber-50 text-amber-700",
  Transport:     "bg-slate-100 text-slate-600",
  Entertainment: "bg-violet-50 text-violet-600",
  Shopping:      "bg-rose-50 text-rose-600",
  Health:        "bg-teal-50 text-teal-700",
  Housing:       "bg-stone-100 text-stone-600",
  Travel:        "bg-sky-50 text-sky-700",
  Income:        "bg-green-50 text-green-700",
  Subscriptions: "bg-indigo-50 text-indigo-600",
  Other:         "bg-zinc-100 text-zinc-500",
};

export const CATEGORY_CHART_COLORS: Record<string, string> = {
  Groceries:     "#5aaf89",  // muted emerald
  Dining:        "#d49a56",  // warm amber
  Transport:     "#7b92a8",  // cool slate
  Entertainment: "#9b82c0",  // muted violet
  Shopping:      "#d4788a",  // soft rose
  Health:        "#5aaaa6",  // sage teal
  Housing:       "#9a8a7a",  // warm stone
  Travel:        "#68aaD2",  // sky cerulean
  Income:        "#4a9c6a",  // forest green
  Subscriptions: "#7b7ec0",  // muted indigo
  Other:         "#a0a0a0",  // neutral zinc
};

export const DEFAULT_BADGE_CLASS = "bg-zinc-100 text-zinc-500";
export const DEFAULT_CHART_COLOR = "#a0a0a0";
