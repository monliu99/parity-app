"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import {
  getInitialQuestions,
  processSharedVision,
  realityCheck,
  prioritizeValues,
  generateRoadmap,
  invalidateLifePlanCache,
  generateRealityCheckCards,
  generatePlanInsights,
} from "@/lib/ai/life-planning";
import type { RealityCheckCard } from "@/lib/ai/life-planning";
import { getRollingBaseline, getTopCategories } from "@/lib/transactions";
import { revalidatePath } from "next/cache";

export async function getLifePlanQuestions() {
  const { partnership } = await getPartnership();
  return getInitialQuestions(partnership.id);
}

export async function submitVisionAnswers(answers: Record<string, string>) {
  const { partnership } = await getPartnership();
  const vision = await processSharedVision(partnership.id, answers);
  return { vision };
}

export async function submitRealityCheck(visionAnswers: Record<string, string>) {
  const { partnership } = await getPartnership();

  const [accounts, goals, baseline] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getRollingBaseline(partnership.id),
  ]);

  const monthlyBaseline = baseline?.average ?? null;
  const check = await realityCheck(partnership.id, accounts, goals, visionAnswers, monthlyBaseline);

  return { realityCheck: check };
}

export async function submitPriorities(
  vision: string,
  realityCheck: string,
  answers: Record<string, string>
) {
  const { partnership } = await getPartnership();

  const accounts = await db.account.findMany({ where: { partnershipId: partnership.id } });
  const result = await prioritizeValues(partnership.id, vision, realityCheck, accounts);
  return result;
}

export async function generateFinalRoadmap(
  vision: string,
  priorities: Array<{ rank: number; area: string; description: string }>
) {
  const { partnership } = await getPartnership();

  const [accounts, baseline, goals, topCats] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    getRollingBaseline(partnership.id),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getTopCategories(partnership.id, `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`),
  ]);

  const netWorth = accounts.reduce((sum: number, a: { balance: number }) => sum + a.balance, 0);
  const monthlySpending = baseline?.average ?? 0;

  // Build personalized context
  const jointAccounts = accounts.filter(a => !a.userId || a.ownerLabel === "JOINT");
  const savingsAccounts = accounts.filter(a => a.type === "SAVINGS");
  const investmentAccounts = accounts.filter(a => a.type === "INVESTMENT");
  const creditAccounts = accounts.filter(a => a.type === "CREDIT");
  const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0);
  const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.balance, 0);

  // Flags for easier use
  const hasJointChecking = jointAccounts.some(a => a.type === "CHECKING");
  const hasJointSavings = jointAccounts.some(a => a.type === "SAVINGS");
  const hasSavingsAccounts = savingsAccounts.length > 0;
  const hasInvestmentAccounts = investmentAccounts.length > 0;
  const hasDebt = totalDebt > 0;

  // Goals context
  const goalSummaries = goals.map(g => ({
    name: g.name,
    current: g.currentAmount,
    target: g.targetAmount,
    progress: Math.round((g.currentAmount / g.targetAmount) * 100),
    monthsUntilTarget: g.targetDate
      ? Math.max(1, Math.round((new Date(g.targetDate).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)))
      : null,
  }));

  // Budget insights
  const topSpendingCategories = topCats
    .slice(0, 3)
    .map(c => `${c.category} ($${c.amount.toFixed(0)}/mo)`);

  let roadmap = await generateRoadmap(partnership.id, vision, priorities, {
    netWorth,
    monthlySpending,
    combinedIncome: netWorth,
    combinedSavings: totalSavings,
    debts: totalDebt,
    // Personalized context
    hasJointAccounts: jointAccounts.length > 0,
    hasJointChecking,
    hasJointSavings,
    hasSavingsAccounts,
    hasInvestmentAccounts,
    hasDebt,
    accountTypes: [...new Set(accounts.map(a => a.type))],
    // Goals and budget
    goals: goalSummaries,
    topSpendingCategories,
    hasBudget: baseline !== null && baseline.average > 0,
  });

  // Fallback roadmap if AI returns empty - personalized based on what they have
  if (roadmap.length === 0) {
    const fallbackRoadmap = [];

    // Only suggest joint account if they don't have one
    if (!hasJointChecking) {
      fallbackRoadmap.push(
        { month: 1, title: "Set up joint account for shared expenses", description: "Makes tracking 'our money' easier", category: "financial" as const }
      );
    }

    // Only suggest savings account if they don't have savings
    if (!hasSavingsAccounts) {
      fallbackRoadmap.push(
        { month: 1, title: "Open high-yield savings account", description: "For your shared goals and emergency fund", category: "financial" as const }
      );
    } else if (totalSavings < 3000) {
      fallbackRoadmap.push(
        { month: 1, title: "Build emergency fund to $3,000", description: "Strengthen your safety net together", category: "financial" as const }
      );
    }

    // Suggest tracking spending if they don't have data
    if (!baseline) {
      fallbackRoadmap.push(
        { month: 1, title: "Start tracking spending", description: "Add transactions to see where money goes together", category: "logistical" as const }
      );
    }

    // Always include money management
    fallbackRoadmap.push(
      { month: 3, title: "Review subscriptions and recurring expenses", description: "Cancel anything you're not using together", category: "logistical" as const },
    );

    // Check in on existing goals or suggest goal setting
    if (goalSummaries.length > 0) {
      // Reference existing goals specifically
      const goalNames = goalSummaries.slice(0, 2).map(g => g.name).join(" and ");
      fallbackRoadmap.push(
        { month: 3, title: `Check in on ${goalNames}`, description: "Are you on track? Adjust contributions if needed", category: "financial" as const },
        { month: 6, title: "Review all goal progress", description: "Celebrate wins and adjust timelines together", category: "logistical" as const },
      );
    } else {
      fallbackRoadmap.push(
        { month: 3, title: "Set your first shared goal", description: "Pick something that excites you both — big or small", category: "financial" as const },
      );
    }

    // Experience and relationship
    fallbackRoadmap.push(
      { month: 6, title: "Take one small experience together", description: "A weekend trip or special dinner — stay connected to your joy", category: "experience" as const },
      { month: 12, title: "Annual money date", description: "Review the year and plan for the next one", category: "logistical" as const }
    );

    // Add debt or investing based on situation
    if (totalDebt > 0) {
      fallbackRoadmap.push(
        { month: 3, title: "Create debt payoff plan", description: "Agree on strategy and timeline", category: "financial" as const }
      );
    } else if (hasInvestmentAccounts) {
      fallbackRoadmap.push(
        { month: 3, title: "Review investment allocations", description: "Ensure your investments align with shared goals", category: "financial" as const }
      );
    }

    roadmap = fallbackRoadmap;
  }

  return { roadmap };
}

async function syncRoadmapActions(
  partnershipId: string,
  roadmap: Array<{ month: number; title: string; description: string; category: string }>
): Promise<void> {
  await db.goal.deleteMany({
    where: { partnershipId, type: "action" },
  });

  const toCreate = roadmap
    .filter((item) => item.category !== "financial")
    .map((item) => ({
      partnershipId,
      userId: null as string | null,
      ownerLabel: "JOINT",
      name: item.title,
      type: "action",
      targetAmount: 0,
      month: item.month,
      category: item.category,
      notes: item.description || null,
    }));

  if (toCreate.length > 0) {
    await (db.goal.createMany as any)({ data: toCreate });
  }
}

export async function saveLifePlan(data: {
  visionStatement: string;
  roadmap: unknown;
  priorities: unknown;
  visionAnswers?: Record<string, string>;
  lifePlanId?: string;
}) {
  const { partnership } = await getPartnership();

  const [accounts, goals, baseline] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getRollingBaseline(partnership.id),
  ]);

  const realityCheckCards: RealityCheckCard[] = data.visionAnswers
    ? await generateRealityCheckCards(
        partnership.id,
        accounts,
        goals,
        data.visionStatement,
        baseline?.average ?? null
      )
    : [];

  if (data.lifePlanId) {
    await db.lifePlan.update({
      where: { id: data.lifePlanId },
      data: {
        visionStatement: data.visionStatement,
        roadmap: data.roadmap as any,
        priorities: data.priorities as any,
        ...(data.visionAnswers && { visionAnswers: data.visionAnswers as any }),
        realityCheck: realityCheckCards as any,
      },
    });
  } else {
    await (db.lifePlan.create as any)({
      data: {
        partnershipId: partnership.id,
        visionStatement: data.visionStatement,
        roadmap: data.roadmap,
        priorities: data.priorities,
        visionAnswers: data.visionAnswers ?? null,
        realityCheck: realityCheckCards,
      },
    });
  }

  const roadmapItems = Array.isArray(data.roadmap)
    ? (data.roadmap as Array<{
        month: number;
        title: string;
        description: string;
        category: string;
      }>)
    : [];
  await syncRoadmapActions(partnership.id, roadmapItems);

  invalidateLifePlanCache(partnership.id);

  revalidatePath("/life-planning");
  revalidatePath("/goals");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateVisionStatement(visionStatement: string) {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (!lifePlan) return { success: false };

  const [accounts, goals, baseline] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getRollingBaseline(partnership.id),
  ]);

  const realityCheckCards = await generateRealityCheckCards(
    partnership.id,
    accounts,
    goals,
    visionStatement,
    baseline?.average ?? null
  );

  await db.lifePlan.update({
    where: { id: lifePlan.id },
    data: { visionStatement, realityCheck: realityCheckCards as any },
  });

  revalidatePath("/life-planning");
  return { success: true };
}

export async function reorderPriorities(
  priorities: Array<{ rank: number; area: string; description: string }>
) {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (!lifePlan) return { success: false };

  const existing = lifePlan.priorities as
    | { priorities: any[]; conflicts?: any[] }
    | undefined;
  const conflicts = existing?.conflicts ?? [];

  await db.lifePlan.update({
    where: { id: lifePlan.id },
    data: { priorities: { priorities, conflicts } as any },
  });

  revalidatePath("/life-planning");
  return { success: true };
}

export async function getLatestSnapshot() {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  if (!lifePlan) return { snapshot: null };

  const snapshot = await (db.lifePlanSnapshot as any).findFirst({
    where: { lifePlanId: lifePlan.id },
    orderBy: { createdAt: "desc" },
  });

  return { snapshot: snapshot ?? null };
}

export async function getExistingLifePlan() {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "desc" },
  });

  return { lifePlan };
}

interface RoadmapItem {
  month: number;
  title: string;
  description: string;
  category: string;
}

interface SuggestedGoal {
  title: string;
  description: string;
  targetAmount: number | null;
  targetDate: Date;
  category: string;
  skipReason?: string;
}

// Parse dollar amount from text (e.g., "$1,000", "1000", "$5,000 for")
function parseDollarAmount(text: string): number | null {
  const match = text.match(/\$?([\d,]+)\s*(dollar)?/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  // Try finding numbers that could be amounts
  const numberMatch = text.match(/\b(\d{3,})\b/);
  if (numberMatch) {
    const amount = parseInt(numberMatch[1], 10);
    if (amount >= 100 && amount <= 1000000) {
      return amount;
    }
  }
  return null;
}

export async function suggestGoalsFromRoadmap(lifePlanId: string): Promise<{ suggestions: SuggestedGoal[] }> {
  const { partnership } = await getPartnership();

  const lifePlan = await db.lifePlan.findFirst({
    where: { id: lifePlanId, partnershipId: partnership.id },
  });

  if (!lifePlan) {
    return { suggestions: [] };
  }

  const roadmap = lifePlan.roadmap as unknown as RoadmapItem[] | undefined;
  if (!roadmap) return { suggestions: [] };

  const now = new Date();
  const suggestions: SuggestedGoal[] = [];

  for (const item of roadmap) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() + item.month, 1);
    const fullText = `${item.title} ${item.description}`;

    const targetAmount = parseDollarAmount(fullText);

    if (targetAmount) {
      suggestions.push({
        title: item.title,
        description: item.description,
        targetAmount,
        targetDate,
        category: item.category,
      });
    } else if (item.category === "financial") {
      // Financial items without amounts - suggest $0, user can edit
      suggestions.push({
        title: item.title,
        description: item.description,
        targetAmount: null,
        targetDate,
        category: item.category,
      });
    } else {
      // Non-financial items - skip but note why
      suggestions.push({
        title: item.title,
        description: item.description,
        targetAmount: null,
        targetDate,
        category: item.category,
        skipReason: "This is an action item, not a savings goal",
      });
    }
  }

  return { suggestions };
}

export async function createGoalsFromRoadmap(
  goals: Array<{ title: string; description: string; targetAmount: number; targetDate: string }>
) {
  const { partnership, userId } = await getPartnership();

  const createdGoals = await Promise.all(
    goals.map((goal) =>
      db.goal.create({
        data: {
          partnershipId: partnership.id,
          userId: null, // joint goal
          ownerLabel: "JOINT",
          name: goal.title,
          targetAmount: goal.targetAmount,
          currentAmount: 0,
          targetDate: new Date(goal.targetDate),
          notes: goal.description,
        },
      })
    )
  );

  revalidatePath("/goals");
  revalidatePath("/life-planning");

  return { success: true, count: createdGoals.length };
}

export async function deleteLifePlan(lifePlanId: string) {
  const { partnership } = await getPartnership();

  await db.lifePlan.deleteMany({
    where: {
      id: lifePlanId,
      partnershipId: partnership.id,
    },
  });

  invalidateLifePlanCache(partnership.id);
  revalidatePath("/life-planning");

  return { success: true };
}
