import { z } from "zod";
import type { Goal, Decision } from "@/app/generated/prisma/client";
import { generateObject } from "@/lib/ai/client";
import type { PlanInsight } from "@/lib/ai/life-planning";

export interface ReviewSignal {
  shouldReview: boolean;
  reason: string;
  urgency: "low" | "medium" | "high";
}

export interface ReviewInsight {
  insight: string;
  frame: string;
  relatedDecisions: string[];
}

export interface ReviewSuggestion {
  id: string;
  type: "reschedule" | "add_action" | "adjust_goal" | "mark_complete";
  title: string;
  explanation: string;
  targetId?: string;
  newValue?: string | number;
}

const ReviewInsightSchema = z.object({
  insight: z.string(),
  frame: z.string(),
});

const ReviewSuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["reschedule", "add_action", "adjust_goal", "mark_complete"]),
      title: z.string(),
      explanation: z.string(),
      targetId: z.string().optional(),
      newValue: z.union([z.string(), z.number()]).optional(),
    })
  ),
});

const signalCache = new Map<string, { signal: ReviewSignal; expiresAt: number }>();
const insightCache = new Map<string, { insight: ReviewInsight; expiresAt: number }>();

const SIGNAL_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INSIGHT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function checkReviewSignal(
  partnershipId: string,
  goals: Goal[],
  lastReviewDate: Date | null
): Promise<ReviewSignal> {
  const cached = signalCache.get(partnershipId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.signal;
  }

  const now = new Date();
  const daysSinceReview = lastReviewDate
    ? Math.floor((now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceReview >= 30) {
    const signal: ReviewSignal = {
      shouldReview: true,
      reason: daysSinceReview >= 45
        ? "It's been over a month since your last check-in."
        : "Your monthly money date is ready.",
      urgency: daysSinceReview >= 45 ? "high" : "medium",
    };
    signalCache.set(partnershipId, { signal, expiresAt: Date.now() + SIGNAL_CACHE_TTL_MS });
    return signal;
  }

  // Check for goal milestones
  for (const goal of goals) {
    const pct = (goal.currentAmount / goal.targetAmount) * 100;
    if (pct >= 25 && pct < 26) {
      const signal: ReviewSignal = {
        shouldReview: true,
        reason: `You've hit 25% on ${goal.name}! Time to celebrate.`,
        urgency: "low",
      };
      signalCache.set(partnershipId, { signal, expiresAt: Date.now() + SIGNAL_CACHE_TTL_MS });
      return signal;
    }
    if (pct >= 50 && pct < 51) {
      const signal: ReviewSignal = {
        shouldReview: true,
        reason: `You're halfway to ${goal.name}!`,
        urgency: "low",
      };
      signalCache.set(partnershipId, { signal, expiresAt: Date.now() + SIGNAL_CACHE_TTL_MS });
      return signal;
    }
  }

  const signal: ReviewSignal = {
    shouldReview: false,
    reason: "Everything looks on track. No review needed yet.",
    urgency: "low",
  };
  signalCache.set(partnershipId, { signal, expiresAt: Date.now() + SIGNAL_CACHE_TTL_MS });
  return signal;
}

export async function generateReviewInsight(
  partnershipId: string,
  month: string,
  goals: Goal[],
  pastDecisions: Decision[],
  spendingSummary?: { thisMonth: number; lastMonth: number; baseline: number; topCategories: { category: string; amount: number }[] } | null
): Promise<ReviewInsight> {
  const cacheKey = `${partnershipId}:${month}`;
  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.insight;
  }

  const monthStart = new Date(month);
  const monthlySpending = spendingSummary?.thisMonth ?? null;
  const baselineAmount = spendingSummary?.baseline ?? null;

  const goalsProgress = goals.map((g) => ({
    name: g.name,
    pct: Math.round((g.currentAmount / g.targetAmount) * 100),
    current: g.currentAmount,
    target: g.targetAmount,
  }));

  const relevantDecisions = pastDecisions
    .filter((d) => new Date(d.createdAt) >= monthStart)
    .map((d) => d.title)
    .slice(0, 3);

  const result = await generateObject(ReviewInsightSchema, {
    label: "review-insight",
    effort: "medium",
    system: `You are Parity — a calm, thoughtful financial guide for couples doing their monthly check-in. You observe patterns and help them stay aligned on their shared future.

Tone: Measured and caring. Direct but kind. Occasionally a light observation when it fits. You're like a thoughtful friend who pays attention to the details.

Generate ONE insight for their monthly review.

Rules:
- Use "you" or "you both" — frame as a team, never individual blame
- ONE thing worth discussing — proactive, not passive
- Honest but gentle — frame spending changes as shared observations, not judgments
- Frame as a conversation starter between the two of them
- Under 20 words per section

Return ONLY valid JSON:
{
  "insight": "<the ONE thing worth discussing>",
  "frame": "<how to bring it up neutrally>"
}`,
    prompt: `Monthly summary for ${month}:
${monthlySpending ? `- This month's spending: $${monthlySpending.toFixed(0)}${baselineAmount ? ` (baseline: $${baselineAmount.toFixed(0)})` : ""}` : "- No spending data yet"}
- Goals progress: ${JSON.stringify(goalsProgress)}
- Recent decisions: ${JSON.stringify(relevantDecisions)}

Generate their monthly review insight.`,
  });

  if (!result.ok) {
    return { insight: "", frame: "", relatedDecisions: relevantDecisions };
  }

  const insight: ReviewInsight = { ...result.data, relatedDecisions: relevantDecisions };
  insightCache.set(cacheKey, { insight, expiresAt: Date.now() + INSIGHT_CACHE_TTL_MS });
  return insight;
}

export async function generateReviewSuggestions(
  signals: PlanInsight[],
  goals: Array<{ id: string; name: string; type: string; targetAmount: number; month: number | null; completedAt: Date | null }>
): Promise<ReviewSuggestion[]> {
  const activeGoals = goals.filter((g) => !g.completedAt);
  const result = await generateObject(ReviewSuggestionsSchema, {
    label: "review-suggestions",
    effort: "medium",
    system: `You are Parity's monthly review assistant. Based on spending signals and current goals/actions, suggest 2-4 specific adjustments the couple could make.

Return JSON with a "suggestions" array of suggestion objects:
{ "suggestions": [{
  "id": "s1",
  "type": "reschedule" | "add_action" | "adjust_goal" | "mark_complete",
  "title": "short action title (under 8 words)",
  "explanation": "one sentence why (under 15 words)",
  "targetId": "<existing goal id if type is reschedule/adjust_goal/mark_complete, omit for add_action>",
  "newValue": <new month number 1-12 for reschedule, new amount for adjust_goal, omit otherwise>
}] }

Types:
- reschedule: push an existing action to next month
- add_action: create a new action goal
- adjust_goal: change a goal's target amount
- mark_complete: mark an existing action done

Only reference goal IDs from the provided list. Use "you both" framing.`,
    prompt: `Signals from this month's review:
${signals.map((s) => `- [${s.status}] ${s.title}: ${s.description}`).join("\n")}

Current goals/actions:
${activeGoals.length > 0
  ? activeGoals.map((g) => `- id: "${g.id}", name: "${g.name}", type: "${g.type}", target: $${g.targetAmount}`).join("\n")
  : "None"}

Generate 2-4 suggested adjustments.`,
  });
  if (!result.ok) return [];

  // Every type except add_action changes an existing goal, so it needs a
  // targetId that is one of the couple's active goals; applying it would
  // otherwise silently do nothing.
  const validIds = new Set(activeGoals.map((g) => g.id));
  return result.data.suggestions.filter(
    (s) => s.type === "add_action" || (s.targetId !== undefined && validIds.has(s.targetId))
  );
}

export function invalidateReviewCache(partnershipId: string): void {
  signalCache.delete(partnershipId);
  for (const [key] of insightCache) {
    if (key.startsWith(`${partnershipId}:`)) {
      insightCache.delete(key);
    }
  }
}
