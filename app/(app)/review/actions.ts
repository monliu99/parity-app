"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { checkReviewSignal, generateReviewInsight, invalidateReviewCache } from "@/lib/ai/monthly-review";
import { getMonthlyBaseline } from "@/lib/budget";
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

  const [goals, decisions, baseline] = await Promise.all([
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    db.decision.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    getMonthlyBaseline(partnership.id),
  ]);

  const insight = await generateReviewInsight(
    partnership.id,
    month,
    goals,
    decisions,
    baseline
  );

  return { insight, month };
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

  invalidateReviewCache(partnership.id);

  revalidatePath("/review");
  revalidatePath("/dashboard");
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
