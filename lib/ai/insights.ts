import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
