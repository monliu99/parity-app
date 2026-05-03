# Life Plan Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static saved-life-plan view with a tabbed page (Vision / Priorities / Insights) that makes the life plan a living document, and integrate plan-vs-spending insights into the monthly review.

**Architecture:** Schema adds `LifePlanSnapshot` (written at review completion) and three new fields on `LifePlan`. The page renders a server-fetched `LifePlan` + latest snapshot into a client tab shell. The wizard continues to own creation/re-run; the tabbed page owns day-to-day viewing.

**Tech Stack:** Prisma 7 (Neon/PostgreSQL), Next.js 16 App Router server actions, Anthropic Haiku, Tailwind 4, shadcn/ui base-ui components

---

## File Map

**Create:**
- `app/(app)/life-planning/components/vision-tab.tsx` — Vision statement (editable) + reality check cards
- `app/(app)/life-planning/components/priorities-tab.tsx` — Ranked values list with up/down reordering + tensions
- `app/(app)/life-planning/components/insights-tab.tsx` — Alignment score + signal cards (or placeholder)
- `app/(app)/life-planning/components/life-plan-tabs.tsx` — Tab nav shell combining the three tabs
- `app/(app)/life-planning/components/life-plan-page-view.tsx` — Client component managing tabs vs wizard view toggle

**Modify:**
- `prisma/schema.prisma` — Add `LifePlanSnapshot` model; add `lastReviewedAt`, `visionAnswers`, `realityCheck` to `LifePlan`
- `lib/ai/life-planning.ts` — Add `RealityCheckCard`, `PlanInsight` types; add `generateRealityCheckCards()`, `generatePlanInsights()`
- `app/(app)/life-planning/actions.ts` — Update `saveLifePlan` (upsert + store realityCheck + visionAnswers); add `updateVisionStatement`, `reorderPriorities`, `getLatestSnapshot`
- `app/(app)/life-planning/components/life-planning-flow.tsx` — Add `forceIntro`, `onComplete` props; pass `visionAnswers` + `lifePlanId` to `saveLifePlan`; remove "saved" step
- `app/(app)/life-planning/page.tsx` — Show `LifePlanPageView` for returning users, wizard for first-timers
- `app/(app)/review/actions.ts` — Call `generatePlanInsights` + save `LifePlanSnapshot` in `completeReview`

**Delete:**
- `app/(app)/life-planning/components/saved-life-plan.tsx` — Replaced by tabbed page

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new fields and model to schema**

Find the `LifePlan` model (line 144) and replace it with:

```prisma
model LifePlan {
  id              String    @id @default(cuid())
  partnershipId   String
  visionStatement String
  roadmap         Json
  priorities      Json
  lastReviewedAt  DateTime?
  visionAnswers   Json?
  realityCheck    Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  partnership     Partnership        @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  snapshots       LifePlanSnapshot[]

  @@index([partnershipId])
}

model LifePlanSnapshot {
  id             String   @id @default(cuid())
  lifePlanId     String
  month          String
  alignmentScore Int?
  signals        Json
  priorities     Json?
  createdAt      DateTime @default(now())

  lifePlan       LifePlan @relation(fields: [lifePlanId], references: [id], onDelete: Cascade)

  @@unique([lifePlanId, month])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_life_plan_snapshot
npx prisma generate
```

Expected: migration file created, client regenerated with `db.lifePlanSnapshot` available.

- [ ] **Step 3: Verify migration succeeded**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no type errors (or errors unrelated to this change).

---

## Task 2: Add AI types and `generateRealityCheckCards`

**Files:**
- Modify: `lib/ai/life-planning.ts`

- [ ] **Step 1: Add types after the existing `ValueConflict` interface (around line 43)**

```typescript
export interface RealityCheckCard {
  title: string;
  detail: string;
  status: "on-track" | "watch";
}

export interface PlanInsight {
  title: string;
  description: string;
  status: "aligned" | "tension" | "neutral";
  priority: string;
}

export interface PlanInsightsResult {
  alignmentScore: number;
  signals: PlanInsight[];
}
```

- [ ] **Step 2: Add `generateRealityCheckCards` function before `invalidateLifePlanCache`**

```typescript
export async function generateRealityCheckCards(
  partnershipId: string,
  accounts: Account[],
  goals: Goal[],
  visionStatement: string,
  monthlyBaseline?: number | null
): Promise<RealityCheckCard[]> {
  try {
    const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);
    const totalSavings = accounts
      .filter((a) => a.type === "SAVINGS")
      .reduce((sum, a) => sum + a.balance, 0);
    const totalDebt = accounts
      .filter((a) => a.type === "CREDIT")
      .reduce((sum, a) => sum + Math.abs(a.balance), 0);
    const monthlySpending = monthlyBaseline ?? 0;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You are Parity's life planning assistant. Ground a couple's vision in financial reality.

Return ONLY valid JSON — an array of 2-4 cards:
[{ "title": "short label (under 6 words)", "detail": "one sentence (under 15 words)", "status": "on-track" | "watch" }]

Rules:
- "on-track" = strength or behavior that supports the vision
- "watch" = gap or risk to address
- Use "you" or "you both"
- Be specific to their numbers`,
      messages: [
        {
          role: "user",
          content: `Vision: ${visionStatement}

Financial context:
- Net worth: $${netWorth.toFixed(0)}
- Monthly spending: $${monthlySpending.toFixed(0)}
- Savings: $${totalSavings.toFixed(0)}
${totalDebt > 0 ? `- Debt: $${totalDebt.toFixed(0)}` : ""}
- Goals: ${goals.map((g) => g.name).join(", ") || "none"}

Return reality check cards as JSON array.`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? (JSON.parse(jsonMatch[0]) as RealityCheckCard[]) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep "life-planning.ts"
```

Expected: no output (no errors in this file).

---

## Task 3: Add `generatePlanInsights` AI function

**Files:**
- Modify: `lib/ai/life-planning.ts`

- [ ] **Step 1: Add `generatePlanInsights` function after `generateRealityCheckCards`**

```typescript
export async function generatePlanInsights(
  partnershipId: string,
  priorities: Priority[],
  topCategories: Array<{ category: string; amount: number }>,
  thisMonthTotal: number
): Promise<PlanInsightsResult> {
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `You are Parity's life planning assistant. Compare a couple's stated priorities to their actual spending.

Return ONLY valid JSON:
{
  "alignmentScore": 0-100,
  "signals": [
    { "title": "short label (under 6 words)", "description": "one sentence (under 15 words)", "status": "aligned" | "tension" | "neutral", "priority": "which priority this relates to" }
  ]
}

Rules:
- alignmentScore: 0 = spending contradicts priorities, 100 = spending perfectly reflects priorities
- 3-5 signals total
- "aligned" = spending supports this priority
- "tension" = spending works against this priority
- "neutral" = no clear relationship
- Use "you" or "you both"`,
      messages: [
        {
          role: "user",
          content: `Their priorities (ranked):
${priorities.map((p) => `${p.rank}. ${p.area}: ${p.description}`).join("\n")}

Top spending this month (total $${thisMonthTotal.toFixed(0)}):
${topCategories.map((c) => `- ${c.category}: $${c.amount.toFixed(0)}`).join("\n")}

Generate alignment score and signals.`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { alignmentScore: 0, signals: [] };
    const parsed = JSON.parse(jsonMatch[0]) as { alignmentScore?: number; signals?: PlanInsight[] };
    return {
      alignmentScore: typeof parsed.alignmentScore === "number" ? parsed.alignmentScore : 0,
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
    };
  } catch {
    return { alignmentScore: 0, signals: [] };
  }
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit 2>&1 | grep "life-planning.ts"
```

Expected: no output.

---

## Task 4: Update server actions

**Files:**
- Modify: `app/(app)/life-planning/actions.ts`

- [ ] **Step 1: Add imports at the top of the file**

Add these imports after the existing imports:

```typescript
import {
  generateRealityCheckCards,
  generatePlanInsights,
} from "@/lib/ai/life-planning";
import type { RealityCheckCard } from "@/lib/ai/life-planning";
```

- [ ] **Step 2: Update `saveLifePlan` to accept `visionAnswers` and `lifePlanId`, store reality check**

Replace the existing `saveLifePlan` function with:

```typescript
export async function saveLifePlan(data: {
  visionStatement: string;
  roadmap: unknown;
  priorities: unknown;
  visionAnswers?: Record<string, string>;
  lifePlanId?: string;
}) {
  const { partnership } = await getPartnership();

  const [accounts, goals, baseline] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getRollingBaseline(partnership.id),
  ]);

  const realityCheckCards: RealityCheckCard[] = data.visionAnswers
    ? await generateRealityCheckCards(
        partnership.id,
        accounts,
        goals,
        data.visionStatement,
        baseline?.average ?? null
      )
    : [];

  if (data.lifePlanId) {
    await db.lifePlan.update({
      where: { id: data.lifePlanId },
      data: {
        visionStatement: data.visionStatement,
        roadmap: data.roadmap as any,
        priorities: data.priorities as any,
        ...(data.visionAnswers && { visionAnswers: data.visionAnswers as any }),
        realityCheck: realityCheckCards as any,
      },
    });
  } else {
    await (db.lifePlan.create as any)({
      data: {
        partnershipId: partnership.id,
        visionStatement: data.visionStatement,
        roadmap: data.roadmap,
        priorities: data.priorities,
        visionAnswers: data.visionAnswers ?? null,
        realityCheck: realityCheckCards,
      },
    });
  }

  const roadmapItems = Array.isArray(data.roadmap)
    ? (data.roadmap as Array<{
        month: number;
        title: string;
        description: string;
        category: string;
      }>)
    : [];
  await syncRoadmapActions(partnership.id, roadmapItems);

  invalidateLifePlanCache(partnership.id);

  revalidatePath("/life-planning");
  revalidatePath("/goals");
  revalidatePath("/dashboard");

  return { success: true };
}
```

- [ ] **Step 3: Add `updateVisionStatement` action after `saveLifePlan`**

```typescript
export async function updateVisionStatement(visionStatement: string) {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (!lifePlan) return { success: false };

  const [accounts, goals, baseline] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getRollingBaseline(partnership.id),
  ]);

  const realityCheckCards = await generateRealityCheckCards(
    partnership.id,
    accounts,
    goals,
    visionStatement,
    baseline?.average ?? null
  );

  await db.lifePlan.update({
    where: { id: lifePlan.id },
    data: { visionStatement, realityCheck: realityCheckCards as any },
  });

  revalidatePath("/life-planning");
  return { success: true };
}
```

- [ ] **Step 4: Add `reorderPriorities` action**

```typescript
export async function reorderPriorities(
  priorities: Array<{ rank: number; area: string; description: string }>
) {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (!lifePlan) return { success: false };

  const existing = lifePlan.priorities as
    | { priorities: any[]; conflicts?: any[] }
    | undefined;
  const conflicts = existing?.conflicts ?? [];

  await db.lifePlan.update({
    where: { id: lifePlan.id },
    data: { priorities: { priorities, conflicts } as any },
  });

  revalidatePath("/life-planning");
  return { success: true };
}
```

- [ ] **Step 5: Add `getLatestSnapshot` action**

```typescript
export async function getLatestSnapshot() {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (!lifePlan) return { snapshot: null };

  const snapshot = await (db.lifePlanSnapshot as any).findFirst({
    where: { lifePlanId: lifePlan.id },
    orderBy: { createdAt: "desc" },
  });

  return { snapshot: snapshot ?? null };
}
```

- [ ] **Step 6: Verify the file compiles**

```bash
npx tsc --noEmit 2>&1 | grep "life-planning/actions"
```

Expected: no output.

---

## Task 5: Create `insights-tab.tsx`

**Files:**
- Create: `app/(app)/life-planning/components/insights-tab.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { Progress } from "@/components/ui/progress";
import type { PlanInsight } from "@/lib/ai/life-planning";

interface Snapshot {
  alignmentScore: number | null;
  signals: unknown;
  createdAt: Date;
}

interface InsightsTabProps {
  snapshot: Snapshot | null;
  lastReviewedAt: Date | null;
}

export function InsightsTab({ snapshot, lastReviewedAt }: InsightsTabProps) {
  if (!snapshot) {
    return (
      <div className="bg-card border rounded-xl p-6 text-center space-y-2">
        <p className="text-sm font-medium">No insights yet</p>
        <p className="text-xs text-muted-foreground">
          Complete your first monthly review to see how your spending aligns with your priorities.
        </p>
      </div>
    );
  }

  const alignmentScore = snapshot.alignmentScore ?? 0;
  const signals = (snapshot.signals as PlanInsight[]) ?? [];

  const statusColor = (status: PlanInsight["status"]) => {
    if (status === "aligned") return "text-emerald-600";
    if (status === "tension") return "text-amber-700";
    return "text-muted-foreground";
  };

  const statusLabel = (status: PlanInsight["status"]) => {
    if (status === "aligned") return "Aligned";
    if (status === "tension") return "Tension";
    return "Neutral";
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Spending alignment</p>
          <span className="text-2xl font-bold">{alignmentScore}%</span>
        </div>
        <Progress value={alignmentScore} className="h-2" />
        <p className="text-xs text-muted-foreground">
          How closely your spending reflects your stated priorities
        </p>
      </div>

      {signals.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Observations
          </p>
          {signals.map((signal, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{signal.title}</p>
                <span className={`text-xs font-medium ${statusColor(signal.status)}`}>
                  {statusLabel(signal.status)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{signal.description}</p>
              {signal.priority && (
                <p className="text-xs text-muted-foreground">↳ {signal.priority}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {lastReviewedAt && (
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(lastReviewedAt).toLocaleDateString()}. Insights refresh after each monthly review.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "insights-tab"
```

Expected: no output.

---

## Task 6: Create `priorities-tab.tsx`

**Files:**
- Create: `app/(app)/life-planning/components/priorities-tab.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState, useTransition } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import { reorderPriorities } from "../actions";

interface Priority {
  rank: number;
  area: string;
  description: string;
}

interface ValueConflict {
  area: string;
  tension: string;
  suggestedFrame: string;
}

interface PrioritiesTabProps {
  lifePlan: LifePlan;
}

export function PrioritiesTab({ lifePlan }: PrioritiesTabProps) {
  const raw = lifePlan.priorities as
    | { priorities: Priority[]; conflicts?: ValueConflict[] }
    | undefined;

  const [priorities, setPriorities] = useState<Priority[]>(raw?.priorities ?? []);
  const conflicts: ValueConflict[] = raw?.conflicts ?? [];
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const move = (index: number, direction: "up" | "down") => {
    const next = [...priorities];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setPriorities(next.map((p, i) => ({ ...p, rank: i + 1 })));
    setIsDirty(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      await reorderPriorities(priorities);
      setIsDirty(false);
    });
  };

  if (priorities.length === 0) {
    return <p className="text-sm text-muted-foreground">No priorities saved yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-6 space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Your priorities
        </p>
        {priorities.map((priority, index) => (
          <div key={priority.area} className="flex items-start gap-3 py-2">
            <span className="text-xs font-bold text-muted-foreground w-5 mt-0.5 flex-shrink-0">
              {priority.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{priority.area}</p>
              <p className="text-xs text-muted-foreground">{priority.description}</p>
            </div>
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                onClick={() => move(index, "up")}
                disabled={index === 0 || isPending}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => move(index, "down")}
                disabled={index === priorities.length - 1 || isPending}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {isDirty && (
          <div className="pt-3 border-t mt-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save order"}
            </Button>
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Potential tensions
          </p>
          {conflicts.map((conflict, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 space-y-1.5">
              <p className="text-sm font-medium text-amber-700">{conflict.area}</p>
              <p className="text-xs text-muted-foreground">{conflict.tension}</p>
              <p className="text-xs text-muted-foreground italic">{conflict.suggestedFrame}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "priorities-tab"
```

Expected: no output.

---

## Task 7: Create `vision-tab.tsx`

**Files:**
- Create: `app/(app)/life-planning/components/vision-tab.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState, useTransition } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertCircle, RotateCcw } from "lucide-react";
import type { RealityCheckCard } from "@/lib/ai/life-planning";
import { updateVisionStatement } from "../actions";

interface VisionTabProps {
  lifePlan: LifePlan;
  onRerunWizard: () => void;
}

export function VisionTab({ lifePlan, onRerunWizard }: VisionTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(lifePlan.visionStatement);
  const [currentVision, setCurrentVision] = useState(lifePlan.visionStatement);
  const [currentCards, setCurrentCards] = useState<RealityCheckCard[]>(
    (lifePlan.realityCheck as RealityCheckCard[] | null) ?? []
  );
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateVisionStatement(editValue);
      setCurrentVision(editValue);
      setCurrentCards([]);
      setIsEditing(false);
    });
  };

  return (
    <div className="space-y-6">
      {/* Vision statement — moss-green callout */}
      <div className="bg-[#f0f4ee] border border-[#c8d9c0] rounded-xl p-6 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Shared vision
        </p>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || !editValue.trim()}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditValue(currentVision);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm leading-relaxed">{currentVision}</p>
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Reality check cards */}
      {isPending && (
        <p className="text-xs text-muted-foreground">Refreshing reality check…</p>
      )}
      {!isPending && currentCards.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Reality check
          </p>
          {currentCards.map((card, i) => (
            <div key={i} className="bg-card border rounded-xl p-4 flex items-start gap-3">
              {card.status === "on-track" ? (
                <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{card.title}</p>
                <p className="text-xs text-muted-foreground">{card.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(lifePlan.updatedAt).toLocaleDateString()}
        </p>
        <Button variant="outline" size="sm" onClick={onRerunWizard} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Re-run wizard
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "vision-tab"
```

Expected: no output.

---

## Task 8: Create `life-plan-tabs.tsx`

**Files:**
- Create: `app/(app)/life-planning/components/life-plan-tabs.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState } from "react";
import type { LifePlan } from "@/app/generated/prisma/client";
import { VisionTab } from "./vision-tab";
import { PrioritiesTab } from "./priorities-tab";
import { InsightsTab } from "./insights-tab";

type TabId = "vision" | "priorities" | "insights";

interface Snapshot {
  alignmentScore: number | null;
  signals: unknown;
  createdAt: Date;
}

interface LifePlanTabsProps {
  lifePlan: LifePlan;
  snapshot: Snapshot | null;
  onRerunWizard: () => void;
}

export function LifePlanTabs({ lifePlan, snapshot, onRerunWizard }: LifePlanTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("vision");

  const tabs: { id: TabId; label: string }[] = [
    { id: "vision", label: "Vision" },
    { id: "priorities", label: "Priorities" },
    { id: "insights", label: "Insights" },
  ];

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "vision" && (
        <VisionTab lifePlan={lifePlan} onRerunWizard={onRerunWizard} />
      )}
      {activeTab === "priorities" && <PrioritiesTab lifePlan={lifePlan} />}
      {activeTab === "insights" && (
        <InsightsTab
          snapshot={snapshot}
          lastReviewedAt={lifePlan.lastReviewedAt ?? null}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "life-plan-tabs"
```

Expected: no output.

---

## Task 9: Create `life-plan-page-view.tsx`

**Files:**
- Create: `app/(app)/life-planning/components/life-plan-page-view.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LifePlan } from "@/app/generated/prisma/client";
import { LifePlanTabs } from "./life-plan-tabs";
import { LifePlanningFlow } from "./life-planning-flow";

interface Snapshot {
  alignmentScore: number | null;
  signals: unknown;
  createdAt: Date;
}

interface LifePlanPageViewProps {
  lifePlan: LifePlan;
  snapshot: Snapshot | null;
}

export function LifePlanPageView({ lifePlan, snapshot }: LifePlanPageViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"tabs" | "wizard">("tabs");

  if (view === "wizard") {
    return (
      <LifePlanningFlow
        existingLifePlan={lifePlan}
        forceIntro
        onComplete={() => {
          router.refresh();
          setView("tabs");
        }}
      />
    );
  }

  return (
    <LifePlanTabs
      lifePlan={lifePlan}
      snapshot={snapshot}
      onRerunWizard={() => setView("wizard")}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "life-plan-page-view"
```

Expected: no output (will fail until Task 10 adds `forceIntro` to `LifePlanningFlow`).

---

## Task 10: Update `life-planning-flow.tsx`

**Files:**
- Modify: `app/(app)/life-planning/components/life-planning-flow.tsx`

- [ ] **Step 1: Update the props interface and component signature**

Replace the `LifePlanningFlowProps` interface and component definition:

```typescript
interface LifePlanningFlowProps {
  existingLifePlan: LifePlan | null;
  forceIntro?: boolean;
  onComplete?: () => void;
}

export function LifePlanningFlow({
  existingLifePlan,
  forceIntro,
  onComplete,
}: LifePlanningFlowProps) {
  const [step, setStep] = useState<Step>(
    forceIntro ? "intro" : existingLifePlan ? "saved" : "intro"
  );
```

- [ ] **Step 2: Update the `saveLifePlan` call in the "review" step handler**

Find the `onSave` callback in the `if (step === "review")` block and replace the `startTransition` body:

```typescript
onSave={(editedData) => {
  startTransition(async () => {
    await saveLifePlan({
      visionStatement: editedData.vision,
      roadmap: editedData.roadmap,
      priorities: { priorities: editedData.priorities, conflicts },
      visionAnswers: answers,
      lifePlanId: existingLifePlan?.id,
    });
    if (onComplete) {
      onComplete();
    } else {
      window.location.href = "/life-planning";
    }
  });
}}
```

- [ ] **Step 3: Remove the SavedLifePlan import and "saved" step**

Remove the import line:
```typescript
import { SavedLifePlan } from "./saved-life-plan";
```

Remove the entire `if (step === "saved" && existingLifePlan)` block (around lines 211-218 in original file).

Also remove `"saved"` from the `Step` type union:
```typescript
type Step = "intro" | "questions" | "vision" | "reality" | "priorities" | "roadmap" | "review" | "complete";
```

- [ ] **Step 4: Delete `saved-life-plan.tsx`**

```bash
rm /Users/moliu/dev/parity-app/app/\(app\)/life-planning/components/saved-life-plan.tsx
```

- [ ] **Step 5: Verify the flow file compiles**

```bash
npx tsc --noEmit 2>&1 | grep "life-planning-flow\|saved-life-plan"
```

Expected: no output.

---

## Task 11: Update `page.tsx`

**Files:**
- Modify: `app/(app)/life-planning/page.tsx`

- [ ] **Step 1: Replace the entire page file**

```typescript
import { getExistingLifePlan, getLatestSnapshot } from "./actions";
import { LifePlanningFlow } from "./components/life-planning-flow";
import { LifePlanPageView } from "./components/life-plan-page-view";

export default async function LifePlanningPage() {
  const [{ lifePlan }, { snapshot }] = await Promise.all([
    getExistingLifePlan(),
    getLatestSnapshot(),
  ]);

  if (!lifePlan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Design Your Shared Life</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Before we talk numbers, let's design the life you want together.
          </p>
        </div>
        <LifePlanningFlow existingLifePlan={null} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Shared Life Plan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vision, priorities, and plan-vs-reality insights.
        </p>
      </div>
      <LifePlanPageView lifePlan={lifePlan} snapshot={snapshot} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "life-planning/page"
```

Expected: no output.

- [ ] **Step 3: Start the dev server and manually test**

```bash
npm run dev
```

Visit `http://localhost:3000/life-planning` logged in as `mo@parity.app`.

- If Mo has an existing life plan: confirm the tabbed page appears with Vision / Priorities / Insights tabs.
- Click each tab and confirm it renders without errors.
- Click "Edit" on the vision statement, change text, save — confirm it updates.
- Click "Re-run wizard" — confirm the wizard starts at the intro step.
- Click through wizard and save — confirm you're returned to tabs with refreshed data.
- If no life plan: confirm the wizard shows normally.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma lib/ai/life-planning.ts \
  app/\(app\)/life-planning/actions.ts \
  app/\(app\)/life-planning/components/vision-tab.tsx \
  app/\(app\)/life-planning/components/priorities-tab.tsx \
  app/\(app\)/life-planning/components/insights-tab.tsx \
  app/\(app\)/life-planning/components/life-plan-tabs.tsx \
  app/\(app\)/life-planning/components/life-plan-page-view.tsx \
  app/\(app\)/life-planning/components/life-planning-flow.tsx \
  app/\(app\)/life-planning/page.tsx
git commit -m "feat: life plan tabbed page with vision editing and priority reordering"
```

---

## Task 12: Monthly review integration

**Files:**
- Modify: `app/(app)/review/actions.ts`

- [ ] **Step 1: Add imports at the top of `review/actions.ts`**

Add after the existing imports:

```typescript
import { generatePlanInsights } from "@/lib/ai/life-planning";
import { getTopCategories } from "@/lib/transactions";
```

Note: `getTopCategories` may already be imported — check first and skip if so.

- [ ] **Step 2: Update `completeReview` to generate and save life plan insights**

Replace the entire `completeReview` function:

```typescript
export async function completeReview(data: {
  month: string;
  insight: string;
  decisionsCount: number;
  mood?: string;
}) {
  const { partnership } = await getPartnership();

  await (db.reviewHistory.create as any)({
    data: {
      partnershipId: partnership.id,
      month: data.month,
      insight: data.insight,
      decisionsCreated: data.decisionsCount,
      mood: data.mood,
    },
  });

  // Generate life plan insights if a life plan exists
  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (lifePlan) {
    const raw = lifePlan.priorities as
      | { priorities: Array<{ rank: number; area: string; description: string }> }
      | undefined;
    const priorities = raw?.priorities ?? [];

    if (priorities.length > 0) {
      const topCategories = await getTopCategories(partnership.id, data.month);
      const thisMonthTotal = topCategories.reduce((sum, c) => sum + c.amount, 0);

      const insights = await generatePlanInsights(
        partnership.id,
        priorities,
        topCategories,
        thisMonthTotal
      );

      await (db.lifePlanSnapshot as any).upsert({
        where: { lifePlanId_month: { lifePlanId: lifePlan.id, month: data.month } },
        create: {
          lifePlanId: lifePlan.id,
          month: data.month,
          alignmentScore: insights.alignmentScore,
          signals: insights.signals,
          priorities,
        },
        update: {
          alignmentScore: insights.alignmentScore,
          signals: insights.signals,
        },
      });

      await db.lifePlan.update({
        where: { id: lifePlan.id },
        data: { lastReviewedAt: new Date() },
      });
    }
  }

  invalidateReviewCache(partnership.id);

  revalidatePath("/review");
  revalidatePath("/dashboard");
  revalidatePath("/life-planning");
  return { success: true };
}
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "review/actions"
```

Expected: no output.

- [ ] **Step 4: Test monthly review integration**

Start the dev server if not running. Go to `http://localhost:3000/review`. Complete a review for the current month. After completion, visit `/life-planning` → Insights tab. Confirm:
- Alignment score appears (0-100%)
- Signal cards appear with Aligned / Tension / Neutral labels
- "Last updated" date in footer matches today

- [ ] **Step 5: Final build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add app/\(app\)/review/actions.ts
git commit -m "feat: generate life plan insights on monthly review completion"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| Tabbed page (Vision / Priorities / Insights) | Tasks 5-8, 11 |
| Vision statement editable inline | Task 7 |
| Reality check cards with On track / Watch badges | Tasks 2, 4, 7 |
| Re-run wizard button | Tasks 9, 10 |
| Returning users see tabbed page, first-timers see wizard | Task 11 |
| Ranked priorities list | Task 6 |
| Priority reordering (up/down) | Task 6 |
| Potential tensions section | Task 6 |
| Spending alignment score | Task 5 |
| Signal cards (aligned/tension/neutral) | Task 5 |
| Placeholder when no snapshot | Task 5 |
| `LifePlanSnapshot` model | Task 1 |
| `lastReviewedAt`, `visionAnswers`, `realityCheck` on LifePlan | Task 1 |
| Monthly review saves snapshot | Task 12 |
| `lastReviewedAt` updated on review | Task 12 |
| Wizard save updates existing plan (upsert) | Task 4, 10 |
| `visionAnswers` stored for re-run pre-population | Tasks 4, 10 |
| `saved-life-plan.tsx` removed | Task 10 |
