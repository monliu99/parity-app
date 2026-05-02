import Anthropic from "@anthropic-ai/sdk";
import type { Account, Goal } from "@/app/generated/prisma/client";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Types for life planning flow
export interface LifePlanQuestion {
  question: string;
  followUps: string[];
}

export interface VisionContext {
  sharedInterests: string[];
  timeHorizon: string;
  riskTolerance: string;
  values: string[];
}

export interface LifePlanResult {
  visionStatement: string;
  roadmap: RoadmapItem[];
  priorities: Priority[];
  conflicts: ValueConflict[];
}

export interface RoadmapItem {
  month: number;
  title: string;
  description: string;
  category: "financial" | "experience" | "logistical";
}

export interface Priority {
  rank: number;
  area: string;
  description: string;
}

export interface ValueConflict {
  area: string;
  tension: string;
  suggestedFrame: string;
}

export interface FinancialContext {
  combinedIncome: number;
  combinedSavings: number;
  debts: number;
  monthlySpending: number;
  netWorth: number;
  // Personalized context
  hasJointAccounts: boolean;
  hasJointChecking: boolean;
  hasJointSavings: boolean;
  hasSavingsAccounts: boolean;
  hasInvestmentAccounts: boolean;
  hasDebt: boolean;
  accountTypes: string[];
  // Goals and budget
  goals: Array<{
    name: string;
    current: number;
    target: number;
    progress: number;
    monthsUntilTarget: number | null;
  }>;
  topSpendingCategories: string[];
  hasBudget: boolean;
}

// In-memory cache for sessions
const sessionCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheGet(partnershipId: string, key: string): any | null {
  const cacheKey = `${partnershipId}:${key}`;
  const cached = sessionCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  return null;
}

function cacheSet(partnershipId: string, key: string, data: any): void {
  const cacheKey = `${partnershipId}:${key}`;
  sessionCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const INITIAL_QUESTIONS: LifePlanQuestion[] = [
  { question: "Where do you see yourselves living in 3-5 years?", followUps: [] },
  { question: "What does your family look like in 3-5 years?", followUps: [] },
  { question: "How does work fit into your lives in 3-5 years?", followUps: [] },
  { question: "What experiences do you most want to have together in 3-5 years?", followUps: [] },
  { question: "What would make you feel like you've really succeeded in 3-5 years?", followUps: [] },
];

export async function getInitialQuestions(
  partnershipId: string
): Promise<LifePlanQuestion[]> {
  return INITIAL_QUESTIONS;
}

export async function processSharedVision(
  partnershipId: string,
  answers: Record<string, string>
): Promise<string> {
  try {
    const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `You are Parity's life planning assistant. Synthesize a couple's shared vision into 2-3 sentences.

Rules:
- Use "you" or "you both" — never "your partner"
- Be warm and optimistic
- Fill in gaps they missed
- Under 60 words total
- Make it feel personal and accurate

Return ONLY the vision statement, nothing else.`,
      messages: [
        {
          role: "user",
          content: `Their answers:\n${JSON.stringify(answers)}\n\nGenerate their shared vision statement.`,
        },
      ],
    });

    return message.content[0].type === "text" ? message.content[0].text.trim() : "";
  } catch {
    return "";
  }
}

export async function realityCheck(
  partnershipId: string,
  accounts: Account[],
  goals: Goal[],
  visionAnswers: Record<string, string>,
  monthlyBaseline?: number | null
): Promise<string> {
  try {
    const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);
    const monthlySpending = monthlyBaseline ?? 0;

    // Personalized context
    const jointAccounts = accounts.filter(a => !a.userId || a.ownerLabel === "JOINT");
    const savingsAccounts = accounts.filter(a => a.type === "SAVINGS");
    const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.balance, 0);
    const investmentAccounts = accounts.filter(a => a.type === "INVESTMENT");
    const creditAccounts = accounts.filter(a => a.type === "CREDIT");
    const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0);

    const goalsContext = goals.map((g) => ({
      name: g.name,
      current: g.currentAmount,
      target: g.targetAmount,
      pct: Math.round((g.currentAmount / g.targetAmount) * 100),
    }));

    // Build setup description
    const setupNotes: string[] = [];
    if (jointAccounts.length >= 2) setupNotes.push("already have joint accounts set up");
    if (totalSavings > 10000) setupNotes.push("strong savings foundation");
    if (investmentAccounts.length > 0) setupNotes.push("already investing");
    if (totalDebt > 0) setupNotes.push(`managing $${(totalDebt/1000).toFixed(0)}k in debt`);

    const setupDescription = setupNotes.length > 0
      ? `\n\nSetup notes: ${setupNotes.join(", ")}.`
      : "";

    const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `You are Parity's life planning assistant. Ground their vision in financial reality — gently.

Rules:
- Use "you" or "you both"
- Optimistic but realistic
- Acknowledge what they've already built
- 3-5 bullets, under 15 words each
- Start with strengths, then opportunities
- Be specific to their situation

Return ONLY the reality check as plain text bullets, nothing else.`,
      messages: [
        {
          role: "user",
          content: `Their vision:\n${JSON.stringify(visionAnswers)}

Financial context:
- Net worth: $${netWorth.toFixed(0)}
- Monthly spending: ~$${monthlySpending.toFixed(0)}
- Savings: $${totalSavings.toFixed(0)}
${totalDebt > 0 ? `- Debt: $${totalDebt.toFixed(0)}` : ""}
- Goals: ${JSON.stringify(goalsContext)}${setupDescription}

Provide a personalized reality check on their vision.`,
        },
      ],
    });

    return message.content[0].type === "text" ? message.content[0].text.trim() : "";
  } catch {
    return "";
  }
}

export async function prioritizeValues(
  partnershipId: string,
  vision: string,
  realityCheck: string,
  accounts: Account[]
): Promise<{ priorities: Priority[]; conflicts: ValueConflict[] }> {
  const cached = cacheGet(partnershipId, "priorities");
  if (cached) return cached;

  try {
    const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You are Parity's life planning assistant. Help couples rank their financial priorities and surface value conflicts.

Rules:
- Use "you" or "you both"
- Be neutral, not judgmental
- Surface tensions gently
- Suggest frames that help them discuss
- ALWAYS return at least 4-6 priorities based on their vision
- Base priorities on their vision statement and the common areas listed below

Return ONLY valid JSON:
{
  "priorities": [
    { "rank": 1, "area": "area name", "description": "why this matters" }
  ],
  "conflicts": [
    { "area": "area of tension", "tension": "what's in conflict", "suggestedFrame": "how to think about it" }
  ]
}

Common areas: housing, travel, emergency fund, debt repayment, retirement, experiences, hosting, dining.`,
      messages: [
        {
          role: "user",
          content: `Their vision: ${vision}

Reality check: ${realityCheck}

Help them prioritize and surface any value conflicts.`,
        },
      ],
    });

    let text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    const result = {
      priorities: Array.isArray(parsed.priorities) ? parsed.priorities : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
    };

    cacheSet(partnershipId, "priorities", result);
    return result;
  } catch {
    return { priorities: [], conflicts: [] };
  }
}

export async function generateRoadmap(
  partnershipId: string,
  vision: string,
  priorities: Priority[],
  financialContext: FinancialContext
): Promise<RoadmapItem[]> {
  try {
    // Build context summary for the AI
    const existingSetup: string[] = [];
    if (financialContext.hasJointChecking) existingSetup.push("joint checking account");
    if (financialContext.hasJointSavings) existingSetup.push("joint savings account");
    if (financialContext.hasSavingsAccounts) existingSetup.push("savings accounts");
    if (financialContext.hasInvestmentAccounts) existingSetup.push("investment accounts");
    if (financialContext.hasDebt) existingSetup.push("debt to manage");

    const setupDescription = existingSetup.length > 0
      ? `They already have: ${existingSetup.join(", ")}.`
      : "They are just starting out.";

    // Goals context
    let goalsDescription = "";
    if (financialContext.goals.length > 0) {
      const goalSummaries = financialContext.goals.map(g =>
        `${g.name} (${g.progress}% complete${g.monthsUntilTarget ? `, ${g.monthsUntilTarget} months left` : ""})`
      );
      goalsDescription = `\n\nExisting goals:\n${goalSummaries.join("\n")}`;
    }

    // Budget context
    let budgetDescription = "";
    if (financialContext.hasBudget && financialContext.topSpendingCategories.length > 0) {
      budgetDescription = `\n\nTop spending categories: ${financialContext.topSpendingCategories.join(", ")}.`;
    } else if (!financialContext.hasBudget) {
      budgetDescription = "\n\nNote: They haven't set up budget categories yet.";
    }

    const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `You are Parity's life planning assistant. Generate a 12-month action roadmap based on their vision, priorities, and CURRENT financial setup.

CRITICAL: DO NOT suggest things they already have.
- If they have joint accounts, DO NOT suggest "set up joint account"
- If they have savings, DO NOT suggest "open savings account"
- If they have existing goals, build on them — don't duplicate
- Reference their actual goal names and progress

Rules:
- Use "you" or "you both"
- Actionable but not overwhelming
- ALWAYS return at least 6-8 items total across the timeline
- Be realistic given their financial context
- Mix of financial, experiential, and logistical actions
- If they have goals, suggest check-ins or funding strategies
- If they have high spending areas, suggest reviews or optimizations
- Focus on NEXT steps, not first steps

Return ONLY valid JSON:
{
  "roadmap": [
    { "month": 1, "title": "...", "description": "...", "category": "financial" | "experience" | "logistical" }
  ]
}

Month is 1-12 (immediate = 1, 12 months out = 12).`,
      messages: [
        {
          role: "user",
          content: `Their vision: ${vision}

Their priorities: ${JSON.stringify(priorities)}

Financial context:
- Net worth: $${financialContext.netWorth.toFixed(0)}
- Monthly spending: ~$${financialContext.monthlySpending}
- Savings: $${financialContext.combinedSavings.toFixed(0)}
${financialContext.hasDebt ? `- Debt: $${financialContext.debts.toFixed(0)}` : ""}${goalsDescription}${budgetDescription}

${setupDescription}

Generate their personalized 12-month roadmap based on what they actually need NEXT.`,
        },
      ],
    });

    let text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    const parsed = JSON.parse(text);
    return Array.isArray(parsed.roadmap) ? parsed.roadmap : [];
  } catch {
    return [];
  }
}

export function invalidateLifePlanCache(partnershipId: string): void {
  const keys = ["initial-questions", "priorities"];
  for (const key of keys) {
    sessionCache.delete(`${partnershipId}:${key}`);
  }
}
