"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { checkReviewSignal, generateReviewInsight, invalidateReviewCache } from "@/lib/ai/monthly-review";
import { generatePlanInsights } from "@/lib/ai/life-planning";
import { getSpendingComparison, getTopCategories } from "@/lib/transactions";
import { revalidatePath } from "next/cache";

export async function checkReviewNeeded() {
  const { partnership } = await getPartnership();

  const [lastReview, goals] = await Promise.all([
    db.reviewHistory.findFirst({
      where: { partnershipId: partnership.id },
      orderBy: { completedAt: "desc" },
    }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
  ]);

  return checkReviewSignal(partnership.id, goals, lastReview?.completedAt ?? null);
}

export async function startReview(month: string) {
  const { partnership } = await getPartnership();

  const [goals, decisions, spending, topCategories] = await Promise.all([
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    db.decision.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getSpendingComparison(partnership.id, month),
    getTopCategories(partnership.id, month),
  ]);

  const spendingSummary = {
    thisMonth: spending.thisMonth,
    lastMonth: spending.lastMonth,
    baseline: spending.baseline,
    topCategories,
  };

  const insight = await generateReviewInsight(
    partnership.id,
    month,
    goals,
    decisions,
    spendingSummary
  );

  return { insight, month, spendingSummary };
}

export async function logDecision(data: {
  title: string;
  context: string;
  outcome: string;
  category: string;
}) {
  const { partnership } = await getPartnership();

  await db.decision.create({
    data: {
      partnershipId: partnership.id,
      title: data.title,
      context: data.context,
      outcome: data.outcome,
      category: data.category,
    },
  });

  revalidatePath("/review");
  return { success: true };
}

export async function completeReview(data: {
  month: string;
  insight: string;
  decisionsCount: number;
  mood?: string;
}) {
  const { partnership } = await getPartnership();

  await (db.reviewHistory.create as any)({
    data: {
      partnershipId: partnership.id,
      month: data.month,
      insight: data.insight,
      decisionsCreated: data.decisionsCount,
      mood: data.mood,
    },
  });

  // Generate life plan insights if a life plan exists
  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (lifePlan) {
    const raw = lifePlan.priorities as
      | { priorities: Array<{ rank: number; area: string; description: string }> }
      | undefined;
    const priorities = raw?.priorities ?? [];

    if (priorities.length > 0) {
      const topCategories = await getTopCategories(partnership.id, data.month);
      const thisMonthTotal = topCategories.reduce((sum, c) => sum + c.amount, 0);

      const insights = await generatePlanInsights(
        partnership.id,
        priorities,
        topCategories,
        thisMonthTotal
      );

      await (db.lifePlanSnapshot as any).upsert({
        where: { lifePlanId_month: { lifePlanId: lifePlan.id, month: data.month } },
        create: {
          lifePlanId: lifePlan.id,
          month: data.month,
          alignmentScore: insights.alignmentScore,
          signals: insights.signals,
          priorities,
        },
        update: {
          alignmentScore: insights.alignmentScore,
          signals: insights.signals,
        },
      });

      await db.lifePlan.update({
        where: { id: lifePlan.id },
        data: { lastReviewedAt: new Date() },
      });
    }
  }

  invalidateReviewCache(partnership.id);

  revalidatePath("/review");
  revalidatePath("/dashboard");
  revalidatePath("/life-planning");
  return { success: true };
}

export async function getRecentDecisions() {
  const { partnership } = await getPartnership();

  const decisions = await db.decision.findMany({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return { decisions };
}

export async function getRecentReviews() {
  const { partnership } = await getPartnership();

  const reviews = await db.reviewHistory.findMany({
    where: { partnershipId: partnership.id },
    orderBy: { completedAt: "desc" },
    take: 6,
  });

  return { reviews };
}

export async function deleteCurrentMonthReview(month: string) {
  const { partnership } = await getPartnership();

  await db.reviewHistory.deleteMany({
    where: {
      partnershipId: partnership.id,
      month,
    },
  });

  invalidateReviewCache(partnership.id);
  revalidatePath("/review");

  return { success: true };
}
