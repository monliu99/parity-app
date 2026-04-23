import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { getDashboardSynthesis } from "@/lib/ai/insights";
import { getRollingBaseline, getTopCategories } from "@/lib/transactions";
import { CATEGORY_CHART_COLORS, DEFAULT_CHART_COLOR } from "@/lib/category-colors";
import { getCurrentOnboardingStep } from "@/lib/onboarding";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SynthesisCard } from "./synthesis-card";
import { LifePlanCard } from "./life-plan-card";
import { OnboardingFlow } from "@/app/(app)/onboarding/onboarding-flow";
import Link from "next/link";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function DashboardPage() {
  const { partnership, userId } = await getPartnership();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [accounts, goals, members, lifePlan, baseline, topCategories, lifePlanCount] =
    await Promise.all([
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
    ]);

  const myName = members.find((m) => m.userId === userId)?.user.name ?? null;
  const partnerName =
    members.find((m) => m.userId !== userId)?.user.name ?? "Partner";
  const hasPartner = members.some((m) => m.userId !== userId);
  const pageTitle = hasPartner && myName
    ? `${myName} & ${partnerName}'s Dashboard`
    : myName
      ? `${myName}'s Dashboard`
      : "Dashboard";

  // Net worth
  const jointAccounts = accounts.filter((a) => (a as any).userId === null);
  const jointTotal = jointAccounts.reduce((sum, a) => sum + a.balance, 0);
  const myAccounts = accounts.filter((a) => (a as any).userId === userId);
  const mineTotal = myAccounts.reduce((sum, a) => sum + a.balance, 0);
  const partnerAccounts = accounts.filter((a) => (a as any).userId !== null && (a as any).userId !== userId);
  const partnerTotal = partnerAccounts.reduce((sum, a) => sum + a.balance, 0);
  const combinedNetWorth = jointTotal + mineTotal + partnerTotal;

  // Goals summary
  const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount);
  const totalGoalProgress = activeGoals.length > 0
    ? Math.round(
        activeGoals.reduce(
          (sum, g) => sum + (g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0),
          0
        ) / activeGoals.length * 100
      )
    : 0;

  // AI synthesis
  const synthesis = await getDashboardSynthesis(
    partnership.id,
    goals,
    accounts,
    baseline
  );

  // Onboarding state
  const currentStep = getCurrentOnboardingStep(
    accounts.length,
    lifePlanCount,
    goals.length,
    members.length
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your financial picture, together.
        </p>
      </div>

      <OnboardingFlow
        currentStep={currentStep}
        inviteCode={partnership.inviteCode}
        partnershipId={partnership.id}
      >
        <>
          {/* AI synthesis */}
          <SynthesisCard insight={synthesis} />

          {/* Life Plan Vision */}
          <LifePlanCard
            visionStatement={lifePlan?.visionStatement ?? null}
            roadmap={lifePlan?.roadmap ?? null}
            currentMonth={currentMonth}
          />

          {/* Net Worth + Spending Baseline row */}
          <div className="grid gap-5 md:grid-cols-2 items-stretch">
            {/* Net Worth */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Combined Net Worth
                  </p>
                  <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                    {formatCurrency(combinedNetWorth)}
                  </p>
                </div>

                <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Joint</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(jointTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mine</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(mineTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{partnerName}&apos;s</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(partnerTotal)}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3 flex-1 flex items-end">
                  <Link href="/settings/accounts" className="text-xs text-primary hover:underline">
                    Manage accounts →
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Spending Baseline */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Spending Baseline
                  </p>
                  {baseline ? (
                    <>
                      <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                        {formatCurrency(baseline.average)}
                        <span className="text-base font-normal text-muted-foreground">/mo</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {baseline.months.length}-month average of your actual spending.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-foreground leading-tight mt-2">—</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add transactions to see your monthly baseline.
                      </p>
                    </>
                  )}
                </div>
                {topCategories.length > 0 && (
                  <div className="px-5 py-3 border-t border-border/50 space-y-2.5">
                    {topCategories.map((c) => {
                      const pct = baseline && baseline.average > 0
                        ? Math.round((c.amount / baseline.average) * 100)
                        : 0;
                      const color = CATEGORY_CHART_COLORS[c.category] ?? DEFAULT_CHART_COLOR;
                      return (
                        <div key={c.category}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{c.category}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold tabular-nums">{formatCurrency(c.amount)}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="px-5 py-3 flex-1 flex items-end">
                  <Link href="/settings/transactions" className="text-xs text-primary hover:underline">
                    {baseline ? "View transactions →" : "Add transactions →"}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Goals Progress */}
          <Card className="shadow-card overflow-hidden">
            <CardContent className="p-0 h-full flex flex-col">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                  Goals
                </p>
                <Link href="/goals" className="text-xs text-primary hover:underline font-medium">
                  Details →
                </Link>
              </div>

              {activeGoals.length === 0 ? (
                <div className="px-5 py-4 flex-1 flex items-center">
                  <p className="text-sm text-muted-foreground">No active goals yet.</p>
                </div>
              ) : (
                <div className="px-5 py-2 flex-1 space-y-4">
                  {activeGoals.slice(0, 3).map((goal) => {
                    const pct = goal.targetAmount > 0
                      ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
                      : 0;
                    return (
                      <div key={goal.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium truncate pr-2">{goal.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground shrink-0">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" variant="moss" />
                        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                          {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                        </p>
                      </div>
                    );
                  })}
                  {activeGoals.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{activeGoals.length - 3} more goal{activeGoals.length - 3 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}

              {activeGoals.length > 0 && (
                <div className="px-5 py-3 border-t border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Overall progress</span>
                    <span className="text-xs font-medium tabular-nums">{totalGoalProgress}%</span>
                  </div>
                  <Progress value={totalGoalProgress} className="h-1.5" variant="moss" />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      </OnboardingFlow>
    </div>
  );
}
