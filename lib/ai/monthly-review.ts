import Anthropic from "@anthropic-ai/sdk";
import type { Goal, Decision } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ReviewSignal {
  shouldReview: boolean;
  reason: string;
  urgency: "low" | "medium" | "high";
}

export interface ReviewInsight {
  insight: string;
  frame: string;
  celebration: string;
  relatedDecisions: string[];
}

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

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `You are Parity's monthly review assistant for couples. Generate ONE insight for their monthly check-in.

Rules:
- Use "you" or "you both" — never "your partner"
- Start with celebration (something positive)
- ONE thing worth discussing (not overwhelming)
- Neutral framing — "you spent" not "you overspent"
- Frame as question/open-ended
- Under 20 words per section

Return ONLY valid JSON:
{
  "celebration": "<something positive to celebrate first>",
  "insight": "<the ONE thing worth discussing>",
  "frame": "<how to bring it up neutrally>"
}`,
      messages: [
        {
          role: "user",
          content: `Monthly summary for ${month}:
${monthlySpending ? `- This month's spending: $${monthlySpending.toFixed(0)}${baselineAmount ? ` (baseline: $${baselineAmount.toFixed(0)})` : ""}` : "- No spending data yet"}
- Goals progress: ${JSON.stringify(goalsProgress)}
- Recent decisions: ${JSON.stringify(relevantDecisions)}

Generate their monthly review insight.`,
        },
      ],
    });

    let text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    const insight: ReviewInsight = {
      insight: parsed.insight || "",
      frame: parsed.frame || "",
      celebration: parsed.celebration || "",
      relatedDecisions: relevantDecisions,
    };

    insightCache.set(cacheKey, { insight, expiresAt: Date.now() + INSIGHT_CACHE_TTL_MS });
    return insight;
  } catch {
    return {
      insight: "",
      frame: "",
      celebration: "You're making progress together.",
      relatedDecisions: relevantDecisions,
    };
  }
}

export function invalidateReviewCache(partnershipId: string): void {
  signalCache.delete(partnershipId);
  for (const [key] of insightCache) {
    if (key.startsWith(`${partnershipId}:`)) {
      insightCache.delete(key);
    }
  }
}
