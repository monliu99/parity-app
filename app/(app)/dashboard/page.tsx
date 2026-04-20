import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { getDashboardSynthesis } from "@/lib/ai/insights";
import { getCurrentOnboardingStep } from "@/lib/onboarding";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SpendingTrendsChart } from "./spending-trends-chart";
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
  return date.toLocaleDateString("en-US", { month: "long" });
}

export default async function DashboardPage() {
  const { partnership, userId } = await getPartnership();

  const now = new Date();

  // Window of interest: last 2 full months + current month (for MoM comparison + synthesis context)
  const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const [accounts, transactions, goals, totalTransactionCount, budgets, members] =
    await Promise.all([
      db.account.findMany({
        where: { partnershipId: partnership.id },
        orderBy: { createdAt: "asc" },
      }),
      db.transaction.findMany({
        where: {
          partnershipId: partnership.id,
          date: { gte: twoMonthsAgoStart },
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
      db.membership.findMany({
        where: { partnershipId: partnership.id },
        include: { user: true },
      }),
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
  // Joint accounts: userId is null (shared between partners)
  const jointAccounts = accounts.filter((a) => a.userId === null);
  const jointTotal = jointAccounts.reduce((sum, a) => sum + a.balance, 0);

  // Individual accounts: owned by specific user
  const myAccounts = accounts.filter((a) => a.userId === userId);
  const mineTotal = myAccounts.reduce((sum, a) => sum + a.balance, 0);

  const partnerAccounts = accounts.filter((a) => a.userId !== null && a.userId !== userId);
  const partnerTotal = partnerAccounts.reduce((sum, a) => sum + a.balance, 0);

  // Combined net worth = joint + mine + partner (counted once)
  const combinedNetWorth = jointTotal + mineTotal + partnerTotal;

  // Current + previous month transactions
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const currentMonthTxns = transactions.filter(
    (t) => new Date(t.date) >= currentMonthStart
  );
  const previousMonthTxns = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= previousMonthStart && d <= previousMonthEnd;
  });

  // Cash flow
  const currentMonthIncome = currentMonthTxns
    .filter((t) => t.category === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const currentMonthSpending = currentMonthTxns
    .filter((t) => t.category !== "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const currentMonthSavings = currentMonthIncome - currentMonthSpending;
  const savingsRate =
    currentMonthIncome > 0
      ? Math.round((currentMonthSavings / currentMonthIncome) * 100)
      : 0;

  const previousMonthIncome = previousMonthTxns
    .filter((t) => t.category === "Income")
    .reduce((sum, t) => sum + t.amount, 0);
  const previousMonthSpending = previousMonthTxns
    .filter((t) => t.category !== "Income")
    .reduce((sum, t) => sum + t.amount, 0);

  const incomeChange =
    previousMonthIncome > 0
      ? Math.round(((currentMonthIncome - previousMonthIncome) / previousMonthIncome) * 100)
      : 0;
  const spendingChange =
    previousMonthSpending > 0
      ? Math.round(
          ((currentMonthSpending - previousMonthSpending) / previousMonthSpending) * 100
        )
      : 0;

  // Month-over-month spending comparison (top categories by this month)
  const currentByCategory: Record<string, number> = {};
  const previousByCategory: Record<string, number> = {};
  for (const t of currentMonthTxns) {
    if (t.category !== "Income") {
      currentByCategory[t.category] = (currentByCategory[t.category] ?? 0) + t.amount;
    }
  }
  for (const t of previousMonthTxns) {
    if (t.category !== "Income") {
      previousByCategory[t.category] = (previousByCategory[t.category] ?? 0) + t.amount;
    }
  }
  const categorySet = new Set([
    ...Object.keys(currentByCategory),
    ...Object.keys(previousByCategory),
  ]);
  const momComparison = Array.from(categorySet)
    .map((category) => ({
      category,
      thisMonth: currentByCategory[category] ?? 0,
      lastMonth: previousByCategory[category] ?? 0,
    }))
    .sort((a, b) => b.thisMonth - a.thisMonth)
    .slice(0, 8);

  // Budget
  const budgetStatus = budgets.map((b) => ({
    category: b.category,
    budgeted: b.userAmount ?? b.suggestedAmount,
    actual: currentByCategory[b.category] || 0,
    over: (currentByCategory[b.category] || 0) > (b.userAmount ?? b.suggestedAmount),
  }));
  const totalBudgeted = budgets.reduce(
    (sum, b) => sum + (b.userAmount ?? b.suggestedAmount),
    0
  );
  const totalActual = budgets.reduce(
    (sum, b) => sum + (currentByCategory[b.category] || 0),
    0
  );
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
  const accountChangesSorted = [...accountChanges].sort(
    (a, b) => Math.abs(b.change) - Math.abs(a.change)
  );
  const biggestGain = accountChangesSorted.find((a) => a.change > 0);
  const biggestDrop = accountChangesSorted.find((a) => a.change < 0);

  // AI synthesis — single narrative insight
  const synthesis = await getDashboardSynthesis(
    partnership.id,
    transactions,
    goals,
    accounts,
    budgets.length > 0
      ? { totalBudgeted, totalSpent: totalActual }
      : null
  );

  // Onboarding state
  const currentStep = getCurrentOnboardingStep(
    accounts.length,
    totalTransactionCount,
    goals.length,
    members.length
  );
  const hasBudgets = budgets.length > 0;
  const hasSpending = currentMonthTxns.some((t) => t.category !== "Income");

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
        {/* Regular dashboard content — shown when onboarding is complete/dismissed */}
        <>
          {/* Hero: Parity's take — synthesized AI insight */}
          <SynthesisCard insight={synthesis} />

          {/* Top Row: Net Worth, Cash Flow, Budget Status */}
          <div className="grid gap-5 md:grid-cols-3 items-stretch">
            {/* Net Worth */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                {/* Header */}
                <div className="px-5 pt-5 pb-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Combined Net Worth
                  </p>
                  <p className="text-3xl font-bold text-foreground leading-tight tabular-nums mt-2">
                    {formatCurrency(combinedNetWorth)}
                  </p>
                </div>

                {/* Mine / Partner breakdown */}
                <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b border-border/50">
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

                {/* Account highlights */}
                <div className="px-5 py-3 flex-1">
                  {(biggestGain || biggestDrop) && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Biggest change this month</p>
                      <div className="space-y-2">
                        {biggestGain && (
                          <div className="flex items-center gap-2 rounded-md px-3 py-2">
                            <span className="text-xs text-moss-dark dark:text-moss font-medium tabular-nums">
                              ↑ {formatCurrency(biggestGain.change)}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {biggestGain.account.name}
                            </span>
                          </div>
                        )}
                        {biggestDrop && (
                          <div className="flex items-center gap-2 rounded-md px-3 py-2">
                            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium tabular-nums">
                              ↓ {formatCurrency(Math.abs(biggestDrop.change))}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {biggestDrop.account.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cash Flow */}
            <Card className="shadow-card overflow-hidden">
              <CardContent className="p-0 h-full flex flex-col">
                {/* Header */}
                <div className="px-5 pt-5 pb-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Cash Flow This Month
                  </p>
                </div>

                {/* Income row */}
                <div className="px-5 py-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Income</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(currentMonthIncome)}
                      </span>
                      <p className={`text-xs tabular-nums mt-0.5 ${
                        incomeChange === 0
                          ? "text-muted-foreground"
                          : incomeChange > 0
                            ? "text-moss-dark dark:text-moss"
                            : "text-amber-700 dark:text-amber-400"
                      }`}>
                        {incomeChange === 0 ? (
                          "Same as last month"
                        ) : (
                          <>{incomeChange > 0 ? "↑" : "↓"} {Math.abs(incomeChange)}% vs last month</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Spending row */}
                <div className="px-5 py-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Spending</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(currentMonthSpending)}
                      </span>
                      <p className={`text-xs tabular-nums mt-0.5 ${
                        spendingChange === 0
                          ? "text-muted-foreground"
                          : spendingChange < 0
                            ? "text-moss-dark dark:text-moss"
                            : "text-amber-700 dark:text-amber-400"
                      }`}>
                        {spendingChange === 0 ? (
                          "Same as last month"
                        ) : (
                          <>{spendingChange > 0 ? "↑" : "↓"} {Math.abs(spendingChange)}% vs last month</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Savings highlight */}
                <div className="px-5 py-4 mt-auto">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Saved</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        currentMonthSavings >= 0 ? "text-moss" : "text-amber-700"
                      }`}
                    >
                      {formatCurrency(Math.abs(currentMonthSavings))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-moss"
                        style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {savingsRate >= 0 ? savingsRate : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Budget Status */}
            {hasBudgets ? (
              <Card className="shadow-card overflow-hidden">
                <CardContent className="p-0 h-full flex flex-col">
                  {/* Header */}
                  <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                      Budget Status
                    </p>
                    <Link
                      href="/budget"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Details →
                    </Link>
                  </div>

                  {/* Main progress */}
                  <div className="px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        {getMonthLabel(0)}
                      </span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          budgetPct > 100
                            ? "text-amber-700"
                            : budgetPct >= 80
                              ? "text-amber-600"
                              : "text-moss"
                        }`}
                      >
                        {budgetPct}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(budgetPct, 100)}
                      className="h-2.5"
                      variant={
                        budgetPct > 100
                          ? "amber-dark"
                          : budgetPct >= 80
                            ? "amber-light"
                            : "moss"
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatCurrency(totalActual)} of {formatCurrency(totalBudgeted)} budgeted
                    </p>
                  </div>

                  {/* Categories over budget count */}
                  <div className="px-5 py-2 border-t border-border/50">
                    <p className={`text-xs font-medium ${
                      overBudgetCategories.length > 0
                        ? "text-amber-700"
                        : "text-moss"
                    }`}>
                      {overBudgetCategories.length} {overBudgetCategories.length === 1 ? "category" : "categories"} over budget
                    </p>
                  </div>

                  {/* Over budget categories list */}
                  {overBudgetCategories.length > 0 && (
                    <div className="mt-auto px-5 py-3 border-t border-border/50">
                      <div className="space-y-2">
                        {overBudgetCategories.slice(0, 3).map((b) => {
                          const overPct = Math.round(((b.actual - b.budgeted) / b.budgeted) * 100);
                          return (
                            <div key={b.category} className="flex items-center justify-between">
                              <span className="text-xs text-foreground">{b.category}</span>
                              <span className="text-xs font-medium tabular-nums text-amber-700">
                                +{formatCurrency(b.actual - b.budgeted)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-card">
                <CardContent className="pt-5 pb-5 h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground text-center">
                    Set budgets on the Budget page to track your spending here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Month-over-month spending comparison */}
          {hasSpending && (
            <div>
              <SectionLabel>Spending: This Month vs. Last Month</SectionLabel>
              <Card className="shadow-card">
                <CardContent className="pt-4">
                  <SpendingTrendsChart data={momComparison} />
                </CardContent>
              </Card>
            </div>
          )}
        </>
      </OnboardingFlow>
    </div>
  );
}
