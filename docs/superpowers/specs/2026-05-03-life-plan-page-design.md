# Life Plan Page Redesign

**Date:** 2026-05-03
**Status:** Approved

## Problem

The life plan is a one-shot wizard — users go through 7 steps, get a vision + roadmap, and save. After that it's static. There's no way to view or edit the plan outside the wizard, no connection to monthly reviews, and no feedback loop between stated priorities and actual behavior.

## Solution

Replace the post-save experience with a **tabbed life plan page** (Vision / Priorities / Insights) that makes the plan a living document. The wizard still exists for first-time creation and re-runs, but the default view for returning users is the tabbed page.

The goals page continues to own the **execution layer** (roadmap actions + financial goals). The life plan page owns the **strategy layer** (vision, priorities, plan-vs-reality insights).

## Data Model Changes

### `LifePlanSnapshot` model (new)

Track what changed at each monthly review. One living `LifePlan` row for current state, snapshots for history.

```prisma
model LifePlanSnapshot {
  id          String   @id @default(cuid())
  lifePlanId  String
  month       String          // "2026-04" format
  alignmentScore Int?         // 0-100 spending alignment
  signals     Json            // Array of insight objects
  priorities  Json?           // Priorities at time of snapshot

  createdAt   DateTime @default(now())

  lifePlan    LifePlan @relation(fields: [lifePlanId], references: [id], onDelete: Cascade)

  @@unique([lifePlanId, month])
}
```

### `LifePlan` model changes

Add fields to support the new page:

- `lastReviewedAt: DateTime?` — updated each monthly review
- `priorities: Json` — already exists, will store ranked values with categories
- `visionAnswers: Json?` — store original answers so re-runs can pre-populate

## Page Structure

### Route

`app/(app)/life-planning/page.tsx` — currently a thin wrapper. Becomes the full tabbed page.

### Tab 1: Vision

- **Shared vision statement** — displayed in a moss-green callout card, editable inline
- **Reality check** — 2-4 cards with "On track" / "Watch" badges, regenerated from current financial data
- **Footer** — last updated date, "Re-run wizard" button

**Editing:** Click "Edit" on the vision statement → inline textarea. Save calls AI to regenerate reality check with new vision + current financials.

### Tab 2: Priorities

- **Ranked values list** — numbered items with category badges (financial, experience, career, family, logistical)
- **Potential tensions** — AI-detected conflicts between priorities, shown in earthy-toned cards
- **Reorder** — drag to reorder (updates ranking)

**Data:** Stored in `LifePlan.priorities` as JSON array:
```ts
{ rank: number, name: string, description: string, category: string }[]
```

### Tab 3: Insights

- **Spending alignment score** — circular progress (0-100%) showing how closely spending matches stated priorities
- **Signal cards** — individual plan-vs-reality observations, tagged as aligned / tension / neutral
- **Footer** — last review date, note that insights update after each monthly review

**Signal structure:**
```ts
{ title: string, description: string, status: "aligned" | "tension" | "neutral", priority: string }[]
```

**Generation:** Insights are computed during the monthly review flow. The review completion action calls an AI function that:
1. Reads current priorities and spending data
2. Compares spending patterns to priority rankings
3. Generates an alignment score and 3-5 signals
4. Saves as a `LifePlanSnapshot`

## Wizard Behavior

- **First visit (no life plan):** Start the existing 7-step wizard. On save, redirect to the tabbed page.
- **Returning visit (life plan exists):** Show the tabbed page directly.
- **"Re-run wizard":** Available from the Vision tab footer. Pre-populates answers from `visionAnswers`. On save, updates the existing `LifePlan` row (doesn't create a new one).

## Monthly Review Integration

When a monthly review completes:
1. AI generates life plan insights (new function in `lib/ai/life-planning.ts`)
2. Insights saved as `LifePlanSnapshot` for the review month
3. `LifePlan.lastReviewedAt` updated
4. If priorities shifted, update `LifePlan.priorities`

The Insights tab reads from the latest snapshot. If no snapshot exists yet (pre-review), show a placeholder with "Complete your first monthly review to unlock insights."

## Components

New components in `app/(app)/life-planning/components/`:

- `life-plan-tabs.tsx` — tab container using shadcn Tabs
- `vision-tab.tsx` — vision statement + reality check
- `priorities-tab.tsx` — ranked values + tensions
- `insights-tab.tsx` — alignment score + signals
- `edit-vision-dialog.tsx` — inline/edit dialog for vision statement

## Files to Modify

- `app/(app)/life-planning/page.tsx` — replace wizard wrapper with tabbed page logic
- `app/(app)/life-planning/actions.ts` — add actions for editing vision, reordering priorities, fetching snapshots
- `lib/ai/life-planning.ts` — add `generatePlanInsights()` function
- `prisma/schema.prisma` — add `LifePlanSnapshot` model, update `LifePlan` fields
- `app/(app)/review/` — integrate insight generation into review completion
- `app/(app)/life-planning/components/saved-life-plan.tsx` — remove (replaced by tabbed page)

## Out of Scope

- Real-time collaboration between partners on the life plan
- Export/share functionality
- Goal creation from the life plan page (that stays on the goals page)
- Version diffing between snapshots (just show latest for now)
