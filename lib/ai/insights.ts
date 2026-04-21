import Anthropic from "@anthropic-ai/sdk";
import type { Goal, Account } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const synthesisCache = new Map<string, { synthesis: string; expiresAt: number }>();

export async function getDashboardSynthesis(
  partnershipId: string,
  goals: Goal[],
  accounts: Account[],
  budgetBaseline?: { monthlyFixed: number; monthlyVariable: number } | null
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

  const monthlyBaseline = budgetBaseline
    ? budgetBaseline.monthlyFixed + budgetBaseline.monthlyVariable
    : null;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are Parity's AI assistant for couples working toward financial alignment. Write 2-3 conversational bullet points about their shared financial picture.

Rules:
- Use "you" or "you both" — never "your partner"
- 2-3 bullets, 10-20 words each — write like a human talking to a friend
- Neutral observations, never judgments
- Forward-looking when natural
- Focus on: net worth direction, goal pacing, and how their life cost aligns with their goals
- EACH bullet must start with a label in brackets: [Net Worth], [Goals], [Budget]
- MUST separate each bullet with exactly this:  |||

Example format:
[Net Worth] You're building a solid foundation together — combined net worth is growing steadily. ||| [Goals] The emergency fund is 40% of the way there — you're on track for the target date. ||| [Budget] Your life baseline fits comfortably within what you'd need to hit your goals.

Return ONLY the bullets separated by |||, nothing else.`,
      messages: [
        {
          role: "user",
          content: `Net worth: $${netWorth.toFixed(0)}
${monthlyBaseline ? `Monthly life cost baseline: $${monthlyBaseline.toFixed(0)}` : "No budget baseline set yet"}
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
