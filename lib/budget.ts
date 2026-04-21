import { db } from "@/lib/db";

export interface MonthlyBaseline {
  monthlyFixed: number;
  monthlyVariable: number;
  categories: { category: string; amount: number; type: "fixed" | "variable" }[];
}

export async function getMonthlyBaseline(partnershipId: string): Promise<MonthlyBaseline | null> {
  const [fixed, variable] = await Promise.all([
    db.budgetFixed.findMany({ where: { partnershipId } }),
    db.budgetVariable.findMany({ where: { partnershipId } }),
  ]);

  if (fixed.length === 0 && variable.length === 0) return null;

  const monthlyFixed = fixed.reduce((sum, f) => sum + f.amount, 0);

  // Average estimates across both partners per category
  const variableByCategory: Record<string, number[]> = {};
  for (const v of variable) {
    if (!variableByCategory[v.category]) variableByCategory[v.category] = [];
    variableByCategory[v.category].push(v.amount);
  }
  const monthlyVariable = Object.values(variableByCategory).reduce(
    (sum, amounts) => sum + amounts.reduce((a, b) => a + b, 0) / amounts.length,
    0
  );

  const categories = [
    ...fixed.map((f) => ({ category: f.category, amount: f.amount, type: "fixed" as const })),
    ...Object.entries(variableByCategory).map(([category, amounts]) => ({
      category,
      amount: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      type: "variable" as const,
    })),
  ];

  return { monthlyFixed, monthlyVariable, categories };
}
