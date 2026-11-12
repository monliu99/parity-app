import { generateText } from "@/lib/ai/client";

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

  const result = await generateText({
    label: "life-plan-insight",
    effort: "low",
    system: `You are Parity. Write one observation under 15 words connecting the couple's vision to their finances. Direct, warm, specific. No generic statements. Start with "You" or "You both".`,
    prompt: `Vision: "${visionStatement}"
Net worth: $${netWorth.toFixed(0)}
${monthlyBaseline ? `Monthly spending: $${monthlyBaseline.toFixed(0)}/mo` : "No spending data yet"}

Write the observation.`,
  });
  if (!result.ok) return "";

  // The insight is one line. At low effort the model occasionally adds
  // commentary on its draft after a blank line; keep only the first line.
  const insight = result.data.split("\n")[0].trim();
  lifePlanInsightCache.set(partnershipId, {
    insight,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return insight;
}
