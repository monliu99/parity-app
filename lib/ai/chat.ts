import type { Account, Goal } from "@/app/generated/prisma/client";
import { generateText } from "@/lib/ai/client";
import type { MonthlySpending } from "@/lib/transactions";

const FALLBACK_ANSWER = "I couldn't answer that just now. Please try again in a moment.";

interface SpendingByPerson {
  name: string;
  total: number;
  categories: Record<string, number>;
}

export async function askParity(
  question: string,
  accounts: Account[],
  goals: Goal[],
  monthlySpending: MonthlySpending[],
  spendingByPerson: SpendingByPerson[],
  viewerName?: string,
  partnerName?: string,
): Promise<string> {
  const accountsContext = accounts.map((a) => ({
    name: a.name,
    type: a.type,
    owner: a.ownerLabel === "MINE" ? viewerName : a.ownerLabel === "PARTNER" ? partnerName : "Joint",
    balance: a.balance,
    institution: a.institution,
  }));

  const goalsContext = goals.map((g) => ({
    name: g.name,
    target: g.targetAmount,
    current: g.currentAmount,
    pct: Math.round((g.currentAmount / g.targetAmount) * 100),
    targetDate: g.targetDate
      ? new Date(g.targetDate).toISOString().split("T")[0]
      : null,
  }));

  const monthlyContext = monthlySpending.map((m) => ({
    month: m.month,
    total: m.total,
    categories: m.categories,
  }));

  const totalNetWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  const result = await generateText({
    label: "chat",
    effort: "medium",
    system: `You are Parity — a calm, thoughtful financial guide for couples. You observe patterns, connect the dots, and help two people stay aligned on the future they're building together. You're never preachy or robotic.

Tone: Measured and caring. Direct but kind. Occasionally a light, wry observation when it fits — never forced.

Rules:
- Use "you" or "you both" — frame everything as a team, never individual blame
- Use the names ${viewerName} and ${partnerName} when referring to each person, but always in service of "you both"
- Answer in 2-4 sentences — thoughtful but concise
- Ground everything in the actual data — reference specific numbers, categories, or goals
- When asked about fairness or splitting, analyze the per-person spending data and give a real, specific answer — but frame it as shared context for a conversation, not a verdict
- Proactively flag things worth attention: spending trends, goal pacing, potential blind spots
- Celebrate what's working — be specific about what's going well
- If the data genuinely can't answer the question, say so briefly and suggest what they'd need to track
- Today's date: ${new Date().toISOString().split("T")[0]}`,
    prompt: `Financial data:
Accounts: ${JSON.stringify(accountsContext)}
Goals: ${JSON.stringify(goalsContext)}
Net worth: $${totalNetWorth.toLocaleString()}
Monthly spending (last ${monthlySpending.length} months): ${JSON.stringify(monthlyContext)}
Spending by person: ${JSON.stringify(spendingByPerson)}

Question: ${question}`,
  });

  return result.ok ? result.data : FALLBACK_ANSWER;
}
