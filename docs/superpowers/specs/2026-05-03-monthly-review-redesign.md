# Monthly Review Redesign Spec

**Date:** 2026-05-03
**Status:** Draft

## Context

The current monthly review is a 7-step wizard (prompt → celebration → spending → insight → decisions → schedule → done) with weak AI insights, a formulaic workflow, and no connection to the life plan or goals. The review should be the moment where couples sit down together, see how their spending aligns with their plan, discuss tensions, and take action.

## Design Decisions

- **Single-page with two parts** instead of a multi-step wizard
- **Part 1: Review & discuss** — score, signals, conversation starter, decision log
- **Part 2: Take action** — AI-suggested adjustments + manual overrides
- **Plan alignment is the core metric** — not just spending summary
- **Signals split into tensions vs on-track** — side-by-side columns
- **Part 2 is optional** — users can complete without making changes

## Flow

### Landing (`/review`)

- If no review exists for current month: show "Time for your [Month] check-in" with Start button
- If review already completed: show completed review summary with option to redo
- Start button triggers AI generation (3-5 sec), then renders review page

### Part 1: Review & Discuss

**Score hero** (moss-green callout, same as vision tab):
- Large alignment score (0-100%)
- One-line summary: "Your spending mostly reflects your priorities"

**Signal cards** (two-column grid):
- **Left column — Tensions** (amber border, amber dot header):
  - Each card: title, detail, linked priority
  - Example: "Dining up 40%" / "$680 vs $480 last month" / "↳ Savings priority"
- **Right column — On track** (green border, green dot header):
  - Each card: title, detail, linked priority
  - Example: "Emergency fund growing" / "$3,200 / $10,000 (32%)" / "↳ #1 priority"

**Conversation starter** (amber callout):
- AI-generated "Worth discussing together" prompt
- One question that directly addresses the biggest tension
- Example: "You both spent $400 more on dining this month. Is this a celebration month, or should you reset next month?"

**Decisions made**:
- Text input: "What did you both decide?"
- Each decision appears as a chip/card with remove button
- Add as many as they want

**"Next: Make adjustments →" button**

### Part 2: Take Action

**Header**: "Part 2 · Take action" (blue, marked "optional")

**AI-suggested adjustments** (blue-tinted cards with checkboxes):
- 2-4 suggestions generated based on review signals and decisions
- Each has a checkbox, title, and short explanation
- Types of suggestions:
  - Reschedule an action (e.g., "Reschedule 'Cut dining by 20%' to next month")
  - Add a new action (e.g., "Add 'Meal prep Sundays' to roadmap")
  - Adjust a goal target (e.g., "Bump emergency fund target to $12,000")
  - Mark an action complete
- User checks the ones they agree with

**Manual override buttons** (three buttons in a row):
- ✓ Mark done
- → Reschedule
- ✕ Remove
- These open inline selectors for picking which action/goal to modify

**"Apply & complete review" button**

### On Save

- Create/update `ReviewHistory` record for the month
- Save `LifePlanSnapshot` with alignment score and signals
- Apply checked AI suggestions: create actions, update goals, reschedule items
- Update `lifePlan.lastReviewedAt`
- Revalidate `/review`, `/dashboard`, `/life-planning`, `/goals`
- Show brief "Done" confirmation

## Data Model

No schema changes needed. Reuses:
- `ReviewHistory` — one record per month (already exists)
- `LifePlanSnapshot` — alignment score + signals (created in life plan redesign)
- `Decision` — logged decisions (already exists)
- `Goal` — actions updated via suggestions (already exists)

## AI Functions

### Update `generatePlanInsights` (already exists in `lib/ai/life-planning.ts`)

Already generates alignment score + signals with aligned/tension/neutral status. This feeds directly into the score hero and signal cards.

### New: `generateReviewSuggestions` (in `lib/ai/monthly-review.ts`)

Takes: signals, decisions, existing actions/goals
Returns: array of suggestions, each with:
```typescript
interface ReviewSuggestion {
  id: string;
  type: "reschedule" | "add_action" | "adjust_goal" | "mark_complete";
  title: string;
  explanation: string;
  targetId?: string;       // existing goal/action ID
  newValue?: string | number; // new month, new target amount, etc.
}
```

### Update `startReview` action

Instead of the current flow, `startReview` should:
1. Fetch goals, actions, spending, life plan priorities
2. Call `generatePlanInsights` for alignment score + signals
3. Call `generateReviewSuggestion` for Part 2 suggestions
4. Return all data in one response

### New: `applyReviewSuggestions` action

Takes: array of selected suggestion IDs
Applies each: reschedule actions, create new actions, adjust goal targets, mark complete.

## File Map

**Create:**
- `app/(app)/review/components/review-page.tsx` — The single-page review (Part 1 + Part 2)

**Modify:**
- `app/(app)/review/components/review-flow.tsx` — Simplify to: prompt → review-page → done (remove celebration, spending, insight, decisions, schedule steps)
- `app/(app)/review/actions.ts` — Update `startReview`, add `applyReviewSuggestions`
- `lib/ai/monthly-review.ts` — Add `generateReviewSuggestions`, update `generateReviewInsight`
- `app/(app)/review/page.tsx` — Minimal wrapper (same pattern as life-planning page)

**Delete:**
- `app/(app)/review/components/celebration-step.tsx` — Merged into score hero
- `app/(app)/review/components/spending-summary.tsx` — Merged into signals
- `app/(app)/review/components/insight-discussion.tsx` — Replaced by conversation starter
- `app/(app)/review/components/decision-logging.tsx` — Inline in review-page
- `app/(app)/review/components/schedule-next.tsx` — Removed (no scheduling step)

## Verification

1. `npx tsc --noEmit` — no errors
2. Visit `/review` as a user with existing life plan + transactions
3. Click Start → confirm alignment score and signals appear
4. Confirm signals split into tensions (left) and on-track (right)
5. Log a decision → confirm it appears as a chip
6. Click "Next: Make adjustments" → confirm Part 2 loads
7. Check a suggestion → confirm checkbox toggles
8. Click "Apply & complete" → confirm review saves, suggestions applied
9. Visit `/life-planning` → Insights tab → confirm snapshot updated
10. Visit `/goals` → confirm any applied suggestions reflected
