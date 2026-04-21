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
import { UpdateProgress } from "./update-progress";
import { deleteGoal } from "./actions";

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

  const partnerUserId = members.find((m) => m.userId !== userId)?.userId;

  // Split goals into active and completed
  const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount);
  const archivedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount);

  // Summary stats (only count active goals)
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const completedGoals = archivedGoals.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {goals.length} goal{goals.length !== 1 ? "s" : ""}
          </p>
        </div>
        <GoalForm
          trigger={
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" />
              New goal
            </Button>
          }
        />
      </div>

      {/* Summary strip */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
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
          <Card className="shadow-card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
                Achieved
              </p>
              <p className="text-3xl font-bold tabular-nums text-moss leading-none">
                {completedGoals}/{activeGoals.length + completedGoals}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {goals.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="font-semibold">No goals yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create shared goals to track your progress together.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Goals */}
          {activeGoals.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Active Goals</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {activeGoals.length} goal{activeGoals.length !== 1 ? "s" : ""} in progress
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {activeGoals.map((goal, index) => (
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
                      {index < activeGoals.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Achieved Goals */}
          {archivedGoals.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Achieved Goals</CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {archivedGoals.length} achieved goal{archivedGoals.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {archivedGoals.map((goal, index) => (
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
                      {index < archivedGoals.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
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
  goal: any;
  userId: string;
  accounts: any[];
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  getMonthsUntil: (date: Date) => string;
  isActive: boolean;
}) {
  const pct = Math.min(
    100,
    goal.targetAmount > 0
      ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
      : 0
  );
  const isComplete = goal.currentAmount >= goal.targetAmount;

  return (
    <div
      className="relative flex items-center gap-6 p-4 pr-16 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors group"
    >
      {/* Add progress button - top right corner */}
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

      {/* Left side: goal title */}
      <div className="w-56 shrink-0">
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

      {/* Progress bar + amount */}
      <div className="flex items-center gap-6">
        <div className="w-24">
          <Progress value={pct} className="h-1.5" variant="moss" />
          <div className="mt-0.5">
            <span className="text-xs text-muted-foreground">{pct}%</span>
            {isComplete && <span className="text-xs text-emerald-600 ml-1">✓</span>}
          </div>
        </div>
        <div className="text-right w-24">
          <p className="text-sm font-semibold tabular-nums">
            {formatCurrency(goal.currentAmount)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            of {formatCurrency(goal.targetAmount)}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-md">
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
