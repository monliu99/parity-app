"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { checkReviewSignal, generateReviewInsight, invalidateReviewCache, generateReviewSuggestions } from "@/lib/ai/monthly-review";
import type { ReviewSuggestion } from "@/lib/ai/monthly-review";
import { generatePlanInsights } from "@/lib/ai/life-planning";
import type { PlanInsight } from "@/lib/ai/life-planning";
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

  const [goals, decisions, spending, topCategories, lifePlan] = await Promise.all([
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    db.decision.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getSpendingComparison(partnership.id, month),
    getTopCategories(partnership.id, month, 8),
    db.lifePlan.findFirst({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const insight = await generateReviewInsight(
    partnership.id,
    month,
    goals,
    decisions,
    { ...spending, topCategories }
  );

  let alignmentScore = 0;
  let signals: PlanInsight[] = [];
  if (lifePlan) {
    const raw = lifePlan.priorities as
      | { priorities: Array<{ rank: number; area: string; description: string }> }
      | undefined;
    const priorities = raw?.priorities ?? [];
    if (priorities.length > 0) {
      const thisMonthTotal = topCategories.reduce((sum, c) => sum + c.amount, 0);
      const planInsights = await generatePlanInsights(
        partnership.id,
        priorities,
        topCategories,
        thisMonthTotal
      );
      alignmentScore = planInsights.alignmentScore;
      signals = planInsights.signals;
    }
  }

  const goalSummaries = goals.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    month: g.month ?? null,
    completedAt: g.completedAt ?? null,
  }));

  const suggestions: ReviewSuggestion[] = await generateReviewSuggestions(signals, goalSummaries);

  return { insight, month, alignmentScore, signals, suggestions, goals: goalSummaries };
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
  revalidatePath("/goals");
  return { success: true };
}

export async function applyReviewSuggestions(suggestions: ReviewSuggestion[]) {
  const { partnership } = await getPartnership();

  const partnershipGoals = await db.goal.findMany({
    where: { partnershipId: partnership.id },
    select: { id: true },
  });
  const validIds = new Set(partnershipGoals.map((g) => g.id));

  for (const suggestion of suggestions) {
    try {
      switch (suggestion.type) {
        case "reschedule":
          if (suggestion.targetId && validIds.has(suggestion.targetId) && typeof suggestion.newValue === "number") {
            await db.goal.update({
              where: { id: suggestion.targetId },
              data: { month: suggestion.newValue },
            });
          }
          break;
        case "add_action":
          await db.goal.create({
            data: {
              partnershipId: partnership.id,
              name: suggestion.title,
              type: "action",
              targetAmount: 0,
              notes: suggestion.explanation,
            },
          });
          break;
        case "adjust_goal":
          if (suggestion.targetId && validIds.has(suggestion.targetId) && typeof suggestion.newValue === "number") {
            await db.goal.update({
              where: { id: suggestion.targetId },
              data: { targetAmount: suggestion.newValue },
            });
          }
          break;
        case "mark_complete":
          if (suggestion.targetId && validIds.has(suggestion.targetId)) {
            await db.goal.update({
              where: { id: suggestion.targetId },
              data: { completedAt: new Date() },
            });
          }
          break;
      }
    } catch {
      // skip failed suggestions, don't block the whole apply
    }
  }

  revalidatePath("/goals");
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
