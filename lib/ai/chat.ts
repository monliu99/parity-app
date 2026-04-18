import Anthropic from "@anthropic-ai/sdk";
import type { Account, Transaction, Goal } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type TransactionWithAccount = Transaction & { account: { name: string } };

export async function askParity(
  question: string,
  accounts: Account[],
  transactions: TransactionWithAccount[],
  goals: Goal[]
): Promise<string> {
  const accountsContext = accounts.map((a) => ({
    name: a.name,
    type: a.type,
    owner: a.ownerLabel === "MINE" ? "Mine" : "Partner's",
    balance: a.balance,
    institution: a.institution,
  }));

  const txContext = transactions.slice(0, 100).map((t) => ({
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    date: new Date(t.date).toISOString().split("T")[0],
    owner: t.ownerLabel === "MINE" ? "Mine" : "Partner's",
    account: t.account.name,
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
    system: `You are Parity, a financial assistant for couples. Answer questions about the couple's finances based on the data provided.

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
Recent transactions (last 60 days): ${JSON.stringify(txContext)}
Goals: ${JSON.stringify(goalsContext)}

Question: ${question}`,
      },
    ],
  });

  return message.content[0].type === "text"
    ? message.content[0].text
    : "Sorry, I couldn't generate a response.";
}
