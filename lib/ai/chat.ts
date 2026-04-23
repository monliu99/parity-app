import Anthropic from "@anthropic-ai/sdk";
import type { Account, Goal } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function askParity(
  question: string,
  accounts: Account[],
  goals: Goal[],
  monthlySpending?: number | null
): Promise<string> {
  const accountsContext = accounts.map((a) => ({
    name: a.name,
    type: a.type,
    owner: a.ownerLabel === "MINE" ? "Mine" : "Partner's",
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

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: `You are Parity, a financial assistant for couples focused on relationship harmony and shared financial alignment. Answer questions based on the data provided.

Rules:
- Use "you" or "you both" — never say "your partner"
- Be concise: answer in 1–3 sentences maximum
- Ground answers in the actual data; don't make up numbers
- Frame observations as neutral, never accusatory
- If the data doesn't have enough info to answer, say so briefly
- Today's date: ${new Date().toISOString().split("T")[0]}`,
    messages: [
      {
        role: "user",
        content: `Financial data:
Accounts: ${JSON.stringify(accountsContext)}
Goals: ${JSON.stringify(goalsContext)}
${monthlySpending ? `Average monthly spending: $${monthlySpending.toFixed(0)}` : "No spending data yet"}

Question: ${question}`,
      },
    ],
  });

  return message.content[0].type === "text"
    ? message.content[0].text
    : "Sorry, I couldn't generate a response.";
}
