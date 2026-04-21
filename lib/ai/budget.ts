import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const insightCache = new Map<string, { insight: string | null; expiresAt: number }>();
const INSIGHT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface VariableEstimate {
  category: string;
  myAmount: number | null;
  partnerAmount: number | null;
}

export async function generateGapInsight(
  partnershipId: string,
  estimates: VariableEstimate[]
): Promise<string | null> {
  const gaps = estimates.filter(
    (e) => e.myAmount !== null && e.partnerAmount !== null && e.myAmount !== e.partnerAmount
  );
  if (gaps.length === 0) return null;

  const cacheKey = `gap:${partnershipId}`;
  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.insight;

  const biggestGap = [...gaps].sort(
    (a, b) => Math.abs((b.myAmount ?? 0) - (b.partnerAmount ?? 0)) - Math.abs((a.myAmount ?? 0) - (a.partnerAmount ?? 0))
  )[0];

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: `You are Parity, a financial assistant for couples. Write ONE neutral observation about a spending estimate gap between partners. Under 15 words. No judgment, just curiosity. Use "you both".`,
      messages: [
        {
          role: "user",
          content: `Biggest gap: ${biggestGap.category} — one of you estimated $${biggestGap.myAmount}, the other $${biggestGap.partnerAmount}. All gaps: ${JSON.stringify(gaps.map((g) => ({ category: g.category, amounts: [g.myAmount, g.partnerAmount] })))}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : null;
    insightCache.set(cacheKey, { insight: text, expiresAt: Date.now() + INSIGHT_TTL_MS });
    return text;
  } catch {
    return null;
  }
}
