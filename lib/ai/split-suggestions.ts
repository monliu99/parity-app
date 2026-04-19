import Anthropic from "@anthropic-ai/sdk";
import type { Transaction } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface SplitSuggestion {
  transactionId: string;
  merchant: string;
  amount: number;
  reason: string;
}

// Cache: partnershipId → { suggestions, expiresAt }
const cache = new Map<string, { suggestions: SplitSuggestion[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getSplitSuggestions(
  partnershipId: string,
  transactions: Transaction[] // only MINE/PARTNER, last 30 days
): Promise<SplitSuggestion[]> {
  if (transactions.length === 0) return [];

  const cached = cache.get(partnershipId);
  if (cached && Date.now() < cached.expiresAt) {
    // Filter cached suggestions to only those still in the current transaction set
    const txIds = new Set(transactions.map((t) => t.id));
    return cached.suggestions.filter((s) => txIds.has(s.transactionId));
  }

  const txContext = transactions.map((t) => ({
    id: t.id,
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    ownerLabel: t.ownerLabel,
  }));

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `You are a financial assistant for couples. Analyze a list of individually-labeled transactions and flag any that are likely shared household expenses that both partners benefit from.

Be conservative — only flag transactions that are clearly shared by nature:
- Housing (rent, utilities, mortgage)
- Groceries above $50
- Dining above $100 (likely a shared meal out)
- Subscriptions shared by both (Netflix, etc.)

Do NOT flag:
- Personal clothing, health, or fitness
- Individual transport (Uber, transit for one person)
- Small dining/coffee (likely individual)

Return ONLY valid JSON — an array of objects. If nothing qualifies, return [].

Shape: [{ "transactionId": "...", "merchant": "...", "amount": 0, "reason": "..." }]
Each reason must be under 12 words and explain WHY this looks shared.`,
      messages: [
        {
          role: "user",
          content: `Transactions (individually labeled, last 30 days): ${JSON.stringify(txContext)}

Flag any that look like shared expenses.`,
        },
      ],
    });

    let text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    const valid: SplitSuggestion[] = Array.isArray(parsed)
      ? parsed.filter(
          (s: unknown) =>
            s &&
            typeof s === "object" &&
            "transactionId" in s &&
            "merchant" in s &&
            "amount" in s &&
            "reason" in s
        )
      : [];
    const suggestions = Array.from(
      new Map(valid.map((s) => [s.transactionId, s])).values()
    );

    cache.set(partnershipId, { suggestions, expiresAt: Date.now() + CACHE_TTL_MS });
    return suggestions;
  } catch {
    return [];
  }
}

export function invalidateSplitCache(partnershipId: string) {
  cache.delete(partnershipId);
}
