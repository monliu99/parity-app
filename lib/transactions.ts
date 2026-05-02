import { db } from "@/lib/db";

export const TRANSACTION_CATEGORIES = [
  "Housing",
  "Groceries + Dining",
  "Transport",
  "Kids",
  "Fun + Entertainment",
  "Personal Care",
  "Health",
  "Shopping",
  "Subscriptions",
  "Insurance",
  "Other",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export interface MonthlySpending {
  month: string; // "YYYY-MM"
  total: number;
  categories: Record<string, number>;
}

export interface RollingBaseline {
  average: number;
  months: { month: string; total: number }[];
}

export async function getMonthlySpending(
  partnershipId: string,
  months: number = 3
): Promise<MonthlySpending[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

  const transactions = await db.transaction.findMany({
    where: {
      partnershipId,
      date: { gte: startDate },
    },
    select: {
      amount: true,
      category: true,
      date: true,
    },
    orderBy: { date: "desc" },
  });

  const byMonth: Record<string, MonthlySpending> = {};

  for (const t of transactions) {
    const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { month: monthKey, total: 0, categories: {} };
    }
    byMonth[monthKey].total += t.amount;
    byMonth[monthKey].categories[t.category] =
      (byMonth[monthKey].categories[t.category] || 0) + t.amount;
  }

  return Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
}

export async function getRollingBaseline(
  partnershipId: string
): Promise<RollingBaseline | null> {
  const spending = await getMonthlySpending(partnershipId, 3);

  if (spending.length === 0) return null;

  const months = spending.map((s) => ({ month: s.month, total: s.total }));
  const average = months.reduce((sum, m) => sum + m.total, 0) / months.length;

  return { average, months };
}

export async function getTopCategories(
  partnershipId: string,
  month: string,
  limit: number = 3
): Promise<{ category: string; amount: number }[]> {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 1);

  const transactions = await db.transaction.findMany({
    where: {
      partnershipId,
      date: { gte: start, lt: end },
    },
    select: { category: true, amount: true },
  });

  const byCategory: Record<string, number> = {};
  for (const t of transactions) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }

  return Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export async function getSpendingByUser(
  partnershipId: string,
  months: number = 3
): Promise<{ userId: string; total: number; byCategory: Record<string, number> }[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

  const transactions = await db.transaction.findMany({
    where: { partnershipId, date: { gte: startDate } },
    select: { userId: true, category: true, amount: true },
  });

  const byUser: Record<string, { total: number; byCategory: Record<string, number> }> = {};

  for (const t of transactions) {
    if (!byUser[t.userId]) {
      byUser[t.userId] = { total: 0, byCategory: {} };
    }
    byUser[t.userId].total += t.amount;
    byUser[t.userId].byCategory[t.category] =
      (byUser[t.userId].byCategory[t.category] || 0) + t.amount;
  }

  return Object.entries(byUser).map(([userId, data]) => ({ userId, ...data }));
}

export async function getSpendingComparison(
  partnershipId: string,
  month: string
): Promise<{ thisMonth: number; lastMonth: number; baseline: number }> {
  const [year, mon] = month.split("-").map(Number);
  const start = new Date(year, mon - 1, 1);
  const lastMonthDate = new Date(year, mon - 2, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

  const [thisMonthTx, lastMonthTx, baseline] = await Promise.all([
    db.transaction.findMany({
      where: { partnershipId, date: { gte: start, lt: end } },
      select: { amount: true },
    }),
    db.transaction.findMany({
      where: {
        partnershipId,
        date: { gte: lastMonthDate, lt: start },
      },
      select: { amount: true },
    }),
    getRollingBaseline(partnershipId),
  ]);

  return {
    thisMonth: thisMonthTx.reduce((s, t) => s + t.amount, 0),
    lastMonth: lastMonthTx.reduce((s, t) => s + t.amount, 0),
    baseline: baseline?.average ?? 0,
  };
}
