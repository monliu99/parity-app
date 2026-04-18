import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface BudgetSuggestion {
  category: string;
  suggestedAmount: number;
  reasoning: string;
}

// Cache: `${partnershipId}:${month}` → { suggestions, expiresAt }
const cache = new Map<string, { suggestions: BudgetSuggestion[]; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// historicalByCategory: category → array of monthly totals (oldest first)
export async function generateBudgetSuggestions(
  partnershipId: string,
  month: string, // "2026-04"
  historicalByCategory: Record<string, number[]>
): Promise<BudgetSuggestion[]> {
  const cacheKey = `${partnershipId}:${month}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.suggestions;
  }

  // Remove Income — we don't budget for income
  const spendingHistory = Object.fromEntries(
    Object.entries(historicalByCategory).filter(([cat]) => cat !== "Income")
  );

  if (Object.keys(spendingHistory).length === 0) return [];

  const context = Object.entries(spendingHistory).map(([category, months]) => ({
    category,
    monthlyTotals: months,
    average: Math.round(months.reduce((a, b) => a + b, 0) / months.length),
  }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You are a financial planner for couples. Based on historical monthly spending, suggest a realistic monthly budget for each category.

Guidelines:
- Suggest amounts that are slightly above the average (10-20% buffer) to be achievable, not aspirational
- For variable categories (Dining, Shopping, Entertainment), be a bit more conservative to encourage mindfulness
- For fixed categories (Housing, Subscriptions), use the actual average — they don't change
- Round to the nearest $10 or $50 for readability
- Keep reasoning under 10 words

Return ONLY valid JSON array:
[{ "category": "...", "suggestedAmount": 0, "reasoning": "..." }]`,
      messages: [
        {
          role: "user",
          content: `Historical spending by category (monthly totals, oldest first):
${JSON.stringify(context, null, 2)}

Suggest a monthly budget for ${month}.`,
        },
      ],
    });

    let text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    const suggestions: BudgetSuggestion[] = Array.isArray(parsed)
      ? parsed.filter(
          (s: unknown) =>
            s &&
            typeof s === "object" &&
            "category" in s &&
            "suggestedAmount" in s &&
            "reasoning" in s &&
            typeof (s as { suggestedAmount: unknown }).suggestedAmount === "number"
        )
      : [];

    cache.set(cacheKey, { suggestions, expiresAt: Date.now() + CACHE_TTL_MS });
    return suggestions;
  } catch {
    return [];
  }
}

export function invalidateBudgetCache(partnershipId: string, month: string) {
  cache.delete(`${partnershipId}:${month}`);
}

// ─── Next-month planning ────────────────────────────────────────────────────

export interface NextMonthPlan {
  categoryBudgets: { category: string; suggestedAmount: number; reasoning: string }[];
  contextSummary: string[];    // 2-3 bullets explaining the analysis
  discussionPrompts: string[]; // 3-5 questions for the couple to work through
}

// Separate cache for plans (longer TTL — 6 hours)
const planCache = new Map<string, { plan: NextMonthPlan; expiresAt: number }>();
const PLAN_TTL_MS = 6 * 60 * 60 * 1000;

export async function generateNextMonthPlan(
  partnershipId: string,
  nextMonth: string,
  historicalByCategory: Record<string, number[]>, // category → [month1, month2, month3] totals oldest first
  currentBudgetByCategory: Record<string, number>,
  goals: { name: string; targetAmount: number; currentAmount: number; targetDate: string | null }[],
  userContext?: string
): Promise<NextMonthPlan> {
  const cacheKey = `plan:${partnershipId}:${nextMonth}`;
  const cached = planCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.plan;

  const empty: NextMonthPlan = { categoryBudgets: [], contextSummary: [], discussionPrompts: [] };

  const [planYear, planMonthNum] = nextMonth.split("-").map(Number);
  const monthName = new Date(planYear, planMonthNum - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Remove Income from spending history
  const spendingHistory = Object.fromEntries(
    Object.entries(historicalByCategory).filter(([cat]) => cat !== "Income")
  );

  const spendingContext = Object.entries(spendingHistory).map(([category, months]) => ({
    category,
    monthlyTotals: months,
    average: Math.round(months.reduce((a, b) => a + b, 0) / Math.max(months.length, 1)),
    currentBudget: currentBudgetByCategory[category] ?? null,
  }));

  const goalsContext = goals.map((g) => ({
    name: g.name,
    target: g.targetAmount,
    current: g.currentAmount,
    pct: Math.round((g.currentAmount / g.targetAmount) * 100),
    targetDate: g.targetDate,
  }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system: `You are Parity's AI financial planner for couples. Generate a collaborative monthly budget plan for ${monthName}.

Rules:
- Use "you" or "you both" — never "your partner" or "they"
- Neutral, forward-looking, curious — never accusatory
- Account for seasonality (${monthName} — summer/winter/holiday context)
- Suggest amounts slightly above historical average for fixed costs, slightly aspirational for variable categories
- contextSummary: 2-3 short bullets (under 12 words each) explaining YOUR key observations
- discussionPrompts: 3-5 open questions for the couple to work through together (not yes/no — encourage reflection)
- Each reasoning must be under 10 words

Return ONLY valid JSON in this exact shape:
{
  "categoryBudgets": [{ "category": "...", "suggestedAmount": 0, "reasoning": "..." }],
  "contextSummary": ["...", "..."],
  "discussionPrompts": ["...", "...", "..."]
}`,
      messages: [
        {
          role: "user",
          content: `Historical spending by category (monthly totals, oldest first) + this month's budget:
${JSON.stringify(spendingContext, null, 2)}

Active goals: ${JSON.stringify(goalsContext, null, 2)}

${userContext ? `Additional context from the couple: "${userContext}"` : ""}

Generate the budget plan for ${monthName}.`,
        },
      ],
    });

    let text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    const plan: NextMonthPlan = {
      categoryBudgets: Array.isArray(parsed.categoryBudgets) ? parsed.categoryBudgets : [],
      contextSummary: Array.isArray(parsed.contextSummary) ? parsed.contextSummary : [],
      discussionPrompts: Array.isArray(parsed.discussionPrompts) ? parsed.discussionPrompts : [],
    };

    planCache.set(cacheKey, { plan, expiresAt: Date.now() + PLAN_TTL_MS });
    return plan;
  } catch {
    return empty;
  }
}

export function invalidatePlanCache(partnershipId: string, nextMonth: string) {
  planCache.delete(`plan:${partnershipId}:${nextMonth}`);
}

// ─── Budget status insight ───────────────────────────────────────────────────

const insightCache = new Map<string, { insight: string | null; expiresAt: number }>();
const INSIGHT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function getBudgetInsight(
  partnershipId: string,
  month: string,
  budgetRows: { category: string; effective: number; actual: number }[],
  daysLeftInMonth: number
): Promise<string | null> {
  if (budgetRows.length === 0) return null;
  const totalBudget = budgetRows.reduce((s, r) => s + r.effective, 0);
  if (totalBudget === 0) return null;

  const cacheKey = `insight:${partnershipId}:${month}`;
  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.insight;

  const totalActual = budgetRows.reduce((s, r) => s + r.actual, 0);
  const overRows = budgetRows.filter((r) => r.actual > r.effective);
  const nearRows = budgetRows.filter((r) => r.actual / r.effective >= 0.8 && r.actual <= r.effective);

  const context = budgetRows.map((r) => ({
    category: r.category,
    budget: r.effective,
    spent: r.actual,
    pct: Math.round((r.actual / r.effective) * 100),
  }));

  const [y, m] = month.split("-").map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: `You are Parity's AI assistant for couples. Write exactly ONE sentence summarizing the couple's budget status for the month.

Rules:
- Maximum 20 words
- Use "you" or "you both" — never "your partner"
- Neutral, forward-looking — not accusatory
- Mention the biggest concern if there is one, otherwise confirm they're on track
- No quotes, no punctuation beyond a dash or period
- Return ONLY the sentence, nothing else`,
      messages: [
        {
          role: "user",
          content: `${monthName} budget status:
Total spent: $${Math.round(totalActual)} of $${Math.round(totalBudget)} budget
Days left in month: ${daysLeftInMonth}
Over budget: ${overRows.map((r) => r.category).join(", ") || "none"}
Near limit (80–100%): ${nearRows.map((r) => r.category).join(", ") || "none"}
By category: ${JSON.stringify(context)}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : null;
    insightCache.set(cacheKey, { insight: text, expiresAt: Date.now() + INSIGHT_TTL_MS });
    return text;
  } catch {
    insightCache.set(cacheKey, { insight: null, expiresAt: Date.now() + INSIGHT_TTL_MS });
    return null;
  }
}
