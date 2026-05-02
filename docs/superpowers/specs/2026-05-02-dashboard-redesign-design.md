# Dashboard Redesign Spec

**Date:** 2026-05-02
**Status:** Approved

## Problem

The dashboard's real estate isn't being used effectively. The life plan — the product's strongest differentiator — is buried in a collapsible card. Financial metrics take up disproportionate space. The AI synthesis sits alone as a separate card rather than connecting vision to reality. Goals duplicate content that lives on their own dedicated page.

## Design Decisions

### 1. Emotional center: "This is our life together"
The dashboard should feel like looking at a shared future, not a financial report card. The life plan is the hero; financial data is the supporting cast.

### 2. Life Plan Hero (blended card)
Promoted from collapsible sidebar to the main attraction. Contains:
- **Vision statement** — the couple's shared vision as a tagline (2-3 sentences)
- **Current month's action** — the active item from their 12-month roadmap, in a subtle highlighted row
- **Progress ring** — small circular indicator showing actions completed (e.g. "4 of 12")
- **AI insight** — woven in as a conversational observation at the bottom, connecting their vision to financial reality. This replaces the standalone synthesis card.

Link to "Update vision →" for re-entering the life planning flow.

### 3. Net Worth card (compact, no ownership labels)
- Combined net worth number (hero stat)
- **Visual shared/personal split bar** — two-color bar showing shared % vs personal %, no names or "mine/yours" labels
- Labels: "Shared XX%" / "Personal XX%"
- "Details →" link to `/accounts`

This addresses Emily's feedback about "Mo's" vs "Goldie's" feeling jarring. The visual split shows where money is held without implying ownership.

### 4. Monthly Spending card (compact)
- Monthly average with "/mo" suffix
- Stacked category bar (top categories)
- Top 2-3 category labels below the bar
- "Details →" link to `/transactions`

### 5. Activity Feed (new)
Shows recent couple activity — both partners contributing:
- Each item: avatar initial (colored circle) + description + relative timestamp
- Activity types: goal contributions, transaction logging, review completions, goal creation, life plan updates
- Show ~5 most recent items
- Source data: recent transactions, goals, reviews, life plans from both users

### 6. Review Nudge (conditional)
- Only appears when 30+ days since last monthly review
- Copy: "It's been {X} days since your last review · Start review →"
- Style: thin banner with amber dot indicator, warm background
- Links to `/review`
- Badge on "Monthly Review" nav item in sidebar when review is due (dot indicator)

### 7. Removed from dashboard
- **Standalone AI synthesis card** — insight woven into life plan hero
- **Goals card** — goals have their own page at `/goals`

## Page Layout (top to bottom)

```
┌──────────────────────────────┐
│ Page title: "Mo & Goldie"    │
│ Subtitle                     │
├──────────────────────────────┤
│                              │
│ Life Plan Hero               │
│ ┌──────────────────────────┐ │
│ │ YOUR SHARED VISION       │ │
│ │ Vision statement...      │ │
│ │ ┌──────────────────────┐ │ │
│ │ │ This month: Action   │ │ │
│ │ └──────────────────────┘ │ │
│ │                          │ │
│ │ AI insight (italic)...   │ │
│ │            Update vision→│ │
│ └──────────────────────────┘ │
│                              │
├──────────────────────────────┤
│ Review nudge (conditional)   │
├──────────────┬───────────────┤
│ Net Worth    │ Spending      │
│ $131,400     │ $4,230/mo     │
│ [===---]     │ [===--]       │
│ Shared 68%   │ Housing 35%   │
│ Personal 32% │ Dining 25%    │
│ Details →    │ Details →     │
├──────────────┴───────────────┤
│ Recent Activity              │
│ M  Added $500 to Emergency…  │
│ G  Logged Groceries — $87    │
│ M  Completed Monthly Review  │
│ G  Created Vacation Fund     │
└──────────────────────────────┘
```

### Responsive behavior
The Net Worth / Spending two-column grid uses `grid-cols-1 sm:grid-cols-2`. On mobile, Net Worth renders above Spending in a single column. All other sections are already single-column.

## Color Palette Warmth Shift

Shift backgrounds and borders slightly warmer (more beige/neutral, less sage tint). Keep primary moss green unchanged.

**Changes to CSS variables in `globals.css`:**

| Token | Current | New | Direction |
|-------|---------|-----|-----------|
| `--background` | `oklch(0.965 0.008 155)` (faint sage) | `oklch(0.970 0.006 80)` (warm off-white) | Warmer, less green |
| `--border` | `oklch(0.898 0.014 155)` (sage gray) | `oklch(0.895 0.012 80)` (warm beige-gray) | Warmer, less green |
| `--input` | same as border | same as new border | Match border |
| `--secondary` | `oklch(0.942 0.01 155)` | `oklch(0.945 0.008 80)` (warm light) | Warmer |
| `--muted` | `oklch(0.942 0.01 155)` | `oklch(0.945 0.008 80)` (warm light) | Warmer |
| `--sidebar` | `oklch(0.948 0.012 155)` | `oklch(0.950 0.010 80)` | Warmer |
| `--sidebar-accent` | `oklch(0.925 0.015 155)` | `oklch(0.930 0.012 80)` | Warmer |
| `--sidebar-border` | `oklch(0.885 0.014 155)` | `oklch(0.885 0.012 80)` | Warmer |

**Unchanged:** primary, foreground, muted-foreground, accent, destructive, chart colors, earth tones. The green palette stays — only the neutral backgrounds and borders shift warmer.

## Data Requirements

### Activity Feed
New data fetch needed: recent actions from both users in the partnership.

```typescript
interface ActivityItem {
  userId: string;
  userName: string;
  type: "goal_contribution" | "transaction" | "review" | "goal_created" | "life_plan";
  description: string;
  createdAt: Date;
}
```

Source queries:
- Recent transactions (both users, last 10) — from `Transaction`
- Recent goal contributions (both users, last 5) — from `GoalContribution` (model already exists in schema with `userId`, `amount`, `createdAt`)
- Recent goals created (both users, last 5) — from `Goal.createdAt`
- Recent life plan updates (last 1) — from `LifePlan.updatedAt`
- Recent monthly reviews (last 1) — from `ReviewHistory.completedAt`

Merge, sort by date, take top 5.

### Review Nudge
Already have `lastReviewDate` from monthly review system. Show nudge when `daysSinceReview >= 30`.

### Net Worth Split
Already have account data with `userId`. Shared = accounts where `userId === null`. Personal = everything else. Calculate percentages.

### Life Plan Progress
Progress ring = `count(Goals where type = "action" AND completedAt IS NOT NULL) / count(Goals where type = "action")`. The "current month's action" is the lowest-numbered roadmap item without a corresponding completed Goal.

**Dependency:** This requires the Goals page spec to land first — specifically, `Goal` needs a `type: "financial" | "action"` field and a `completedAt: DateTime?` field. Until then, the progress ring renders with a 0/N placeholder. The dashboard is otherwise independent of that schema change.

### Empty States
- **No life plan yet**: Hero card shows a warm CTA — "Start your shared vision →" linking to `/life-planning`
- **No accounts**: Net worth shows "$0" with "Add your first account →" linking to `/accounts`
- **No transactions**: Spending shows "—" with "Add transactions →" linking to `/transactions`
- **No activity yet**: Activity feed shows "Start building your financial picture together"

## Files to Modify

### Dashboard page
- `app/(app)/dashboard/page.tsx` — complete restructure of layout and data fetching

### New components
- `app/(app)/dashboard/activity-feed.tsx` — activity feed component

### Modified components
- `app/(app)/dashboard/life-plan-card.tsx` — expand from collapsible to hero blended card
- `app/(app)/dashboard/synthesis-card.tsx` — remove (insight moves into life plan hero)

### AI
- `lib/ai/insights.ts` — adjust synthesis prompt to work within life plan hero context (shorter, connects vision to finances)

### Color theme
- `app/globals.css` — update CSS variable values for warmth shift

### Navigation
- `components/nav.tsx` — add review nudge badge on Monthly Review nav item
- `components/mobile-nav.tsx` — same badge on mobile

## Out of Scope
- Dark mode color adjustments (follow later if light mode works)
- Changing the life planning flow itself
- Changing the monthly review flow
- Adding new AI features beyond the synthesis adjustment
- Goals page redesign (action goals UI, checkbox completion, unified financial + action goals view) — separate spec, must land before progress ring is fully functional
