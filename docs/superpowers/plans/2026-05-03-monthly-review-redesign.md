# Monthly Review Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 7-step review wizard with a single-page review that shows plan-vs-spending alignment, tension/on-track signals, a conversation starter, inline decision logging, and AI-suggested adjustments.

**Architecture:** No schema changes. `startReview` is expanded to call `generatePlanInsights` (alignment score + signals) and `generateReviewSuggestions` (Part 2 action suggestions) in one shot. A new `review-page.tsx` renders both parts client-side. `review-flow.tsx` is simplified to 3 states: prompt → review → done. Five old step components are deleted.

**Tech Stack:** Prisma 7 (Neon/PostgreSQL), Next.js 16 App Router server actions, Anthropic Haiku, Tailwind 4, shadcn/ui base-ui components

---

## File Map

**Create:**
- `app/(app)/review/components/review-page.tsx` — Single-page client component: Part 1 (score, signals, conversation starter, decisions) + Part 2 (AI suggestions + manual overrides)

**Modify:**
- `lib/ai/monthly-review.ts` — Add `ReviewSuggestion` interface; add `generateReviewSuggestions`
- `app/(app)/review/actions.ts` — Update `startReview` (returns alignment + signals + suggestions); update `completeReview` (add `/goals` revalidation); add `applyReviewSuggestions`
- `app/(app)/review/components/review-flow.tsx` — Simplify to 3 states (prompt/review/done); import and render `ReviewPage`

**Delete:**
- `app/(app)/review/components/celebration-card.tsx`
- `app/(app)/review/components/spending-summary.tsx`
- `app/(app)/review/components/insight-discussion.tsx`
- `app/(app)/review/components/decision-logger.tsx`
- `app/(app)/review/components/schedule-next.tsx`

---

## Task 1: Add `ReviewSuggestion` type and `generateReviewSuggestions`

**Files:**
- Modify: `lib/ai/monthly-review.ts`

- [ ] **Step 1: Add `ReviewSuggestion` interface after the `ReviewInsight` interface (around line 17)**

```typescript
export interface ReviewSuggestion {
  id: string;
  type: "reschedule" | "add_action" | "adjust_goal" | "mark_complete";
  title: string;
  explanation: string;
  targetId?: string;
  newValue?: string | number;
}
```

- [ ] **Step 2: Add `generateReviewSuggestions` before the `invalidateReviewCache` function**

```typescript
export async function generateReviewSuggestions(
  signals: import("@/lib/ai/life-planning").PlanInsight[],
  goals: Array<{ id: string; name: string; type: string; targetAmount: number; month: number | null; completedAt: Date | null }>
): Promise<ReviewSuggestion[]> {
  try {
    const activeGoals = goals.filter((g) => !g.completedAt);
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: `You are Parity's monthly review assistant. Based on spending signals and current goals/actions, suggest 2-4 specific adjustments the couple could make.

Return ONLY valid JSON — an array of suggestion objects:
[{
  "id": "s1",
  "type": "reschedule" | "add_action" | "adjust_goal" | "mark_complete",
  "title": "short action title (under 8 words)",
  "explanation": "one sentence why (under 15 words)",
  "targetId": "<existing goal id if type is reschedule/adjust_goal/mark_complete, omit for add_action>",
  "newValue": <new month number 1-12 for reschedule, new amount for adjust_goal, omit otherwise>
}]

Types:
- reschedule: push an existing action to next month
- add_action: create a new action goal
- adjust_goal: change a goal's target amount
- mark_complete: mark an existing action done

Only reference goal IDs from the provided list. Use "you both" framing.`,
      messages: [
        {
          role: "user",
          content: `Signals from this month's review:
${signals.map((s) => `- [${s.status}] ${s.title}: ${s.description}`).join("\n")}

Current goals/actions:
${activeGoals.length > 0
  ? activeGoals.map((g) => `- id: "${g.id}", name: "${g.name}", type: "${g.type}", target: $${g.targetAmount}`).join("\n")
  : "None"}

Generate 2-4 suggested adjustments as JSON array.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as ReviewSuggestion[];
    const validIds = new Set(activeGoals.map((g) => g.id));
    return parsed.filter((s) => {
      if (s.type !== "add_action" && s.targetId && !validIds.has(s.targetId)) return false;
      return true;
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Verify no type errors in this file**

```bash
npx tsc --noEmit 2>&1 | grep "monthly-review.ts"
```

Expected: no output.

---

## Task 2: Update `startReview` in `actions.ts`

**Files:**
- Modify: `app/(app)/review/actions.ts`

- [ ] **Step 1: Add imports at the top of the file (after existing imports)**

```typescript
import { generatePlanInsights } from "@/lib/ai/life-planning";
import type { PlanInsight } from "@/lib/ai/life-planning";
import { generateReviewSuggestions } from "@/lib/ai/monthly-review";
import type { ReviewSuggestion } from "@/lib/ai/monthly-review";
```

Note: `getTopCategories` and `getSpendingComparison` are already imported — skip if present.

- [ ] **Step 2: Replace the entire `startReview` function**

```typescript
export async function startReview(month: string) {
  const { partnership } = await getPartnership();

  const [goals, decisions, spending, topCategories, lifePlan] = await Promise.all([
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    db.decision.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getSpendingComparison(partnership.id, month),
    getTopCategories(partnership.id, month, 8),
    db.lifePlan.findFirst({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const spendingData = {
    thisMonth: spending.thisMonth,
    lastMonth: spending.lastMonth,
    topCategories,
  };

  const insight = await generateReviewInsight(
    partnership.id,
    month,
    goals,
    decisions,
    { ...spending, topCategories }
  );

  let alignmentScore = 0;
  let signals: PlanInsight[] = [];
  if (lifePlan) {
    const raw = lifePlan.priorities as
      | { priorities: Array<{ rank: number; area: string; description: string }> }
      | undefined;
    const priorities = raw?.priorities ?? [];
    if (priorities.length > 0) {
      const thisMonthTotal = topCategories.reduce((sum, c) => sum + c.amount, 0);
      const planInsights = await generatePlanInsights(
        partnership.id,
        priorities,
        topCategories,
        thisMonthTotal
      );
      alignmentScore = planInsights.alignmentScore;
      signals = planInsights.signals;
    }
  }

  const goalSummaries = goals.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    month: g.month ?? null,
    completedAt: g.completedAt ?? null,
  }));

  const suggestions: ReviewSuggestion[] = await generateReviewSuggestions(signals, goalSummaries);

  return { insight, month, spendingData, alignmentScore, signals, suggestions, goals: goalSummaries };
}
```

- [ ] **Step 3: Verify the actions file compiles**

```bash
npx tsc --noEmit 2>&1 | grep "review/actions"
```

Expected: no output.

---

## Task 3: Update `completeReview` and add `applyReviewSuggestions`

**Files:**
- Modify: `app/(app)/review/actions.ts`

- [ ] **Step 1: Add `revalidatePath("/goals")` inside `completeReview` after the existing revalidations**

Find the revalidatePath block in `completeReview` (around line 143-146) and add the goals path:

```typescript
  revalidatePath("/review");
  revalidatePath("/dashboard");
  revalidatePath("/life-planning");
  revalidatePath("/goals");
  return { success: true };
```

- [ ] **Step 2: Add `applyReviewSuggestions` action after `completeReview`**

```typescript
export async function applyReviewSuggestions(suggestions: ReviewSuggestion[]) {
  const { partnership } = await getPartnership();

  const partnershipGoals = await db.goal.findMany({
    where: { partnershipId: partnership.id },
    select: { id: true },
  });
  const validIds = new Set(partnershipGoals.map((g) => g.id));

  for (const suggestion of suggestions) {
    try {
      switch (suggestion.type) {
        case "reschedule":
          if (suggestion.targetId && validIds.has(suggestion.targetId) && typeof suggestion.newValue === "number") {
            await db.goal.update({
              where: { id: suggestion.targetId },
              data: { month: suggestion.newValue },
            });
          }
          break;
        case "add_action":
          await db.goal.create({
            data: {
              partnershipId: partnership.id,
              name: suggestion.title,
              type: "action",
              targetAmount: 0,
              notes: suggestion.explanation,
            },
          });
          break;
        case "adjust_goal":
          if (suggestion.targetId && validIds.has(suggestion.targetId) && typeof suggestion.newValue === "number") {
            await db.goal.update({
              where: { id: suggestion.targetId },
              data: { targetAmount: suggestion.newValue },
            });
          }
          break;
        case "mark_complete":
          if (suggestion.targetId && validIds.has(suggestion.targetId)) {
            await db.goal.update({
              where: { id: suggestion.targetId },
              data: { completedAt: new Date() },
            });
          }
          break;
      }
    } catch {
      // skip failed suggestions, don't block the whole apply
    }
  }

  revalidatePath("/goals");
  revalidatePath("/life-planning");
  return { success: true };
}
```

- [ ] **Step 3: Verify the file compiles**

```bash
npx tsc --noEmit 2>&1 | grep "review/actions"
```

Expected: no output.

---

## Task 4: Create `review-page.tsx`

**Files:**
- Create: `app/(app)/review/components/review-page.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import type { PlanInsight, ReviewInsight } from "@/lib/ai/life-planning";
import type { ReviewSuggestion } from "@/lib/ai/monthly-review";

interface GoalSummary {
  id: string;
  name: string;
  type: string;
  targetAmount: number;
  month: number | null;
  completedAt: Date | null;
}

interface ReviewPageProps {
  month: string;
  alignmentScore: number;
  signals: PlanInsight[];
  insight: ReviewInsight;
  suggestions: ReviewSuggestion[];
  goals: GoalSummary[];
  onComplete: () => void;
}

function alignmentLabel(score: number): string {
  if (score >= 75) return "Your spending mostly reflects your priorities.";
  if (score >= 50) return "Your spending partially reflects your priorities.";
  return "Your spending has some misalignment with your priorities.";
}

export function ReviewPage({
  month,
  alignmentScore,
  signals,
  insight,
  suggestions,
  goals,
  onComplete,
}: ReviewPageProps) {
  const [showPart2, setShowPart2] = useState(false);
  const [currentDecision, setCurrentDecision] = useState("");
  const [decisions, setDecisions] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const tensions = signals.filter((s) => s.status === "tension");
  const onTrack = signals.filter((s) => s.status !== "tension");

  const addDecision = () => {
    const trimmed = currentDecision.trim();
    if (!trimmed) return;
    setDecisions((prev) => [...prev, trimmed]);
    setCurrentDecision("");
  };

  const removeDecision = (index: number) => {
    setDecisions((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSuggestion = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    startTransition(async () => {
      const { completeReview, applyReviewSuggestions } = await import("../actions");

      const monthLabel = new Date(month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

      // Save decisions as Decision records + create ReviewHistory
      if (decisions.length > 0) {
        const { logDecision } = await import("../actions");
        await Promise.all(
          decisions.map((title) =>
            logDecision({ title, context: "", outcome: title, category: "OTHER" })
          )
        );
      }

      await completeReview({
        month,
        insight: insight.insight,
        decisionsCount: decisions.length,
      });

      const selectedSuggestions = suggestions.filter((s) => selectedIds.has(s.id));
      if (selectedSuggestions.length > 0) {
        await applyReviewSuggestions(selectedSuggestions);
      }

      onComplete();
    });
  };

  const displayMonth = new Date(`${month}-01`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-xl space-y-6">
      {/* Score hero */}
      <div className="bg-[#f0f4ee] border border-[#c8d9c0] rounded-xl p-6 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {displayMonth} alignment
        </p>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-bold">{alignmentScore}%</span>
        </div>
        <p className="text-sm text-muted-foreground">{alignmentLabel(alignmentScore)}</p>
      </div>

      {/* Signal cards */}
      {signals.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {/* Tensions — left */}
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              Tensions
            </p>
            {tensions.length === 0 && (
              <p className="text-xs text-muted-foreground italic">None this month</p>
            )}
            {tensions.map((s, i) => (
              <div key={i} className="border border-amber-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.description}</p>
                {s.priority && (
                  <p className="text-xs text-muted-foreground">↳ {s.priority}</p>
                )}
              </div>
            ))}
          </div>

          {/* On track — right */}
          <div className="space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              On track
            </p>
            {onTrack.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Keep going</p>
            )}
            {onTrack.map((s, i) => (
              <div key={i} className="border border-emerald-200 rounded-xl p-3 space-y-1">
                <p className="text-xs font-medium leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.description}</p>
                {s.priority && (
                  <p className="text-xs text-muted-foreground">↳ {s.priority}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation starter */}
      {insight.insight && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-800">Worth discussing together</p>
          <p className="text-sm text-amber-900">{insight.insight}</p>
          {insight.frame && (
            <p className="text-xs text-amber-700 italic">{insight.frame}</p>
          )}
        </div>
      )}

      {/* Decisions */}
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium">What did you both decide?</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentDecision}
            onChange={(e) => setCurrentDecision(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDecision()}
            placeholder="Type a decision and press Enter"
            className="flex-1 text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" variant="outline" onClick={addDecision} disabled={!currentDecision.trim()}>
            Add
          </Button>
        </div>
        {decisions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {decisions.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-xs bg-secondary px-3 py-1.5 rounded-full"
              >
                {d}
                <button
                  onClick={() => removeDecision(i)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Next button (Part 1 → Part 2) */}
      {!showPart2 && (
        <Button onClick={() => setShowPart2(true)} className="gap-2">
          Next: Make adjustments
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Part 2: Take action */}
      {showPart2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-blue-700">Part 2 · Take action</p>
            <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">optional</span>
          </div>

          {suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">No adjustments suggested this month.</p>
          )}

          {suggestions.map((s) => (
            <label
              key={s.id}
              className={`flex items-start gap-3 border rounded-xl p-4 cursor-pointer transition-colors ${
                selectedIds.has(s.id) ? "bg-blue-50 border-blue-200" : "bg-card"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(s.id)}
                onChange={() => toggleSuggestion(s.id)}
                className="mt-0.5 h-4 w-4 rounded border-input accent-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.explanation}</p>
              </div>
            </label>
          ))}

          <Button onClick={handleApply} disabled={isPending}>
            {isPending ? "Saving..." : "Apply & complete review"}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "review-page"
```

Expected: no output.

---

## Task 5: Simplify `review-flow.tsx`

**Files:**
- Modify: `app/(app)/review/components/review-flow.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { ReviewPage } from "./review-page";
import type { PlanInsight, ReviewInsight } from "@/lib/ai/life-planning";
import type { ReviewSuggestion } from "@/lib/ai/monthly-review";

type Step = "prompt" | "review" | "done";

interface GoalSummary {
  id: string;
  name: string;
  type: string;
  targetAmount: number;
  month: number | null;
  completedAt: Date | null;
}

interface ReviewData {
  month: string;
  alignmentScore: number;
  signals: PlanInsight[];
  insight: ReviewInsight;
  suggestions: ReviewSuggestion[];
  goals: GoalSummary[];
}

interface ReviewFlowProps {
  shouldReview: boolean;
  reviewReason: string;
  urgency: "low" | "medium" | "high";
  currentMonth: string;
  pastReviews: Array<{ month: string; completedAt: Date; insight?: string | null }>;
}

export function ReviewFlow({
  shouldReview,
  reviewReason,
  currentMonth,
  pastReviews,
}: ReviewFlowProps) {
  const [step, setStep] = useState<Step>(shouldReview ? "prompt" : "done");
  const [isPending, startTransition] = useTransition();
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  if (step === "prompt") {
    return (
      <div className="max-w-xl">
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <p className="text-sm">{reviewReason}</p>
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Your monthly money date. 15 minutes, no fights, just alignment.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-background px-2 py-1 rounded">Alignment score</span>
              <span className="text-xs bg-background px-2 py-1 rounded">Tensions vs on-track</span>
              <span className="text-xs bg-background px-2 py-1 rounded">Log decisions</span>
            </div>
          </div>
          <Button
            onClick={() => {
              startTransition(async () => {
                const { startReview } = await import("../actions");
                const result = await startReview(currentMonth);
                setReviewData({
                  month: result.month,
                  alignmentScore: result.alignmentScore,
                  signals: result.signals,
                  insight: result.insight,
                  suggestions: result.suggestions,
                  goals: result.goals,
                });
                setStep("review");
              });
            }}
            disabled={isPending}
          >
            {isPending ? "Loading..." : "Start Review"}
          </Button>
        </div>

        {pastReviews.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-muted-foreground mb-2">Past reviews</p>
            <div className="space-y-2">
              {pastReviews.slice(0, 3).map((review) => (
                <div
                  key={review.month}
                  className="flex items-center gap-2 text-sm bg-card border rounded-lg p-3"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>
                    {new Date(review.month).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "review" && reviewData) {
    return (
      <ReviewPage
        month={reviewData.month}
        alignmentScore={reviewData.alignmentScore}
        signals={reviewData.signals}
        insight={reviewData.insight}
        suggestions={reviewData.suggestions}
        goals={reviewData.goals}
        onComplete={() => setStep("done")}
      />
    );
  }

  // done state (also shown when no review needed yet)
  return (
    <div className="max-w-xl">
      {shouldReview ? (
        <div className="bg-card border rounded-xl p-8 text-center space-y-4">
          <p className="text-3xl">✨</p>
          <h2 className="text-xl font-semibold">You're all set!</h2>
          <p className="text-sm text-muted-foreground">
            Nice work checking in together. We'll let you know when it's time for the next one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => {
                startTransition(async () => {
                  const { deleteCurrentMonthReview } = await import("../actions");
                  await deleteCurrentMonthReview(currentMonth);
                  setReviewData(null);
                  setStep("prompt");
                });
              }}
              disabled={isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restart this month's review
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-6 space-y-4">
          <p className="text-sm">Everything looks on track.</p>
          <p className="text-xs text-muted-foreground">
            We'll notify you when it's time for your next check-in.
          </p>
          {pastReviews.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Past reviews</p>
              <div className="space-y-2">
                {pastReviews.slice(0, 3).map((review) => (
                  <div
                    key={review.month}
                    className="flex items-center gap-2 text-sm bg-secondary/50 rounded-lg p-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>
                      {new Date(review.month).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "review-flow"
```

Expected: no output.

---

## Task 6: Delete old step components

**Files:**
- Delete: 5 files in `app/(app)/review/components/`

- [ ] **Step 1: Delete the obsolete step components**

```bash
rm /Users/moliu/dev/parity-app/app/\(app\)/review/components/celebration-card.tsx \
   /Users/moliu/dev/parity-app/app/\(app\)/review/components/spending-summary.tsx \
   /Users/moliu/dev/parity-app/app/\(app\)/review/components/insight-discussion.tsx \
   /Users/moliu/dev/parity-app/app/\(app\)/review/components/decision-logger.tsx \
   /Users/moliu/dev/parity-app/app/\(app\)/review/components/schedule-next.tsx
```

- [ ] **Step 2: Full type check to confirm no dangling imports**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (or errors unrelated to review components).

---

## Task 7: Verify and manual test

**Files:** none (verification only)

- [ ] **Step 1: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Manual test — full flow**

Login as `mo@parity.app`. Visit `http://localhost:3000/review`.

Verify:
1. "Start Review" button appears with reason text
2. Click "Start Review" — spinner shows for 3-5 sec
3. Score hero appears with alignment score (0-100%) and summary text
4. Signal cards appear in two columns: Tensions (amber) on left, On track (green) on right
5. Conversation starter appears in amber callout with `insight.insight` text
6. Type a decision into the text input and press Enter → chip appears
7. Remove a chip with the × button
8. Click "Next: Make adjustments →" → Part 2 appears
9. Part 2 shows 2-4 AI suggestion cards with checkboxes
10. Check one suggestion → checkbox toggles, card turns blue-tinted
11. Click "Apply & complete review" → loading state → done screen appears
12. Visit `/life-planning` → Insights tab → confirm alignment score updated
13. Visit `/goals` → confirm any "add_action" suggestions created new goals
14. On "Restart this month's review" → flow resets to prompt state

- [ ] **Step 4: Commit**

```bash
git add lib/ai/monthly-review.ts \
  app/\(app\)/review/actions.ts \
  app/\(app\)/review/components/review-page.tsx \
  app/\(app\)/review/components/review-flow.tsx
git commit -m "feat: monthly review redesign — alignment score, signal cards, inline decisions, AI suggestions"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| Single-page with Part 1 + Part 2 | Task 4 |
| Landing shows Start button; completed shows summary | Task 5 (done state in review-flow) |
| Start button triggers AI generation (one shot) | Task 2 |
| Score hero: alignment % + summary text | Task 4 |
| Signal cards split: Tensions left, On track right | Task 4 |
| Tension card: title + detail + linked priority | Task 4 |
| On-track card: title + detail + linked priority | Task 4 |
| Conversation starter (amber callout, one question) | Task 4 |
| Decisions text input + chip list with remove | Task 4 |
| "Next: Make adjustments →" button | Task 4 |
| Part 2 header: blue, marked optional | Task 4 |
| AI-suggested adjustments with checkboxes | Task 4 |
| Suggestion types: reschedule, add_action, adjust_goal, mark_complete | Tasks 1, 3 |
| "Apply & complete review" button | Task 4 |
| Save: create/update ReviewHistory | Tasks 3, 4 |
| Save: save LifePlanSnapshot with alignment score | Task 3 |
| Save: apply checked suggestions | Tasks 3, 4 |
| Save: update lifePlan.lastReviewedAt | Task 3 |
| Revalidate /review, /dashboard, /life-planning, /goals | Tasks 2, 3 |
| generatePlanInsights feeds score hero + signals | Task 2 |
| generateReviewSuggestions new function | Task 1 |
| Delete celebration-step, spending-summary, insight-discussion, decision-logging, schedule-next | Task 6 |
