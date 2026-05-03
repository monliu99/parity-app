import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { getLifePlanInsight } from "@/lib/ai/insights";
import { getRollingBaseline, getTopCategories } from "@/lib/transactions";
import { CATEGORY_CHART_COLORS, DEFAULT_CHART_COLOR } from "@/lib/category-colors";
import { getCurrentOnboardingStep } from "@/lib/onboarding";
import { Card, CardContent } from "@/components/ui/card";
import { LifePlanHero } from "./life-plan-card";
import { ActivityFeed, type ActivityItem } from "./activity-feed";
import { NextStepsCard } from "./next-steps-card";
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

  // Names
  const myName = members.find((m) => m.userId === userId)?.user.name ?? null;
  const partnerName =
    members.find((m) => m.userId !== userId)?.user.name ?? "Partner";
  const hasPartner = members.some((m) => m.userId !== userId);
  const myFirst = myName?.split(" ")[0] ?? null;
  const partnerFirst = partnerName.split(" ")[0];
  const pageTitle =
    hasPartner && myFirst ? `${myFirst} & ${partnerFirst}` : myFirst ?? "Dashboard";

  // Net worth — shared vs personal split
  const sharedAccounts = accounts.filter((a) => a.userId === null);
  const personalAccounts = accounts.filter((a) => a.userId !== null);
  const sharedTotal = sharedAccounts.reduce((sum, a) => sum + a.balance, 0);
  const personalTotal = personalAccounts.reduce((sum, a) => sum + a.balance, 0);
  const combinedNetWorth = sharedTotal + personalTotal;
  const sharedPct =
    combinedNetWorth > 0 ? Math.round((sharedTotal / combinedNetWorth) * 100) : 0;
  const personalPct = 100 - sharedPct;

  // Review nudge
  const daysSinceReview = lastReview
    ? Math.floor((Date.now() - lastReview.completedAt.getTime()) / 86400000)
    : null;
  const reviewDue = daysSinceReview !== null && daysSinceReview >= 30;

  // Onboarding state
  const currentStep = getCurrentOnboardingStep(
    accounts.length,
    lifePlanCount,
    goals.length,
    members.length
  );

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

  const insight =
    lifePlan?.visionStatement
      ? await getLifePlanInsight(
          partnership.id,
          lifePlan.visionStatement,
          combinedNetWorth,
          baseline?.average ?? null
        )
      : null;

  // Activity feed
  const activityItems: ActivityItem[] = [
    ...recentTransactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.user.name,
      type: "transaction" as const,
      description: `Logged ${t.category}${t.merchant ? ` — ${t.merchant}` : ""} · ${formatCurrency(Math.abs(t.amount))}`,
      createdAt: t.createdAt,
      avatarVariant: (t.userId === userId ? "primary" : "earthy") as "primary" | "earthy",
    })),
    ...recentContributions.map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.user.name,
      type: "goal_contribution" as const,
      description: `Added ${formatCurrency(c.amount)} to ${c.goal.name}`,
      createdAt: c.createdAt,
      avatarVariant: (c.userId === userId ? "primary" : "earthy") as "primary" | "earthy",
    })),
    ...recentGoalsCreated.map((g) => {
      const member = members.find((m) => m.userId === g.userId);
      return {
        id: `goal-${g.id}`,
        userId: g.userId ?? partnership.id,
        userName: member?.user.name ?? "You both",
        type: "goal_created" as const,
        description: `Created goal: ${g.name}`,
        createdAt: g.createdAt,
        avatarVariant: (g.userId === userId ? "primary" : "earthy") as "primary" | "earthy",
      };
    }),
    ...(lifePlan
      ? [
          {
            id: `lifeplan-${lifePlan.id}`,
            userId: partnership.id,
            userName: "You both",
            type: "life_plan" as const,
            description: "Updated your shared life plan",
            createdAt: lifePlan.updatedAt,
            avatarVariant: "primary" as "primary" | "earthy",
          },
        ]
      : []),
    ...(lastReview
      ? [
          {
            id: `review-${lastReview.month}`,
            userId: partnership.id,
            userName: "You both",
            type: "review" as const,
            description: `Completed ${lastReview.month} review`,
            createdAt: lastReview.completedAt,
            avatarVariant: "primary" as "primary" | "earthy",
          },
        ]
      : []),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

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
          {/* Life Plan Hero */}
          <LifePlanHero
            visionStatement={lifePlan?.visionStatement ?? null}
            currentAction={currentAction}
            progressCompleted={progressCompleted}
            progressTotal={progressTotal}
            insight={insight}
          />

          {/* Review nudge (conditional) */}
          {reviewDue && daysSinceReview !== null && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-100">
              <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-sm text-amber-800">
                It&apos;s been {daysSinceReview} days since your last review
              </span>
              <Link
                href="/review"
                className="text-sm font-semibold text-amber-700 hover:underline ml-auto shrink-0"
              >
                Start review →
              </Link>
            </div>
          )}

          {/* Net Worth + Spending — 2-col on sm+, stacked on mobile */}
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 items-stretch">
            {/* Net Worth */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Net Worth
                  </p>
                  {combinedNetWorth > 0 ? (
                    <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                      {formatCurrency(combinedNetWorth)}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-tight mt-2">$0</p>
                  )}
                </div>

                {combinedNetWorth > 0 && (
                  <div className="px-5 pb-3">
                    {/* Split bar */}
                    <div className="h-2 rounded-full overflow-hidden flex mb-2">
                      <div
                        className="h-full bg-primary rounded-l-full"
                        style={{ width: `${sharedPct}%` }}
                      />
                      <div
                        className="h-full bg-earthy flex-1 rounded-r-full"
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Shared {sharedPct}%</span>
                      <span className="text-xs text-muted-foreground">Personal {personalPct}%</span>
                    </div>
                  </div>
                )}

                <div className="px-5 py-3 flex-1 flex items-end border-t border-border/50">
                  {combinedNetWorth > 0 ? (
                    <Link href="/accounts" className="text-xs text-primary hover:underline">
                      Details →
                    </Link>
                  ) : (
                    <Link href="/accounts" className="text-xs text-primary hover:underline">
                      Add your first account →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Spending */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Monthly Spending
                  </p>
                  {baseline ? (
                    <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                      {formatCurrency(baseline.average)}
                      <span className="text-base font-normal text-muted-foreground">/mo</span>
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground leading-tight mt-2">—</p>
                  )}
                </div>

                {topCategories.length > 0 && (
                  <div className="px-5 pb-3 space-y-2">
                    <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
                      {topCategories.slice(0, 3).map((c, i) => {
                        const pct =
                          baseline && baseline.average > 0
                            ? (c.amount / baseline.average) * 100
                            : 0;
                        const color =
                          CATEGORY_CHART_COLORS[c.category] ?? DEFAULT_CHART_COLOR;
                        return (
                          <div
                            key={c.category}
                            className={`h-full ${i === 0 ? "rounded-l-full" : ""} ${i === topCategories.slice(0, 3).length - 1 ? "rounded-r-full" : ""}`}
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {topCategories.slice(0, 3).map((c) => {
                        const pct =
                          baseline && baseline.average > 0
                            ? Math.round((c.amount / baseline.average) * 100)
                            : 0;
                        const color =
                          CATEGORY_CHART_COLORS[c.category] ?? DEFAULT_CHART_COLOR;
                        return (
                          <div key={c.category} className="flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-sm shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {c.category} {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="px-5 py-3 flex-1 flex items-end border-t border-border/50">
                  {baseline ? (
                    <Link href="/transactions" className="text-xs text-primary hover:underline">
                      Details →
                    </Link>
                  ) : (
                    <Link href="/transactions" className="text-xs text-primary hover:underline">
                      Add transactions →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Next Steps + Activity Feed */}
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 items-start">
            <NextStepsCard goals={nextStepsGoals} />
            <ActivityFeed items={activityItems} />
          </div>
        </>
      </OnboardingFlow>
    </div>
  );
}
