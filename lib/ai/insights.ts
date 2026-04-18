import Anthropic from "@anthropic-ai/sdk";
import type { Transaction, Goal } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface DashboardInsights {
  overview: string[];  // 1-2 birds-eye insights shown next to net worth
  spending: string[];  // 1-2 insights specific to spending this month
  goals: string[];     // 1-2 insights specific to goal progress
}

// Simple in-memory cache: partnershipId → { insights, expiresAt }
const cache = new Map<string, { insights: DashboardInsights; expiresAt: number }>();

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type TransactionWithAccount = Transaction & { account: { name: string } };

export async function getSpendingInsights(
  partnershipId: string,
  transactions: TransactionWithAccount[],
  goals: Goal[]
): Promise<DashboardInsights> {
  const empty: DashboardInsights = { overview: [], spending: [], goals: [] };

  // Check cache
  const cached = cache.get(partnershipId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.insights;
  }

  if (transactions.length === 0 && goals.length === 0) {
    return empty;
  }

  // Build context
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recent = transactions.filter((t) => new Date(t.date) >= thirtyDaysAgo);
  const previous = transactions.filter(
    (t) => new Date(t.date) >= sixtyDaysAgo && new Date(t.date) < thirtyDaysAgo
  );

  const recentByCategory: Record<string, number> = {};
  for (const t of recent) {
    recentByCategory[t.category] = (recentByCategory[t.category] ?? 0) + t.amount;
  }

  const previousByCategory: Record<string, number> = {};
  for (const t of previous) {
    previousByCategory[t.category] = (previousByCategory[t.category] ?? 0) + t.amount;
  }

  const totalRecent = recent.reduce((sum, t) => sum + t.amount, 0);
  const totalPrevious = previous.reduce((sum, t) => sum + t.amount, 0);

  const goalsContext = goals.map((g) => ({
    name: g.name,
    type: g.ownerLabel,
    target: g.targetAmount,
    current: g.currentAmount,
    pct: Math.round((g.currentAmount / g.targetAmount) * 100),
    targetDate: g.targetDate
      ? new Date(g.targetDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : null,
  }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You are Parity's AI assistant for couples. Generate short financial insights in three categories.

Rules for ALL insights:
- Use "you" or "you both" — never "your partner"
- Neutral observations, never judgments or accusations
- Forward-looking when possible ("at this pace…", "you're on track to…")
- Each insight must be under 15 words
- Never be accusatory

Return ONLY valid JSON in this exact shape, nothing else:
{
  "overview": ["<1-2 birds-eye insights about overall financial health — net worth direction, savings rate, big picture>"],
  "spending": ["<1-2 insights specific to spending patterns this month vs last month>"],
  "goals": ["<1-2 insights specific to goal progress and pacing>"]
}

If there is no data for a category, return an empty array for that key.`,
      messages: [
        {
          role: "user",
          content: `Current month spending by category: ${JSON.stringify(recentByCategory)}
Previous month spending by category: ${JSON.stringify(previousByCategory)}
Total spending this month: $${totalRecent.toFixed(0)}
Total spending last month: $${totalPrevious.toFixed(0)}
Goals: ${JSON.stringify(goalsContext)}

Generate insights.`,
        },
      ],
    });

    let text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    const insights: DashboardInsights = {
      overview: Array.isArray(parsed.overview) ? parsed.overview : [],
      spending: Array.isArray(parsed.spending) ? parsed.spending : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    };

    cache.set(partnershipId, { insights, expiresAt: Date.now() + CACHE_TTL_MS });
    return insights;
  } catch {
    return empty;
  }
}
