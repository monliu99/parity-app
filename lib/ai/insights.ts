import Anthropic from "@anthropic-ai/sdk";
import type { Transaction, Goal, Account } from "@/app/generated/prisma/client";

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
      ? new Date(g.targetDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
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

const synthesisCache = new Map<string, { synthesis: string; expiresAt: number }>();

export async function getDashboardSynthesis(
  partnershipId: string,
  transactions: TransactionWithAccount[],
  goals: Goal[],
  accounts: Account[],
  budgetState?: { totalBudgeted: number; totalSpent: number } | null
): Promise<string> {
  const cached = synthesisCache.get(partnershipId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.synthesis;
  }

  if (transactions.length === 0 && goals.length === 0 && accounts.length === 0) {
    return "";
  }

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const currentMonth = transactions.filter((t) => new Date(t.date) >= currentMonthStart);
  const previousMonth = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= previousMonthStart && d <= previousMonthEnd;
  });

  const sumBy = (txns: TransactionWithAccount[], predicate: (t: TransactionWithAccount) => boolean) =>
    txns.filter(predicate).reduce((sum, t) => sum + t.amount, 0);

  const currentIncome = sumBy(currentMonth, (t) => t.category === "Income");
  const currentSpending = sumBy(currentMonth, (t) => t.category !== "Income");
  const previousSpending = sumBy(previousMonth, (t) => t.category !== "Income");
  const savingsRate = currentIncome > 0
    ? Math.round(((currentIncome - currentSpending) / currentIncome) * 100)
    : 0;

  const currentByCategory: Record<string, number> = {};
  for (const t of currentMonth) {
    if (t.category !== "Income") {
      currentByCategory[t.category] = (currentByCategory[t.category] ?? 0) + t.amount;
    }
  }
  const previousByCategory: Record<string, number> = {};
  for (const t of previousMonth) {
    if (t.category !== "Income") {
      previousByCategory[t.category] = (previousByCategory[t.category] ?? 0) + t.amount;
    }
  }

  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  const goalsContext = goals.map((g) => ({
    name: g.name,
    pct: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
    targetDate: g.targetDate
      ? new Date(g.targetDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : null,
  }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are Parity's AI assistant for couples. Write 2-3 conversational bullet points summarizing their financial picture.

Rules:
- Use "you" or "you both" — never "your partner"
- 2-3 bullets, 10-20 words each — write like a human talking to a friend
- Neutral observations, never judgments
- Forward-looking when natural
- Weave together: spending vs last month, savings rate, goal pacing, budget status
- EACH bullet must start with a label in brackets: [Spending], [Savings], [Goals], [Budget]
- MUST separate each bullet with exactly this:  |||

Example format:
[Spending] You're spending a bit less on dining compared to last month, nice work. ||| [Savings] At this pace, you're on track to hit 20% savings by summer. ||| [Goals] The Italy trip is coming together nicely — you're 40% of the way there.

Return ONLY the bullets separated by |||, nothing else.`,
      messages: [
        {
          role: "user",
          content: `Net worth: $${netWorth.toFixed(0)}
Current month spending: $${currentSpending.toFixed(0)} (previous month: $${previousSpending.toFixed(0)})
Current month income: $${currentIncome.toFixed(0)}
Savings rate this month: ${savingsRate}%
Current month spending by category: ${JSON.stringify(currentByCategory)}
Previous month spending by category: ${JSON.stringify(previousByCategory)}
${budgetState ? `Budget this month: $${budgetState.totalSpent.toFixed(0)} spent of $${budgetState.totalBudgeted.toFixed(0)} budgeted` : "No budget set this month"}
Goals: ${JSON.stringify(goalsContext)}

Write the synthesis.`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    synthesisCache.set(partnershipId, {
      synthesis: text,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return text;
  } catch {
    return "";
  }
}
