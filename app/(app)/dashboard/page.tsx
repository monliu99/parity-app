import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { getSpendingInsights } from "@/lib/ai/insights";
import { shouldShowOnboarding, getCurrentOnboardingStep } from "@/lib/onboarding";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SpendingTrendsChart } from "./spending-trends-chart";
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

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
      {children}
    </p>
  );
}

function getMonthLabel(offset: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - offset);
  return date.toLocaleDateString("en-US", { month: "short" });
}

export default async function DashboardPage() {
  const { partnership, userId } = await getPartnership();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get data for the last 4 months
  const fourMonthsAgo = new Date(now);
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 3);
  fourMonthsAgo.setDate(1);
  fourMonthsAgo.setHours(0, 0, 0, 0);

  const [accounts, allTransactions, goals, totalTransactionCount, budgets] =
    await Promise.all([
      db.account.findMany({
        where: { partnershipId: partnership.id },
        orderBy: { createdAt: "asc" },
      }),
      db.transaction.findMany({
        where: {
          partnershipId: partnership.id,
          date: { gte: fourMonthsAgo },
        },
        include: { account: true },
        orderBy: { date: "desc" },
      }),
      db.goal.findMany({
        where: { partnershipId: partnership.id },
        orderBy: { createdAt: "asc" },
      }),
      db.transaction.count({
        where: { partnershipId: partnership.id },
      }),
      db.budget.findMany({
        where: {
          partnershipId: partnership.id,
          month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        },
      }),
    ]);

  // Net worth calculations
  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);
  const mineTotal = accounts
    .filter((a) => (a as any).userId === userId || (!(a as any).userId && a.ownerLabel === "MINE"))
    .reduce((sum, a) => sum + a.balance, 0);
  const partnerTotal = accounts
    .filter((a) => (a as any).userId !== userId && ((a as any).userId || a.ownerLabel === "PARTNER"))
    .reduce((sum, a) => sum + a.balance, 0);

  // Current month transactions
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthTxns = allTransactions.filter(
    (t) => new Date(t.date) >= currentMonthStart
  );
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const previousMonthTxns = allTransactions.filter(
    (t) => {
      const d = new Date(t.date);
      return d >= previousMonthStart && d <= previousMonthEnd;
    }
  );

  // Cash flow calculations
  const currentMonthIncome = currentMonthTxns
    .filter((t) => t.category === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const currentMonthSpending = currentMonthTxns
    .filter((t) => t.category !== "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const currentMonthSavings = currentMonthIncome - currentMonthSpending;
  const savingsRate = currentMonthIncome > 0 ? Math.round((currentMonthSavings / currentMonthIncome) * 100) : 0;

  const previousMonthIncome = previousMonthTxns
    .filter((t) => t.category === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const previousMonthSpending = previousMonthTxns
    .filter((t) => t.category !== "Income")
    .reduce((sum, t) => sum + t.amount, 0);

  // Month-over-month changes
  const incomeChange = previousMonthIncome > 0
    ? Math.round(((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100)
    : 0;
  const spendingChange = previousMonthSpending > 0
    ? Math.round(((currentMonthSpending - previousMonthSpending) / previousMonthSpending) * 100)
    : 0;

  // Recent transactions (top 5)
  const recentTransactions = allTransactions.slice(0, 5);

  // Top expenses this month
  const topExpenses = currentMonthTxns
    .filter((t) => t.category !== "Income")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Spending by category for trends chart (4 months)
  const monthlyData: Array<{ month: string; [key: string]: number | string }> = [];
  const allCategories = new Set<string>();

  for (let i = 3; i >= 0; i--) {
    const monthDate = new Date(now);
    monthDate.setMonth(monthDate.getMonth() - i);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const monthTxns = allTransactions.filter((t) => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    const monthData: { month: string; [key: string]: number } = {
      month: getMonthLabel(i),
    };

    for (const t of monthTxns) {
      if (t.category !== "Income") {
        monthData[t.category] = (monthData[t.category] || 0) + t.amount;
        allCategories.add(t.category);
      }
    }

    monthlyData.push(monthData);
  }

  // Budget health
  const currentMonthSpendingByCategory: Record<string, number> = {};
  for (const t of currentMonthTxns) {
    if (t.category !== "Income") {
      currentMonthSpendingByCategory[t.category] =
        (currentMonthSpendingByCategory[t.category] ?? 0) + t.amount;
    }
  }

  const budgetStatus = budgets.map((b) => ({
    category: b.category,
    budgeted: b.amount,
    actual: currentMonthSpendingByCategory[b.category] || 0,
    over: (currentMonthSpendingByCategory[b.category] || 0) > b.amount,
  }));

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalActual = budgets.reduce((sum, b) => sum + (currentMonthSpendingByCategory[b.category] || 0), 0);
  const budgetPct = totalBudgeted > 0 ? Math.round((totalActual / totalBudgeted) * 100) : 0;
  const overBudgetCategories = budgetStatus.filter((b) => b.over);

  // Account highlights (biggest change this month)
  const accountChanges = accounts.map((acc) => {
    const accountTxns = currentMonthTxns.filter((t) => t.accountId === acc.id);
    const change = accountTxns.reduce((sum, t) => {
      return t.category === "Income" ? sum + t.amount : sum - t.amount;
    }, 0);
    return { account: acc, change };
  });

  const accountChangesSorted = [...accountChanges].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const biggestGain = accountChangesSorted.find((a) => a.change > 0);
  const biggestDrop = accountChangesSorted.find((a) => a.change < 0);

  // Goal urgency
  const goalsWithUrgency = goals.map((goal) => {
    let urgency: "normal" | "warning" | "danger" | "success" = "normal";
    let urgencyText = "";

    if (goal.targetDate) {
      const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const pctComplete = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

      if (daysLeft < 0) {
        urgency = "danger";
        urgencyText = "Overdue";
      } else if (daysLeft <= 30 && pctComplete < 80) {
        urgency = "danger";
        urgencyText = `${daysLeft} days left`;
      } else if (daysLeft <= 60 && pctComplete < 50) {
        urgency = "warning";
        urgencyText = `${daysLeft} days left`;
      } else if (pctComplete >= 100) {
        urgency = "success";
        urgencyText = "Achieved!";
      } else if (daysLeft > 0) {
        urgencyText = `${daysLeft} days left`;
      }
    } else if (goal.currentAmount >= goal.targetAmount) {
      urgency = "success";
      urgencyText = "Achieved!";
    }

    return { ...goal, urgency, urgencyText };
  });

  // AI insights
  const insights = await getSpendingInsights(
    partnership.id,
    allTransactions,
    goals
  );

  const accountCount = accounts.length;
  const transactionCount = totalTransactionCount;
  const goalCount = goals.length;

  // Show onboarding if user hasn't completed all 3 steps
  const currentStep = getCurrentOnboardingStep(accountCount, transactionCount, goalCount);
  const showOnboarding = currentStep > 0;

  const hasSpending = currentMonthTxns.some((t) => t.category !== "Income");
  const hasGoals = goals.length > 0;
  const hasSpendingInsights = insights.spending.length > 0;
  const hasGoalsInsights = insights.goals.length > 0;
  const hasAnyInsights = hasSpendingInsights || hasGoalsInsights;
  const hasBudgets = budgets.length > 0;
  const categoriesList = Array.from(allCategories);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your financial picture, together.</p>
      </div>

      {showOnboarding ? (
        <OnboardingFlow currentStep={currentStep} />
      ) : (
        <>
          {/* Top Row: Net Worth, Cash Flow, Budget Status */}
          <div className="grid gap-4 md:grid-cols-3 items-stretch">
            {/* Net Worth with Account Highlights */}
            <Card className="shadow-card">
              <CardContent className="pt-5 pb-5 h-full flex flex-col justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">
                    Combined Net Worth
                  </p>
                  <p className="text-4xl font-bold text-foreground leading-none tabular-nums">
                    {formatCurrency(netWorth)}
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Mine</p>
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(mineTotal)}</p>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Partner&apos;s</p>
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(partnerTotal)}</p>
                  </div>
                </div>
                {(biggestGain || biggestDrop) && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    {biggestGain && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        +{formatCurrency(biggestGain.change)} in {biggestGain.account.name}
                      </p>
                    )}
                    {biggestDrop && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        {formatCurrency(biggestDrop.change)} in {biggestDrop.account.name}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cash Flow Summary */}
            <Card className="shadow-card">
              <CardContent className="pt-5 pb-5 h-full">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
                  Cash Flow This Month
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Income</span>
                    <div className="flex items-center gap-2">
                      {incomeChange !== 0 && (
                        <span className={`text-xs flex items-center gap-0.5 ${
                          incomeChange > 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {incomeChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(incomeChange)}%
                        </span>
                      )}
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(currentMonthIncome)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Spending</span>
                    <div className="flex items-center gap-2">
                      {spendingChange !== 0 && (
                        <span className={`text-xs flex items-center gap-0.5 ${
                          spendingChange < 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {spendingChange < 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(spendingChange)}%
                        </span>
                      )}
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(currentMonthSpending)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Saved</span>
                      <span className={`text-base font-bold tabular-nums ${
                        currentMonthSavings >= 0 ? "text-green-500" : "text-red-500"
                      }`}>
                        {formatCurrency(Math.abs(currentMonthSavings))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {savingsRate >= 0 ? savingsRate : 0}% savings rate
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget Health or Financial Pulse */}
            {hasBudgets ? (
              <Card className="shadow-card">
                <CardContent className="pt-5 pb-5 h-full">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                      Budget Status
                    </p>
                    <Link
                      href="/budget"
                      className="text-xs text-primary hover:underline"
                    >
                      Details →
                    </Link>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{getMonthLabel(0)}</span>
                      <span className={`text-xs font-medium ${
                        budgetPct > 100 ? "text-red-500" : budgetPct > 80 ? "text-yellow-500" : "text-green-500"
                      }`}>
                        {budgetPct}% used
                      </span>
                    </div>
                    <Progress value={Math.min(budgetPct, 100)} className="h-2" />
                  </div>
                  {overBudgetCategories.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">
                        {overBudgetCategories.length} category{overBudgetCategories.length > 1 ? "ies" : ""} over budget
                      </p>
                      <div className="space-y-1">
                        {overBudgetCategories.slice(0, 2).map((b) => (
                          <p key={b.category} className="text-xs text-red-500">
                            {b.category}: {formatCurrency(b.actual)} / {formatCurrency(b.budgeted)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : insights.overview.length > 0 ? (
              <Card className="shadow-card md:row-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    Financial Pulse
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {insights.overview.map((insight, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5">
                        <span className="text-muted-foreground mt-1 shrink-0">·</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-card md:row-span-1">
                <CardContent className="pt-5 pb-5 h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground text-center">
                    Set budgets on the Budget page to track your spending here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Spending Trends + Recent Activity + Goals */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
            {/* Spending Trends Chart */}
            {hasSpending && (
              <div className="lg:col-span-2">
                <SectionLabel>Spending Trends (4 months)</SectionLabel>
                <Card className="shadow-card">
                  <CardContent className="pt-4">
                    <SpendingTrendsChart data={monthlyData} categories={categoriesList} />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recent Activity */}
            <div className={hasSpending ? "" : "lg:col-span-2"}>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel>Recent Activity</SectionLabel>
                <Link
                  href="/transactions"
                  className="text-xs text-primary hover:underline"
                >
                  View All →
                </Link>
              </div>
              <Card className="shadow-card">
                <CardContent className="pt-3 space-y-3">
                  {recentTransactions.slice(0, 4).map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between py-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{txn.merchant}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {txn.account.name} • {formatRelativeDate(new Date(txn.date))}
                        </p>
                      </div>
                      <div className="text-right pl-3">
                        <p className={`text-sm font-semibold tabular-nums ${
                          txn.category === "Income" ? "text-green-500" : ""
                        }`}>
                          {txn.category === "Income" ? "+" : ""}{formatCurrency(txn.amount)}
                        </p>
                        <Badge variant="secondary" className="text-xs border-0 px-1.5 py-0">
                          {txn.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {recentTransactions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No transactions yet. Add your first one!
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Goals with Urgency */}
          {hasGoals && (
            <div>
              <SectionLabel>Goals</SectionLabel>
              <Card className="shadow-card">
                <CardContent className="pt-4 space-y-4">
                  {goalsWithUrgency.slice(0, 3).map((goal) => {
                    const pct = Math.min(
                      100,
                      goal.targetAmount > 0
                        ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                        : 0
                    );
                    return (
                      <div key={goal.id}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{goal.name}</span>
                            {(goal as any).ownerLabel === "JOINT" ? (
                              <Badge className="text-xs border-0 bg-secondary text-secondary-foreground px-1.5 py-0">Joint</Badge>
                            ) : (
                              <Badge className="text-xs border-0 bg-secondary text-secondary-foreground px-1.5 py-0">Personal</Badge>
                            )}
                            {goal.urgencyText && (
                              <Badge className={`text-xs border-0 px-1.5 py-0 ${
                                goal.urgency === "danger" ? "bg-red-500 text-white" :
                                goal.urgency === "warning" ? "bg-yellow-500 text-white" :
                                goal.urgency === "success" ? "bg-green-500 text-white" :
                                "bg-secondary text-secondary-foreground"
                              }`}>
                                {goal.urgencyText}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                          <span className="tabular-nums">{formatCurrency(goal.currentAmount)}</span>
                          <span className="tabular-nums">{formatCurrency(goal.targetAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Insights */}
          {hasAnyInsights && (
            <div className="grid gap-6 md:grid-cols-2 items-stretch">
              {/* Spending Insights */}
              {hasSpendingInsights && (
                <Card className="shadow-card h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Spending Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {insights.spending.map((insight, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-muted-foreground mt-1 shrink-0">·</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Goal Insights */}
              {hasGoalsInsights && (
                <Card className="shadow-card h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Goal Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {insights.goals.map((insight, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-muted-foreground mt-1 shrink-0">·</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        </>
      )}
    </div>
  );
}
