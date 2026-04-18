import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { getBudgetInsight } from "@/lib/ai/budget";
import { BudgetEditor } from "./budget-editor";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function offsetMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthToDateRange(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(year, monthNum - 1, 1);
  const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
  return { start, end };
}

export interface TxRow {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  ownerLabel: string;
  userId: string | null;
  accountName: string;
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: qMonth } = await searchParams;
  const today = currentMonth();
  const selectedMonth = qMonth ?? today;
  const prevMonth = offsetMonth(selectedMonth, -1);
  const nextMonth = offsetMonth(selectedMonth, 1);

  const isPastMonth = selectedMonth < today;
  const isCurrentMonth = selectedMonth === today;

  const { partnership, userId: currentUserId } = await getPartnership();

  const { start, end } = monthToDateRange(selectedMonth);
  const { start: nextStart, end: nextEnd } = monthToDateRange(nextMonth);

  const [budgets, selectedMonthTxns, nextMonthBudgets, nextMonthTxns] = await Promise.all([
    db.budget.findMany({
      where: { partnershipId: partnership.id, month: selectedMonth },
      orderBy: { category: "asc" },
    }),
    db.transaction.findMany({
      where: {
        partnershipId: partnership.id,
        date: { gte: start, lte: end },
        category: { not: "Income" },
      },
      include: { account: true },
      orderBy: { date: "desc" },
    }),
    db.budget.findMany({
      where: { partnershipId: partnership.id, month: nextMonth },
      orderBy: { category: "asc" },
    }),
    db.transaction.findMany({
      where: {
        partnershipId: partnership.id,
        date: { gte: nextStart, lte: nextEnd },
        category: { not: "Income" },
      },
    }),
  ]);

  // Actual spending by category — selected month
  const actualByCategory: Record<string, number> = {};
  for (const tx of selectedMonthTxns) {
    actualByCategory[tx.category] = (actualByCategory[tx.category] ?? 0) + tx.amount;
  }

  // Transactions grouped by category (serializable for client)
  const transactionsByCategory: Record<string, TxRow[]> = {};
  for (const tx of selectedMonthTxns) {
    if (!transactionsByCategory[tx.category]) transactionsByCategory[tx.category] = [];
    transactionsByCategory[tx.category].push({
      id: tx.id,
      merchant: tx.merchant,
      amount: tx.amount,
      date: tx.date.toISOString(),
      ownerLabel: tx.ownerLabel,
      userId: tx.userId,
      accountName: tx.account.name,
    });
  }

  // Actual spending by category — next month
  const nextActualByCategory: Record<string, number> = {};
  for (const tx of nextMonthTxns) {
    nextActualByCategory[tx.category] = (nextActualByCategory[tx.category] ?? 0) + tx.amount;
  }

  const budgetCategories = new Set(budgets.map((b) => b.category));

  const budgetRows = budgets.map((b) => ({
    id: b.id,
    category: b.category,
    suggestedAmount: b.suggestedAmount,
    userAmount: b.userAmount,
    actual: actualByCategory[b.category] ?? 0,
  }));

  const unbudgeted = Object.entries(actualByCategory)
    .filter(([cat]) => !budgetCategories.has(cat))
    .map(([category, actual]) => ({ category, actual }))
    .sort((a, b) => b.actual - a.actual);

  const nextMonthBudgetRows = nextMonthBudgets.map((b) => ({
    id: b.id,
    category: b.category,
    suggestedAmount: b.suggestedAmount,
    userAmount: b.userAmount,
    actual: nextActualByCategory[b.category] ?? 0,
    reasoning: "",
  }));

  // AI insight — only for current month with an existing budget
  const daysLeft = (() => {
    if (!isCurrentMonth) return 0;
    const [y, m] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return Math.max(0, lastDay - new Date().getDate());
  })();

  const budgetInsight = isCurrentMonth && budgets.length > 0
    ? await getBudgetInsight(
        partnership.id,
        selectedMonth,
        budgetRows.map((b) => ({ category: b.category, effective: b.userAmount ?? b.suggestedAmount, actual: b.actual })),
        daysLeft
      )
    : null;

  return (
    <BudgetEditor
      selectedMonth={selectedMonth}
      prevMonth={prevMonth}
      nextMonth={nextMonth}
      today={today}
      isPastMonth={isPastMonth}
      isCurrentMonth={isCurrentMonth}
      budgetRows={budgetRows}
      unbudgeted={unbudgeted}
      hasExistingBudget={budgets.length > 0}
      nextMonthBudgetRows={nextMonthBudgetRows}
      hasNextMonthBudget={nextMonthBudgets.length > 0}
      transactionsByCategory={transactionsByCategory}
      currentUserId={currentUserId}
      budgetInsight={budgetInsight}
      daysLeft={daysLeft}
    />
  );
}
