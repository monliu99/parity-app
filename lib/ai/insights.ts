import Anthropic from "@anthropic-ai/sdk";
import type { Goal, Account } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const synthesisCache = new Map<string, { synthesis: string; expiresAt: number }>();

const lifePlanInsightCache = new Map<string, { insight: string; expiresAt: number }>();

export async function getLifePlanInsight(
  partnershipId: string,
  visionStatement: string,
  netWorth: number,
  monthlyBaseline: number | null
): Promise<string> {
  const cached = lifePlanInsightCache.get(partnershipId);
  if (cached && Date.now() < cached.expiresAt) return cached.insight;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: `You are Parity. Write one observation under 15 words connecting the couple's vision to their finances. Direct, warm, specific. No generic statements. Start with "You" or "You both".`,
      messages: [
        {
          role: "user",
          content: `Vision: "${visionStatement}"
Net worth: $${netWorth.toFixed(0)}
${monthlyBaseline ? `Monthly spending: $${monthlyBaseline.toFixed(0)}/mo` : "No spending data yet"}

Write the observation.`,
        },
      ],
    });
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    lifePlanInsightCache.set(partnershipId, {
      insight: text,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return text;
  } catch {
    return "";
  }
}

export async function getDashboardSynthesis(
  partnershipId: string,
  goals: Goal[],
  accounts: Account[],
  rollingBaseline?: { average: number } | null
): Promise<string> {
  const cached = synthesisCache.get(partnershipId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.synthesis;
  }

  if (goals.length === 0 && accounts.length === 0) {
    return "";
  }

  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  const goalsContext = goals.map((g) => ({
    name: g.name,
    pct: g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0,
    targetDate: g.targetDate
      ? new Date(g.targetDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : null,
    current: g.currentAmount,
    target: g.targetAmount,
  }));

  const monthlyBaseline = rollingBaseline?.average ?? null;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are Parity — a calm, thoughtful financial guide for couples. You observe patterns and help two people see what's happening with their money together. Never preachy, never generic.

Tone: Measured and caring. Direct but kind. Occasionally a light, wry observation when it fits — never forced humor.

Write 2-3 conversational bullet points about their shared financial picture.

Rules:
- Use "you" or "you both" — frame everything as a team
- 2-3 bullets, 10-20 words each — specific and real, not generic platitudes
- Be honest and proactive — flag things worth discussing, celebrate what's working
- Use concrete numbers from the data to make observations tangible
- Focus on: net worth direction, goal pacing, and how their spending aligns with their goals
- EACH bullet must start with a label in brackets: [Net Worth], [Goals], [Spending]
- MUST separate each bullet with exactly this:  |||

Good example:
[Net Worth] You've built $130k together — that's a real foundation. The joint savings is doing the heavy lifting. ||| [Goals] Emergency fund at 73% — you're on pace for October. The down payment could use some momentum though. ||| [Spending] Housing is half your budget, which tracks for NYC. Groceries crept up last month — might be worth a conversation.

Bad example (too generic):
[Net Worth] Your combined net worth is growing steadily. ||| [Goals] You are making progress toward your goals. ||| [Spending] Your spending is within reasonable limits.

Return ONLY the bullets separated by |||, nothing else.`,
      messages: [
        {
          role: "user",
          content: `Net worth: $${netWorth.toFixed(0)}
${monthlyBaseline ? `Average monthly spending (3-month rolling): $${monthlyBaseline.toFixed(0)}` : "No spending data yet"}
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
  } catch (err) {
    console.error("Synthesis error:", err);
    return "";
  }
}
