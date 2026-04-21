import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { getDashboardSynthesis } from "@/lib/ai/insights";
import { getMonthlyBaseline } from "@/lib/budget";
import { getCurrentOnboardingStep } from "@/lib/onboarding";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SynthesisCard } from "./synthesis-card";
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

  const [accounts, goals, members, baseline, lifePlanCount] = await Promise.all([
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
    getMonthlyBaseline(partnership.id),
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

  // Net worth — properly handle joint accounts
  const jointAccounts = accounts.filter((a) => a.userId === null);
  const jointTotal = jointAccounts.reduce((sum, a) => sum + a.balance, 0);
  const myAccounts = accounts.filter((a) => a.userId === userId);
  const mineTotal = myAccounts.reduce((sum, a) => sum + a.balance, 0);
  const partnerAccounts = accounts.filter((a) => a.userId !== null && a.userId !== userId);
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

  // Monthly baseline
  const monthlyBaseline = baseline
    ? baseline.monthlyFixed + baseline.monthlyVariable
    : null;

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

          {/* Top Row: Net Worth, Budget Baseline, Goals */}
          <div className="grid gap-5 md:grid-cols-3 items-stretch">
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

            {/* Monthly Baseline */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Monthly Baseline
                  </p>
                  {monthlyBaseline !== null ? (
                    <>
                      <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                        {formatCurrency(monthlyBaseline)}
                        <span className="text-base font-normal text-muted-foreground">/mo</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Your estimated cost of life together.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-foreground leading-tight mt-2">—</p>
                      <p className="text-xs text-muted-foreground mt-1">Set your budget to see your monthly baseline.</p>
                    </>
                  )}
                </div>
                {baseline && (
                  <div className="px-5 py-3 border-t border-border/50 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Fixed</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(baseline.monthlyFixed)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Variable</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(baseline.monthlyVariable)}</p>
                    </div>
                  </div>
                )}
                <div className="px-5 py-3 flex-1 flex items-end">
                  <Link href="/budget" className="text-xs text-primary hover:underline">
                    {baseline ? "Update budget →" : "Set up budget →"}
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Goals */}
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
          </div>
        </>
      </OnboardingFlow>
    </div>
  );
}
