"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import {
  generateBudgetSuggestions,
  invalidateBudgetCache,
  generateNextMonthPlan,
  invalidatePlanCache,
  type NextMonthPlan,
} from "@/lib/ai/budget";
import { revalidatePath } from "next/cache";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function offsetMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function buildHistoricalByCategory(partnershipId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const transactions = await db.transaction.findMany({
    where: {
      partnershipId,
      date: { gte: ninetyDaysAgo },
      category: { not: "Income" },
    },
  });

  const byMonthCategory: Record<string, Record<string, number>> = {};
  for (const tx of transactions) {
    const txMonth = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonthCategory[txMonth]) byMonthCategory[txMonth] = {};
    byMonthCategory[txMonth][tx.category] =
      (byMonthCategory[txMonth][tx.category] ?? 0) + tx.amount;
  }

  const sortedMonths = Object.keys(byMonthCategory).sort();
  const allCategories = new Set(transactions.map((t) => t.category));
  const historicalByCategory: Record<string, number[]> = {};
  for (const cat of allCategories) {
    historicalByCategory[cat] = sortedMonths.map((m) => byMonthCategory[m]?.[cat] ?? 0);
  }

  return historicalByCategory;
}

export async function generateBudgetAction(month?: string) {
  try {
    const { partnership } = await getPartnership();
    const targetMonth = month ?? currentMonth();
    const historicalByCategory = await buildHistoricalByCategory(partnership.id);

    const suggestions = await generateBudgetSuggestions(
      partnership.id,
      targetMonth,
      historicalByCategory
    );

    for (const s of suggestions) {
      await db.budget.upsert({
        where: {
          partnershipId_month_category: {
            partnershipId: partnership.id,
            month: targetMonth,
            category: s.category,
          },
        },
        update: { suggestedAmount: s.suggestedAmount, generatedAt: new Date() },
        create: {
          partnershipId: partnership.id,
          month: targetMonth,
          category: s.category,
          suggestedAmount: s.suggestedAmount,
        },
      });
    }

    invalidateBudgetCache(partnership.id, targetMonth);
    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    console.error("Error generating budget:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to generate budget",
    };
  }
}

// In-memory store for plan metadata (contextSummary + discussionPrompts)
const planMetaCache = new Map<string, { plan: NextMonthPlan; expiresAt: number }>();
const PLAN_META_TTL = 6 * 60 * 60 * 1000;

export async function generateNextMonthPlanAction(userContext?: string): Promise<{ success?: boolean; error?: string; plan?: NextMonthPlan }> {
  try {
    const { partnership } = await getPartnership();
    const nextMonth = offsetMonth(currentMonth(), 1);
    const cacheKey = `${partnership.id}:${nextMonth}`;

    // If no userContext and cached, return cached
    if (!userContext) {
      const cached = planMetaCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) return { plan: cached.plan };
    }

    const [historicalByCategory, currentBudgets, goals] = await Promise.all([
      buildHistoricalByCategory(partnership.id),
      db.budget.findMany({
        where: { partnershipId: partnership.id, month: currentMonth() },
      }),
      db.goal.findMany({ where: { partnershipId: partnership.id } }),
    ]);

    const currentBudgetByCategory: Record<string, number> = {};
    for (const b of currentBudgets) {
      currentBudgetByCategory[b.category] = b.userAmount ?? b.suggestedAmount;
    }

    const goalsForAI = goals.map((g) => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      targetDate: g.targetDate
        ? new Date(g.targetDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : null,
    }));

    const plan = await generateNextMonthPlan(
      partnership.id,
      nextMonth,
      historicalByCategory,
      currentBudgetByCategory,
      goalsForAI,
      userContext
    );

    // Upsert Budget rows for next month
    for (const s of plan.categoryBudgets) {
      await db.budget.upsert({
        where: {
          partnershipId_month_category: {
            partnershipId: partnership.id,
            month: nextMonth,
            category: s.category,
          },
        },
        update: { suggestedAmount: s.suggestedAmount, generatedAt: new Date() },
        create: {
          partnershipId: partnership.id,
          month: nextMonth,
          category: s.category,
          suggestedAmount: s.suggestedAmount,
        },
      });
    }

    invalidatePlanCache(partnership.id, nextMonth);
    planMetaCache.set(cacheKey, { plan, expiresAt: Date.now() + PLAN_META_TTL });

    revalidatePath("/budget");
    return { plan };
  } catch (error) {
    console.error("Error generating next month plan:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to generate plan",
    };
  }
}

export async function updateBudgetAmountAction(budgetId: string, userAmount: number | null) {
  try {
    const { partnership } = await getPartnership();

    const budget = await db.budget.findUnique({ where: { id: budgetId } });
    if (!budget || budget.partnershipId !== partnership.id) {
      return { error: "Budget not found" };
    }

    if (userAmount !== null && (isNaN(userAmount) || userAmount < 0)) {
      return { error: "Amount must be a positive number" };
    }

    await db.budget.update({
      where: { id: budgetId },
      data: { userAmount },
    });

    revalidatePath("/budget");
    return { success: true };
  } catch (error) {
    console.error("Error updating budget:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update budget",
    };
  }
}
