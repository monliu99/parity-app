import Anthropic from "@anthropic-ai/sdk";
import type { Account, Goal } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Types for goal inference
export interface InferredGoal {
  name: string;
  targetAmount: number;
  targetDate: string | null;
  category: string;
  reasoning: string;
  suggestedAllocation: { percentage: number }[];
}

export interface LifePlanData {
  visionStatement: string;
  priorities: Array<{ rank: number; area: string; description: string }>;
  roadmap: Array<{
    month: number;
    title: string;
    description: string;
    category: string;
  }>;
}

// In-memory cache
const inferenceCache = new Map<string, { goals: InferredGoal[]; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function inferGoalsFromLifePlan(
  partnershipId: string,
  lifePlan: LifePlanData,
  accounts: Account[],
  existingGoals: Goal[]
): Promise<InferredGoal[]> {
  const cacheKey = `${partnershipId}:${lifePlan.visionStatement.slice(0, 50)}`;
  const cached = inferenceCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.goals;
  }

  const combinedSavings = accounts.reduce((sum, a) => {
    if (a.type === "SAVINGS" || a.type === "INVESTMENT") {
      return sum + a.balance;
    }
    return sum;
  }, 0);

  const monthlySpending = accounts.reduce((sum, a) => sum + a.balance, 0) * 0.1;
  const monthlyCapacity = Math.max(monthlySpending * 0.2, 200);

  const existingGoalNames = existingGoals.map((g) => g.name.toLowerCase());

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `You are Parity's goal inference assistant. Suggest 3-5 shared goals based on a couple's life plan.

Rules:
- Goals should be "ours" not "mine" or "yours"
- Be realistic given their financial capacity
- Avoid duplicating existing goals
- Common goals: emergency fund (3-6 months expenses), house down payment, travel, wedding, debt payoff, retirement, new car, home renovation
- Target dates should be realistic (use YYYY-MM-DD format)

Return ONLY valid JSON:
{
  "goals": [
    {
      "name": "goal name",
      "targetAmount": number,
      "targetDate": "YYYY-MM-DD or null",
      "category": "HOUSING" | "TRAVEL" | "EMERGENCY_FUND" | "DEBT" | "RETIREMENT" | "EXPERIENCE" | "OTHER",
      "reasoning": "why this goal based on their vision",
      "suggestedAllocation": [{"percentage": 50}, {"percentage": 50}]
    }
  ]
}

Allocations should add to 100 and represent fair contribution splits (often 50/50 for joint goals).`,
      messages: [
        {
          role: "user",
          content: `Their vision: ${lifePlan.visionStatement}

Their priorities: ${JSON.stringify(lifePlan.priorities)}

Their roadmap: ${JSON.stringify(lifePlan.roadmap)}

Financial context:
- Current savings: $${combinedSavings.toFixed(0)}
- Estimated monthly capacity for goals: $${monthlyCapacity.toFixed(0)}
- Existing goals: ${JSON.stringify(existingGoalNames)}

Suggest 3-5 shared goals for them.`,
        },
      ],
    });

    let text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    const goals = Array.isArray(parsed.goals) ? parsed.goals : [];

    inferenceCache.set(cacheKey, { goals, expiresAt: Date.now() + CACHE_TTL_MS });
    return goals;
  } catch {
    return [];
  }
}

export function invalidateGoalInferenceCache(partnershipId: string): void {
  for (const [key] of inferenceCache) {
    if (key.startsWith(`${partnershipId}:`)) {
      inferenceCache.delete(key);
    }
  }
}
