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
import { Plus, Trash2, Pencil } from "lucide-react";
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

  const [goals, members, contributions, accounts, allocations] = await Promise.all([
    db.goal.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.membership.findMany({
      where: { partnershipId: partnership.id },
      include: { user: true },
    }),
    db.goalContribution.findMany({
      where: {
        goal: {
          partnershipId: partnership.id,
        },
      },
    }),
    db.account.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.goalAllocation.findMany({
      where: {
        goal: {
          partnershipId: partnership.id,
        },
      },
    }),
  ]);

  const partnerUserId = members.find((m) => m.userId !== userId)?.userId;
  const partnerMember = members.find((m) => m.userId !== userId);
  const partnerName = partnerMember?.user.name ?? "Partner";

  // Group goals by ownership
  const jointGoals = goals.filter((g) => (g as any).ownerLabel === "JOINT");
  const myGoals = goals.filter((g) => (g as any).ownerLabel === "PERSONAL" && (g as any).userId === userId);
  const partnerGoals = goals.filter((g) => (g as any).ownerLabel === "PERSONAL" && (g as any).userId !== userId);

  // Calculate totals for each section
  const totalJoint = jointGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalMine = myGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalPartner = partnerGoals.reduce((sum, g) => sum + g.currentAmount, 0);

  // Summary stats
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalRemaining = Math.max(0, totalTarget - totalSaved);
  const completedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount).length;

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
          currentUserId={userId}
          partnerUserId={partnerUserId}
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
        <div className="grid grid-cols-3 gap-4">
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
                Amount Left
              </p>
              <p className="text-3xl font-bold tabular-nums text-amber-700 leading-none">
                {formatCurrency(totalRemaining)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
                Achieved
              </p>
              <p className="text-3xl font-bold tabular-nums text-moss leading-none">
                {completedGoals}/{goals.length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {goals.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-semibold">No goals yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a shared financial goal to track together.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Joint goals section - full width */}
          <GoalGroup
            label="Joint"
            goals={jointGoals}
            total={totalJoint}
            userId={userId}
            allocations={allocations}
            accounts={accounts}
            contributions={contributions}
            members={members}
            partnerUserId={partnerUserId}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            getMonthsUntil={getMonthsUntil}
            isJoint
          />
          {/* Individual goals - two columns below */}
          <div className="grid gap-6 md:grid-cols-2">
            <GoalGroup
              label="Mine"
              goals={myGoals}
              total={totalMine}
              userId={userId}
              allocations={allocations}
              accounts={accounts}
              contributions={contributions}
              members={members}
              partnerUserId={partnerUserId}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getMonthsUntil={getMonthsUntil}
              isJoint={false}
            />
            <GoalGroup
              label={partnerName}
              goals={partnerGoals}
              total={totalPartner}
              userId={userId}
              allocations={allocations}
              accounts={accounts}
              contributions={contributions}
              members={members}
              partnerUserId={partnerUserId}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getMonthsUntil={getMonthsUntil}
              isJoint={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GoalGroup({
  label,
  goals,
  total,
  userId,
  allocations,
  accounts,
  contributions,
  members,
  partnerUserId,
  formatCurrency,
  formatDate,
  getMonthsUntil,
  isJoint,
}: {
  label: string;
  goals: Awaited<ReturnType<typeof db.goal.findMany>>;
  total: number;
  userId: string;
  allocations: any[];
  accounts: any[];
  contributions: any[];
  members: any[];
  partnerUserId: string | undefined;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  getMonthsUntil: (date: Date) => string;
  isJoint: boolean;
}) {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {goals.length} goal{goals.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <span className="text-base font-bold tabular-nums text-moss">
            {formatCurrency(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No goals added yet.
          </p>
        ) : (
          <div className="space-y-4">
            {goals.map((goal, index) => (
              <div key={goal.id}>
                <GoalRow
                  goal={goal}
                  userId={userId}
                  allocations={allocations}
                  accounts={accounts}
                  contributions={contributions}
                  members={members}
                  partnerUserId={partnerUserId}
                  formatCurrency={formatCurrency}
                  formatDate={formatDate}
                  getMonthsUntil={getMonthsUntil}
                  isJoint={isJoint}
                />
                {index < goals.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalRow({
  goal,
  userId,
  allocations,
  accounts,
  contributions,
  members,
  partnerUserId,
  formatCurrency,
  formatDate,
  getMonthsUntil,
  isJoint,
}: {
  goal: any;
  userId: string;
  allocations: any[];
  accounts: any[];
  contributions: any[];
  members: any[];
  partnerUserId: string | undefined;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
  getMonthsUntil: (date: Date) => string;
  isJoint: boolean;
}) {
  const pct = Math.min(
    100,
    goal.targetAmount > 0
      ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
      : 0
  );
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const isMine = (goal as any).userId === userId;

  // Calculate contributions for this goal
  const goalContributions = contributions.filter((c) => c.goalId === goal.id);
  const contributionsByUser: Record<string, number> = {};
  for (const c of goalContributions) {
    contributionsByUser[c.userId] = (contributionsByUser[c.userId] ?? 0) + c.amount;
  }

  // Get allocations for this goal
  const goalAllocations = allocations.filter((a) => a.goalId === goal.id);

  // Build contribution display data for joint goals
  const contributionDisplay = members
    .map((m) => {
      const contributed = contributionsByUser[m.userId] ?? 0;
      const allocation = goalAllocations.find((a) => a.userId === m.userId)?.percentage ?? 50;
      const obligatedAmount = (goal.targetAmount * allocation) / 100;
      const progressPct = obligatedAmount > 0 ? Math.min(100, Math.round((contributed / obligatedAmount) * 100)) : 0;
      const isOnTrack = progressPct >= pct;

      return {
        userId: m.userId,
        name: m.user.name,
        amount: contributed,
        allocation,
        obligatedAmount,
        progressPct,
        isOnTrack,
      };
    })
    .filter((c) => c.amount > 0 || isJoint);

  return (
    <div
      className="relative flex items-center justify-between p-4 pr-16 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors group"
    >
      {/* Add progress button - top right corner */}
      <div className="absolute right-2 top-2">
        <UpdateProgress
          goalId={goal.id}
          currentAmount={goal.currentAmount}
          isJoint={isJoint}
          accounts={accounts}
          currentUserId={userId}
          goalAllocations={goalAllocations}
        />
      </div>

      {/* Left side: goal title and allocation */}
      <div className="w-48 shrink-0 pr-4">
        {goal.targetDate && (
          <p className="text-xs text-muted-foreground mb-1">
            {formatDate(goal.targetDate)} · {getMonthsUntil(goal.targetDate)}
          </p>
        )}
        <p className="text-sm font-medium truncate">{goal.name}</p>
        {isJoint && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {contributionDisplay.map((c) => `${c.name} ${c.allocation}%`).join(" / ")}
          </p>
        )}
      </div>

      {/* Middle: progress bars */}
      <div className="flex-1 min-w-0">
        {/* Overall progress bar */}
        <div className="mt-6">
          <Progress value={pct} className="h-1.5" variant="moss" />
          <div className="flex justify-between mt-0.5">
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
        </div>

        {/* Progress bars by person for joint goals */}
        {isJoint && contributionDisplay.length > 0 && (
          <div className="mt-2 space-y-1">
            {contributionDisplay.map((c) => (
              <div key={c.userId} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12 truncate">
                  {c.name}
                </span>
                <span className="text-xs font-medium w-8 text-right" style={{ color: "#a9c3b2" }}>
                  {c.progressPct}%
                </span>
                <div className="flex-1 h-1 bg-secondary/50 rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${c.progressPct}%`, backgroundColor: "#a9c3b2" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right side: amount */}
      <div className="text-right ml-4 shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {formatCurrency(goal.currentAmount)}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatCurrency(goal.targetAmount)} target
        </p>
      </div>

      {/* Action buttons */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-md">
        <GoalForm
          goal={goal}
          existingAllocations={goalAllocations}
          currentUserId={userId}
          partnerUserId={partnerUserId}
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
        {(isJoint || isMine) && (
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
        )}
      </div>
    </div>
  );
}
