# Goals Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add roadmap action goals (binary completion) alongside financial goals, with auto-sync from life plan, a dashboard Next Steps card, and updated seed data.

**Architecture:** Extend the `Goal` model with `type`, `completedAt`, `month`, and `category` fields. Auto-create `type="action"` Goals when a LifePlan is saved. Restructure the Goals page into two sections (Roadmap Actions + Financial Goals). Add a read-only NextStepsCard to the dashboard.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (Neon/PostgreSQL), TypeScript, Tailwind 4, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `type`, `completedAt`, `month`, `category` to Goal |
| `app/(app)/goals/actions.ts` | Modify | Add `toggleActionGoal`, `createActionGoal`, `updateActionGoal` |
| `app/(app)/goals/action-form.tsx` | Create | Dialog for creating/editing action goals |
| `app/(app)/goals/page.tsx` | Modify | Two-section layout: Roadmap Actions + Financial Goals |
| `app/(app)/life-planning/actions.ts` | Modify | Call `syncRoadmapActions` after life plan save |
| `app/(app)/dashboard/next-steps-card.tsx` | Create | Read-only card: 3 upcoming incomplete actions |
| `app/(app)/dashboard/page.tsx` | Modify | Real action goal counts, current action from Goals table, NextStepsCard |
| `scripts/seed-class-demo.ts` | Modify | Add LifePlan + action Goals |

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to Goal model**

Open `prisma/schema.prisma`. Replace the Goal model (lines 59–73) with:

```prisma
model Goal {
  id            String              @id @default(cuid())
  partnershipId String
  userId        String?
  ownerLabel    String              @default("JOINT")
  name          String
  type          String              @default("financial")
  targetAmount  Float
  currentAmount Float               @default(0)
  month         Int?
  category      String?
  completedAt   DateTime?
  targetDate    DateTime?
  notes         String?
  createdAt     DateTime            @default(now())
  partnership   Partnership         @relation(fields: [partnershipId], references: [id], onDelete: Cascade)
  contributions GoalContribution[]
  allocations   GoalAllocation[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-goal-type-and-action-fields
```

Expected output includes: `✔ Generated Prisma Client`

- [ ] **Step 3: Verify type check**

```bash
npx tsc --noEmit
```

Expected: no errors (new fields have defaults; existing code is unaffected)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add type, completedAt, month, category fields to Goal model"
```

---

### Task 2: Goal Server Actions

**Files:**
- Modify: `app/(app)/goals/actions.ts`

- [ ] **Step 1: Add `toggleActionGoal`**

At the end of `app/(app)/goals/actions.ts`, append:

```typescript
export async function toggleActionGoal(id: string) {
  try {
    const { partnership } = await getPartnership();

    const goal = await db.goal.findFirst({
      where: { id, partnershipId: partnership.id, type: "action" },
    });
    if (!goal) return { error: "Goal not found" };

    await db.goal.updateMany({
      where: { id, partnershipId: partnership.id },
      data: { completedAt: goal.completedAt ? null : new Date() },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update goal" };
  }
}
```

- [ ] **Step 2: Add `createActionGoal`**

After `toggleActionGoal`, append:

```typescript
export async function createActionGoal(formData: FormData) {
  try {
    const { partnership } = await getPartnership();

    const name = formData.get("name") as string;
    const monthStr = formData.get("month") as string;
    const notes = (formData.get("notes") as string) || null;

    if (!name?.trim()) return { error: "Action name is required" };

    const month = monthStr ? parseInt(monthStr, 10) : null;
    if (month !== null && (isNaN(month) || month < 1 || month > 12)) {
      return { error: "Month must be between 1 and 12" };
    }

    await db.goal.create({
      data: {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name,
        type: "action",
        targetAmount: 0,
        month,
        notes,
      },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create action" };
  }
}
```

- [ ] **Step 3: Add `updateActionGoal`**

After `createActionGoal`, append:

```typescript
export async function updateActionGoal(id: string, formData: FormData) {
  try {
    const { partnership } = await getPartnership();

    const existing = await db.goal.findFirst({
      where: { id, partnershipId: partnership.id, type: "action" },
    });
    if (!existing) return { error: "Goal not found" };

    const name = formData.get("name") as string;
    const monthStr = formData.get("month") as string;
    const notes = (formData.get("notes") as string) || null;

    if (!name?.trim()) return { error: "Action name is required" };

    const month = monthStr ? parseInt(monthStr, 10) : null;
    if (month !== null && (isNaN(month) || month < 1 || month > 12)) {
      return { error: "Month must be between 1 and 12" };
    }

    await db.goal.updateMany({
      where: { id, partnershipId: partnership.id },
      data: { name, month, notes },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update action" };
  }
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/goals/actions.ts"
git commit -m "feat: add toggleActionGoal, createActionGoal, updateActionGoal server actions"
```

---

### Task 3: ActionForm Component

**Files:**
- Create: `app/(app)/goals/action-form.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createActionGoal, updateActionGoal } from "./actions";
import type { Goal } from "@/app/generated/prisma/client";

interface ActionFormProps {
  trigger: React.ReactElement;
  goal?: Goal;
}

export function ActionForm({ trigger, goal }: ActionFormProps) {
  const isEditing = !!goal;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEditing
        ? await updateActionGoal(goal.id, formData)
        : await createActionGoal(formData);
      if (result && "error" in result) {
        setError(result.error ?? null);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit action" : "Add action"}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Action</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Research neighborhoods, Book Europe trip"
              defaultValue={goal?.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="month">
              Month{" "}
              <span className="text-muted-foreground font-normal">(optional, 1–12)</span>
            </Label>
            <Input
              id="month"
              name="month"
              type="number"
              min="1"
              max="12"
              placeholder="e.g. 3"
              defaultValue={goal?.month ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Any context"
              defaultValue={goal?.notes ?? ""}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEditing ? "Save changes" : "Add action"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/goals/action-form.tsx"
git commit -m "feat: add ActionForm dialog for creating and editing action goals"
```

---

### Task 4: Goals Page Restructure

**Files:**
- Modify: `app/(app)/goals/page.tsx`

Complete rewrite. The existing `GoalRow` function is preserved verbatim. A new `ActionGoalRow` is added. The page component is restructured.

- [ ] **Step 1: Replace `app/(app)/goals/page.tsx` entirely**

```typescript
import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Pencil, Target } from "lucide-react";
import { GoalForm } from "./goal-form";
import { ActionForm } from "./action-form";
import { UpdateProgress } from "./update-progress";
import { deleteGoal, toggleActionGoal } from "./actions";
import { cn } from "@/lib/utils";
import type { Goal } from "@/app/generated/prisma/client";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getMonthsUntil(date: Date): string {
  const now = new Date();
  const target = new Date(date);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  if (months <= 0) return "Past due";
  if (months === 1) return "1 month away";
  return `${months} months away`;
}

const CATEGORY_CLASSES: Record<string, string> = {
  logistical: "bg-violet-50 text-violet-700",
  financial: "bg-primary/5 text-primary",
  experience: "bg-orange-50 text-orange-700",
};

export default async function GoalsPage() {
  const { partnership, userId } = await getPartnership();

  const [goals, members, accounts] = await Promise.all([
    db.goal.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.membership.findMany({
      where: { partnershipId: partnership.id },
      include: { user: true },
    }),
    db.account.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const actionGoals = goals.filter((g) => g.type === "action");
  const financialGoals = goals.filter((g) => g.type !== "action");

  const incompleteActions = actionGoals
    .filter((g) => !g.completedAt)
    .sort((a, b) => {
      if (a.month === null && b.month === null) return 0;
      if (a.month === null) return 1;
      if (b.month === null) return -1;
      return a.month - b.month;
    });
  const completedActions = actionGoals
    .filter((g) => !!g.completedAt)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  const sortedActionGoals = [...incompleteActions, ...completedActions];

  const thisMonthActionId = incompleteActions[0]?.id ?? null;
  const actionsCompleted = completedActions.length;
  const actionsTotal = actionGoals.length;
  const totalSaved = financialGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const activeFinancialGoals = financialGoals.filter((g) => g.currentAmount < g.targetAmount);
  const achievedFinancialGoals = financialGoals.filter((g) => g.currentAmount >= g.targetAmount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Goals</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {actionsTotal > 0 && `${actionsTotal} action${actionsTotal !== 1 ? "s" : ""}`}
          {actionsTotal > 0 && financialGoals.length > 0 && " · "}
          {financialGoals.length > 0 &&
            `${financialGoals.length} financial goal${financialGoals.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {goals.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="shadow-card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
                Actions Done
              </p>
              <p className="text-3xl font-bold tabular-nums text-moss leading-none">
                {actionsCompleted} of {actionsTotal}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
                Total Saved
              </p>
              <p className="text-3xl font-bold tabular-nums text-foreground leading-none">
                {formatCurrency(totalSaved)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Roadmap Actions */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Roadmap Actions</CardTitle>
              {actionsTotal > 0 && (
                <CardDescription className="mt-0.5 text-xs">
                  {incompleteActions.length} remaining · from your shared vision
                </CardDescription>
              )}
            </div>
            <ActionForm
              trigger={
                <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer gap-1">
                  <Plus className="h-3 w-3" />
                  Add action
                </Button>
              }
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {sortedActionGoals.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No actions yet. Complete your life plan to auto-populate roadmap actions.
              </p>
              <a href="/life-planning" className="text-sm text-primary hover:underline mt-2 block">
                Start life plan →
              </a>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sortedActionGoals.map((goal) => (
                <ActionGoalRow
                  key={goal.id}
                  goal={goal}
                  isThisMonth={goal.id === thisMonthActionId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Goals */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Financial Goals</CardTitle>
              {financialGoals.length > 0 && (
                <CardDescription className="mt-0.5 text-xs">
                  {activeFinancialGoals.length} active · {formatCurrency(totalSaved)} saved
                </CardDescription>
              )}
            </div>
            <GoalForm
              trigger={
                <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer gap-1">
                  <Plus className="h-3 w-3" />
                  New goal
                </Button>
              }
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {financialGoals.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No financial goals yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeFinancialGoals.map((goal, index) => (
                <div key={goal.id}>
                  <GoalRow
                    goal={goal}
                    userId={userId}
                    accounts={accounts}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getMonthsUntil={getMonthsUntil}
                    isActive
                  />
                  {index < activeFinancialGoals.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
              {achievedFinancialGoals.length > 0 && (
                <>
                  {activeFinancialGoals.length > 0 && <Separator />}
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-3">Achieved</p>
                    <div className="space-y-4">
                      {achievedFinancialGoals.map((goal, index) => (
                        <div key={goal.id}>
                          <GoalRow
                            goal={goal}
                            userId={userId}
                            accounts={accounts}
                            formatCurrency={formatCurrency}
                            formatDate={formatDate}
                            getMonthsUntil={getMonthsUntil}
                            isActive={false}
                          />
                          {index < achievedFinancialGoals.length - 1 && (
                            <Separator className="mt-4" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionGoalRow({ goal, isThisMonth }: { goal: Goal; isThisMonth: boolean }) {
  const isComplete = !!goal.completedAt;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 px-3 py-2.5 rounded-lg group",
        isThisMonth && !isComplete
          ? "bg-primary/5"
          : "hover:bg-secondary/50 transition-colors",
        isComplete && "opacity-60"
      )}
    >
      <form
        action={async () => {
          "use server";
          await toggleActionGoal(goal.id);
        }}
        className="mt-0.5 shrink-0"
      >
        <button
          type="submit"
          className="cursor-pointer"
          aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
        >
          <div
            className={cn(
              "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
              isComplete
                ? "bg-primary border-primary"
                : "border-muted-foreground/40 hover:border-primary"
            )}
          >
            {isComplete && (
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                <path
                  d="M1 3L3 5L7 1"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </button>
      </form>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", isComplete && "line-through text-muted-foreground")}>
          {goal.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isThisMonth && !isComplete && (
            <span className="text-xs font-semibold text-primary">This month ·</span>
          )}
          {goal.month && (
            <span className="text-xs text-muted-foreground">Month {goal.month}</span>
          )}
          {goal.category && (
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                CATEGORY_CLASSES[goal.category] ?? "bg-secondary text-muted-foreground"
              )}
            >
              {goal.category}
            </span>
          )}
        </div>
        {isComplete && goal.completedAt && (
          <p className="text-xs text-emerald-600 mt-0.5">
            Done ·{" "}
            {new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
              new Date(goal.completedAt)
            )}
          </p>
        )}
      </div>

      <div className="flex sm:hidden gap-1 mt-1 -mb-1 justify-end absolute right-2 top-2">
        <ActionForm
          goal={goal}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          }
        />
        <form
          action={async () => {
            "use server";
            await deleteGoal(goal.id);
          }}
        >
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </form>
      </div>
      <div className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-md">
        <ActionForm
          goal={goal}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <form
          action={async () => {
            "use server";
            await deleteGoal(goal.id);
          }}
        >
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  userId,
  accounts,
  formatCurrency,
  formatDate,
  getMonthsUntil,
  isActive,
}: {
  goal: Goal;
  userId: string;
  accounts: any[];
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  getMonthsUntil: (date: Date) => string;
  isActive: boolean;
}) {
  const pct = Math.min(
    100,
    goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0
  );
  const isComplete = goal.currentAmount >= goal.targetAmount;

  return (
    <div className="relative p-4 sm:pr-10 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors group">
      {isActive && (
        <div className="absolute right-2 top-2">
          <UpdateProgress
            goalId={goal.id}
            currentAmount={goal.currentAmount}
            isJoint={true}
            accounts={accounts}
            currentUserId={userId}
            goalAllocations={[]}
          />
        </div>
      )}
      <div>
        {goal.targetDate && (
          <p className="text-xs text-muted-foreground mb-1">
            {formatDate(goal.targetDate)} · {getMonthsUntil(goal.targetDate)}
          </p>
        )}
        <p className="text-sm font-medium truncate">{goal.name}</p>
        {goal.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{goal.notes}</p>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <Progress value={pct} className="h-1.5" variant="moss" />
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs text-muted-foreground">{pct}%</span>
          {isComplete && <span className="text-xs text-emerald-600 ml-1">✓</span>}
        </div>
      </div>
      <div className="mt-1 flex justify-between">
        <p className="text-xs font-semibold tabular-nums">{formatCurrency(goal.currentAmount)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          of {formatCurrency(goal.targetAmount)}
        </p>
      </div>
      <div className="flex sm:hidden gap-1 mt-2 -mb-1 justify-end">
        <GoalForm
          goal={goal}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
          }
        />
        <form
          action={async () => {
            "use server";
            await deleteGoal(goal.id);
          }}
        >
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </form>
      </div>
      <div className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-md">
        <GoalForm
          goal={goal}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <form
          action={async () => {
            "use server";
            await deleteGoal(goal.id);
          }}
        >
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, visit `http://localhost:3000/goals`. Confirm two sections render, existing financial goals appear, "Add action" and "New goal" buttons open the correct dialogs.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/goals/page.tsx"
git commit -m "feat: restructure goals page with roadmap actions and financial goals sections"
```

---

### Task 5: Auto-Sync on Life Plan Save

**Files:**
- Modify: `app/(app)/life-planning/actions.ts`

- [ ] **Step 1: Add `syncRoadmapActions` before `saveLifePlan`**

In `app/(app)/life-planning/actions.ts`, insert this function immediately before the `export async function saveLifePlan` declaration (currently around line 192). The `RoadmapItem` interface is already defined at line 228 — no need to re-declare it; move the declaration above this function or reference the existing one. Since the existing declaration is below, add a local one above `syncRoadmapActions`:

```typescript
async function syncRoadmapActions(
  partnershipId: string,
  roadmap: Array<{ month: number; title: string; description: string; category: string }>
): Promise<void> {
  const existingActions = await db.goal.findMany({
    where: { partnershipId, type: "action" },
    select: { name: true },
  });
  const existingNames = new Set(existingActions.map((g) => g.name));

  const toCreate = roadmap
    .filter((item) => item.category !== "financial" && !existingNames.has(item.title))
    .map((item) => ({
      partnershipId,
      userId: null as string | null,
      ownerLabel: "JOINT",
      name: item.title,
      type: "action",
      targetAmount: 0,
      month: item.month,
      category: item.category,
      notes: item.description || null,
    }));

  if (toCreate.length > 0) {
    await (db.goal.createMany as any)({ data: toCreate });
  }
}
```

- [ ] **Step 2: Call `syncRoadmapActions` inside `saveLifePlan`**

Replace the existing `saveLifePlan` function body with:

```typescript
export async function saveLifePlan(data: {
  visionStatement: string;
  roadmap: unknown;
  priorities: unknown;
}) {
  const { partnership } = await getPartnership();

  await (db.lifePlan.create as any)({
    data: {
      partnershipId: partnership.id,
      visionStatement: data.visionStatement,
      roadmap: data.roadmap,
      priorities: data.priorities,
    },
  });

  const roadmapItems = Array.isArray(data.roadmap)
    ? (data.roadmap as Array<{ month: number; title: string; description: string; category: string }>)
    : [];
  await syncRoadmapActions(partnership.id, roadmapItems);

  invalidateLifePlanCache(partnership.id);

  revalidatePath("/life-planning");
  revalidatePath("/goals");
  revalidatePath("/dashboard");

  return { success: true };
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/life-planning/actions.ts"
git commit -m "feat: auto-sync non-financial roadmap items as action goals on life plan save"
```

---

### Task 6: NextStepsCard Component

**Files:**
- Create: `app/(app)/dashboard/next-steps-card.tsx`

- [ ] **Step 1: Create the file**

```typescript
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

interface NextStepsGoal {
  id: string;
  name: string;
  month: number | null;
}

export function NextStepsCard({ goals }: { goals: NextStepsGoal[] }) {
  if (goals.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Next Steps
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Your roadmap actions will appear here once you create a life plan.
          </p>
          <Link
            href="/life-planning"
            className="text-sm text-primary font-medium hover:underline mt-3 block"
          >
            Create your life plan →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-0">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Next Steps
          </p>
        </div>
        <div className="px-3 pb-2 space-y-0.5">
          {goals.map((goal, i) => (
            <div
              key={goal.id}
              className={`flex items-start gap-2.5 px-2 py-2 rounded-lg${i === 0 ? " bg-primary/5" : ""}`}
            >
              <div className="h-3.5 w-3.5 rounded border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{goal.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {i === 0 ? (
                    <span className="font-medium text-primary">
                      This month{goal.month ? ` · Month ${goal.month}` : ""}
                    </span>
                  ) : goal.month ? (
                    `Month ${goal.month}`
                  ) : null}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border/50">
          <Link href="/goals" className="text-xs text-primary hover:underline">
            View all actions →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/dashboard/next-steps-card.tsx"
git commit -m "feat: add NextStepsCard dashboard component"
```

---

### Task 7: Dashboard Page Updates

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add import**

At the top of `app/(app)/dashboard/page.tsx`, add after the existing dashboard component imports:

```typescript
import { NextStepsCard } from "./next-steps-card";
```

- [ ] **Step 2: Remove `monthsSince` helper**

Delete the `monthsSince` function (lines 22–28) — it will no longer be used after this task.

- [ ] **Step 3: Expand the `Promise.all` to include 4 new queries**

Replace the destructured array and `Promise.all` opening:

```typescript
  const [
    accounts,
    goals,
    members,
    lifePlan,
    baseline,
    topCategories,
    lifePlanCount,
    recentTransactions,
    recentContributions,
    recentGoalsCreated,
    lastReview,
    actionGoalsCompleted,
    actionGoalsTotal,
    currentActionGoal,
    nextStepsGoals,
  ] = await Promise.all([
    db.account.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.goal.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.membership.findMany({
      where: { partnershipId: partnership.id },
      include: { user: true },
    }),
    db.lifePlan.findFirst({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
    }),
    getRollingBaseline(partnership.id),
    getTopCategories(partnership.id, currentMonth),
    db.lifePlan.count({ where: { partnershipId: partnership.id } }),
    db.transaction.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
    db.goalContribution.findMany({
      where: { goal: { partnershipId: partnership.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { name: true } },
        goal: { select: { name: true } },
      },
    }),
    db.goal.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.reviewHistory.findFirst({
      where: { partnershipId: partnership.id, skipped: false },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, month: true },
    }),
    db.goal.count({
      where: { partnershipId: partnership.id, type: "action", completedAt: { not: null } },
    }),
    db.goal.count({
      where: { partnershipId: partnership.id, type: "action" },
    }),
    db.goal.findFirst({
      where: { partnershipId: partnership.id, type: "action", completedAt: null },
      orderBy: [{ month: { sort: "asc", nulls: "last" } }],
    }),
    db.goal.findMany({
      where: { partnershipId: partnership.id, type: "action", completedAt: null },
      orderBy: [{ month: { sort: "asc", nulls: "last" } }],
      take: 3,
    }),
  ]);
```

- [ ] **Step 4: Replace the life plan computation block**

Find and replace this block (currently around lines 130–139):

```typescript
  // Life plan: current action + AI insight
  const roadmapArray = Array.isArray(lifePlan?.roadmap)
    ? (lifePlan.roadmap as Array<{ month: number; title: string; description: string }>)
    : [];
  const currentMonthIndex = lifePlan
    ? Math.min(Math.max(0, monthsSince(lifePlan.createdAt)), 11)
    : 0;
  const currentAction =
    roadmapArray.find((item) => item.month === currentMonthIndex + 1) ?? null;
  const progressTotal = roadmapArray.length || 12;
  const progressCompleted = 0; // placeholder until Goals spec lands
```

With:

```typescript
  // Life plan: current action and progress from Goal table (real data)
  const progressCompleted = actionGoalsCompleted;
  const progressTotal = actionGoalsTotal;
  const currentAction = currentActionGoal
    ? {
        month: currentActionGoal.month ?? 0,
        title: currentActionGoal.name,
        description: currentActionGoal.notes ?? "",
      }
    : null;
```

- [ ] **Step 5: Add `NextStepsCard` to the JSX**

In the return statement, find the `{/* Activity Feed */}` section. Insert `NextStepsCard` immediately before it:

```tsx
          {/* Next Steps */}
          <NextStepsCard goals={nextStepsGoals} />

          {/* Activity Feed */}
          <ActivityFeed items={activityItems} />
```

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Manual smoke test**

Run `npm run dev`, visit `http://localhost:3000/dashboard`. Confirm:
- NextStepsCard renders (empty state — no action goals yet for the logged-in user)
- Progress ring in LifePlanHero shows `0/0` (no action goals yet)
- No TypeScript errors in the browser console

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/dashboard/page.tsx"
git commit -m "feat: wire dashboard to real action goal counts and add NextStepsCard"
```

---

### Task 8: Seed Data Update

**Files:**
- Modify: `scripts/seed-class-demo.ts`

- [ ] **Step 1: Add life plan and action goals**

In `scripts/seed-class-demo.ts`, after the `goalContribution.createMany` block (currently ending around line 172), add:

```typescript
  // Life plan
  await (db.lifePlan.create as any)({
    data: {
      partnershipId: partnership.id,
      visionStatement:
        "You both picture yourselves settled in a walkable neighborhood with more space, building a family while doing meaningful work — and taking at least one big trip together every year.",
      roadmap: [
        { month: 1, title: "Set up a joint account for shared expenses", description: "Simplify splitting bills and tracking shared spending", category: "logistical" },
        { month: 2, title: "Align on a monthly savings target", description: "Decide how much to set aside together each month", category: "financial" },
        { month: 3, title: "Book Europe trip together", description: "Plan the itinerary and lock in flights before prices go up", category: "experience" },
        { month: 4, title: "Review and cut unused subscriptions", description: "Audit recurring charges and cancel what you don't use", category: "logistical" },
        { month: 6, title: "Research neighborhoods for your potential move", description: "Start exploring areas that fit your lifestyle goals", category: "logistical" },
        { month: 9, title: "Start a home buying readiness checklist", description: "Credit scores, pre-qualification, and what you'll need", category: "logistical" },
        { month: 12, title: "Annual money date", description: "Review the year together and set intentions for the next one", category: "logistical" },
      ],
      priorities: [
        { rank: 1, area: "Housing", description: "Finding a place that feels like home together" },
        { rank: 2, area: "Emergency Fund", description: "Building a safety net before big purchases" },
        { rank: 3, area: "Travel", description: "Staying connected through shared experiences" },
        { rank: 4, area: "Down Payment", description: "Long-term path to owning a home together" },
      ],
    },
  });

  // Action goals (non-financial roadmap items, 1 pre-completed for demo)
  await (db.goal.createMany as any)({
    data: [
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Set up a joint account for shared expenses",
        type: "action",
        targetAmount: 0,
        month: 1,
        category: "logistical",
        notes: "Simplify splitting bills and tracking shared spending",
        completedAt: new Date("2026-02-15"),
      },
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Book Europe trip together",
        type: "action",
        targetAmount: 0,
        month: 3,
        category: "experience",
        notes: "Plan the itinerary and lock in flights before prices go up",
        completedAt: null,
      },
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Review and cut unused subscriptions",
        type: "action",
        targetAmount: 0,
        month: 4,
        category: "logistical",
        notes: "Audit recurring charges and cancel what you don't use",
        completedAt: null,
      },
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Research neighborhoods for your potential move",
        type: "action",
        targetAmount: 0,
        month: 6,
        category: "logistical",
        notes: "Start exploring areas that fit your lifestyle goals",
        completedAt: null,
      },
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Start a home buying readiness checklist",
        type: "action",
        targetAmount: 0,
        month: 9,
        category: "logistical",
        notes: "Credit scores, pre-qualification, and what you'll need",
        completedAt: null,
      },
      {
        partnershipId: partnership.id,
        userId: null,
        ownerLabel: "JOINT",
        name: "Annual money date",
        type: "action",
        targetAmount: 0,
        month: 12,
        category: "logistical",
        notes: "Review the year together and set intentions for the next one",
        completedAt: null,
      },
    ],
  });
```

- [ ] **Step 2: Update the summary log line**

Replace:
```typescript
  console.log(`  Accounts: ${accounts.length} | Transactions: ${txData.length} | Goals: 3`);
```

With:
```typescript
  console.log(`  Accounts: ${accounts.length} | Transactions: ${txData.length} | Goals: 3 financial + 6 actions | Life plan: seeded`);
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-class-demo.ts
git commit -m "feat: add life plan and action goals to class demo seed data"
```
