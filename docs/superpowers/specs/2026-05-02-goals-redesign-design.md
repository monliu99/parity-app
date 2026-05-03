# Goals Page Redesign Spec

**Date:** 2026-05-02
**Status:** Approved

## Problem

The current Goals page only handles financial goals ($ amount with progress bar). The life plan generates a 12-month roadmap of actions — logistical, experiential, and financial — but those action items have nowhere to live after the planning flow ends. Couples can't track which roadmap actions they've completed, the dashboard progress ring shows "0/N" as a placeholder, and there's no "what should we do next" surface on the dashboard.

## Design Decisions

### 1. Goal types: financial vs. action

The `Goal` model gains two fields:
- `type: String @default("financial")` — `"financial"` | `"action"`
- `completedAt: DateTime?` — set when an action goal is marked done; `null` = incomplete

Financial goals keep all existing behavior (targetAmount, progress bar, contributions). Action goals get `targetAmount: 0` and are completed via a checkbox that sets `completedAt`.

### 2. Auto-sync on life plan save

When a `LifePlan` is created or updated, the save action automatically creates `type: "action"` Goal records for any roadmap item that doesn't already have a matching action Goal (matched by `name`). Only non-financial category roadmap items are auto-synced — financial roadmap items already flow through the existing `RoadmapToGoals` step.

On regeneration: new roadmap items are appended as new action Goals. Existing action Goals (including completed ones) are never deleted by a sync.

### 3. Goals page: two sections, one page

**Roadmap Actions** (top section):
- Checkbox per row — clicking calls `toggleActionGoal`, sets/clears `completedAt`
- Completed rows: strikethrough title + dimmed opacity
- "This month" highlight on the incomplete action with the lowest `month` value
- Category badge (logistical / financial / experience) and month number per row
- Sorted: incomplete first (ascending month), then completed
- "+ Add action" button creates a manual action goal (title + optional month)
- Edit/delete on hover (same pattern as financial goals)

**Financial Goals** (bottom section):
- Unchanged visual treatment: progress bar, amounts, target date
- "+ New goal" button creates a financial goal

**Summary strip** (spans both types):
- "Actions Done: X of Y" — count of `type=action` goals where `completedAt IS NOT NULL`
- "Total Saved: $X" — sum of `currentAmount` across `type=financial` goals

### 4. Dashboard "Next Steps" card

New card on the dashboard showing the 3 upcoming incomplete action goals (lowest `month` values, `completedAt = null`). Read-only — no inline completion. "View all actions →" links to `/goals`.

The "This month" action in the hero card gets the same treatment: the incomplete action goal with the lowest month number.

**Progress ring** now reads real data: `completedAt IS NOT NULL` count / total `type=action` goals for the partnership.

### 5. Action goals are fully editable

Same edit/delete pattern as financial goals. Auto-sync creates them as a starting point; users own them after that. Name, month, and description can all be changed. Users can add manual action goals not sourced from the roadmap.

## Page Layout

```
Goals                              [no top-level button]

Summary strip:
┌─────────────────┬────────────────┐
│ Actions Done    │ Total Saved    │
│ 3 of 8          │ $20,600        │
└─────────────────┴────────────────┘

Roadmap Actions
┌──────────────────────────────────────────┐
│ header: "Roadmap Actions"  [+ Add action]│
├──────────────────────────────────────────┤
│ ☑ (done) Open joint checking    Month 1  │  ← strikethrough, dimmed
│ ☑ (done) Set up joint savings   Month 2  │
│ ☐ THIS MONTH → Plan SE Asia trip Month 4 │  ← highlighted bg
│ ☐ Start retirement contributions Month 6 │
│ ☐ Research neighborhoods        Month 8  │
│ ☐ Discuss part-time work        Month 10 │
│ ☐ Revisit life plan             Month 12 │
└──────────────────────────────────────────┘

Financial Goals
┌──────────────────────────────────────────┐
│ header: "Financial Goals"  [+ New goal]  │
├──────────────────────────────────────────┤
│ Emergency Fund    $8,200 / $20,000  41%  │
│ ████████░░░░░░░                          │
│ ...                                      │
└──────────────────────────────────────────┘
```

## Dashboard Card Layout

```
NEXT STEPS
☐ Plan Southeast Asia trip    · This month
☐ Start retirement contributions · Month 6
☐ Research neighborhoods      · Month 8

                    View all actions →
```

Card is read-only. Shows only incomplete action goals (completedAt = null), lowest month first, capped at 3.

Empty state: "Your roadmap actions will appear here once you create a life plan."

## Schema Changes

```prisma
model Goal {
  // existing fields unchanged ...
  type        String    @default("financial")  // "financial" | "action"
  completedAt DateTime?                        // action goals only
}
```

Migration: existing goals default to `type = "financial"`, `completedAt = null`. No backfill needed.

## Data Requirements

### Goals page fetch
```typescript
db.goal.findMany({
  where: { partnershipId: partnership.id },
  orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
})
```
Split in-memory: `type === "action"` vs `type === "financial"`.

Action goals sorted for display: incomplete (ascending month) first, then completed.

### Dashboard next steps fetch
```typescript
db.goal.findMany({
  where: { partnershipId: partnership.id, type: "action", completedAt: null },
  orderBy: { month: 'asc' },
  take: 3,
})
```
Note: action goals store month as a number in the `notes` field (used as `month`) OR we add a `month Int?` field. See Files section — we use `notes` to store month as a string for now to avoid another migration column.

**Revised:** Add `month Int?` to Goal for action goals. Cleaner than overloading `notes`.

### Life plan card progress ring
```typescript
const [completedCount, totalCount] = await Promise.all([
  db.goal.count({ where: { partnershipId: partnership.id, type: 'action', completedAt: { not: null } } }),
  db.goal.count({ where: { partnershipId: partnership.id, type: 'action' } }),
])
```

### Current month action (for life plan hero)
```typescript
db.goal.findFirst({
  where: { partnershipId: partnership.id, type: 'action', completedAt: null },
  orderBy: { month: 'asc' },
})
```

## Auto-Sync Logic

In `app/(app)/life-planning/actions.ts`, after saving/updating a `LifePlan`:

```typescript
async function syncRoadmapActions(partnershipId: string, roadmap: RoadmapItem[]) {
  const existingActions = await db.goal.findMany({
    where: { partnershipId, type: 'action' },
    select: { name: true },
  });
  const existingNames = new Set(existingActions.map(g => g.name));

  const toCreate = roadmap
    .filter(item => item.category !== 'financial' && !existingNames.has(item.title))
    .map(item => ({
      partnershipId,
      userId: null,
      ownerLabel: 'JOINT',
      name: item.title,
      targetAmount: 0,
      currentAmount: 0,
      type: 'action',
      month: item.month,
      notes: item.description || null,
    }));

  if (toCreate.length > 0) {
    await db.goal.createMany({ data: toCreate });
  }
}
```

## Files to Modify / Create

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `type String @default("financial")`, `completedAt DateTime?`, `month Int?` to Goal |
| `app/(app)/goals/page.tsx` | Restructure: summary strip, Roadmap Actions section, Financial Goals section |
| `app/(app)/goals/actions.ts` | Add `toggleActionGoal(id)`, `createActionGoal(formData)`; update `createGoal` type param |
| `app/(app)/dashboard/page.tsx` | Add next-steps fetch (3 incomplete action goals); update progress ring to real counts; update currentAction to read from Goal |
| `app/(app)/dashboard/next-steps-card.tsx` | New component |
| `app/(app)/life-planning/actions.ts` | Add `syncRoadmapActions` call after life plan save/update |

## Out of Scope

- Changing the life planning flow itself
- Goal contributions for action goals (they're binary, not $ amounts)
- Per-user action goal assignment (all action goals are joint)
- Notifications or reminders for upcoming actions
- Reordering action goals by drag-and-drop
