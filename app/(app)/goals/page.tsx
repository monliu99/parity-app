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
import { formatMonth } from "@/lib/format-month";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Pencil } from "lucide-react";
import { GoalForm } from "./goal-form";
import { ActionForm } from "./action-form";
import { UpdateProgress } from "./update-progress";
import { deleteGoal, toggleActionGoal, clearAllActions } from "./actions";
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
            <div className="flex items-center gap-2">
              {sortedActionGoals.length > 0 && (
                <form
                  action={async () => {
                    "use server";
                    await clearAllActions();
                  }}
                >
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Clear all
                  </Button>
                </form>
              )}
              <ActionForm
                trigger={
                  <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer gap-1">
                    <Plus className="h-3 w-3" />
                    Add action
                  </Button>
                }
              />
            </div>
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
            <span className="text-xs font-semibold text-primary">{formatMonth(goal.month!)} ·</span>
          )}
          {!isThisMonth && goal.month && (
            <span className="text-xs text-muted-foreground">{formatMonth(goal.month)}</span>
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
        <div className="flex sm:hidden gap-1 mt-1.5 -mb-0.5 justify-end">
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
