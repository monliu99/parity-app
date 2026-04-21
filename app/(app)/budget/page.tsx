import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { BudgetEditor } from "./budget-editor";

export const DEFAULT_VARIABLE_CATEGORIES = [
  "Groceries + Dining",
  "Transport",
  "Kids",
  "Fun + Entertainment",
  "Personal Care",
  "Health",
  "Shopping",
  "Other",
];

export default async function BudgetPage() {
  const { partnership, userId } = await getPartnership();

  const [fixed, variable] = await Promise.all([
    db.budgetFixed.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.budgetVariable.findMany({
      where: { partnershipId: partnership.id },
    }),
  ]);

  // Single estimate per category: prefer current user's, fall back to partner's
  const myEstimates: Record<string, number> = {};
  const partnerEstimates: Record<string, number> = {};
  for (const v of variable) {
    if (v.userId === userId) {
      myEstimates[v.category] = v.amount;
    } else {
      partnerEstimates[v.category] = v.amount;
    }
  }
  const variableEstimates: Record<string, number> = { ...partnerEstimates, ...myEstimates };

  // All variable categories (defaults + any custom ones saved)
  const savedCategories = [...new Set(variable.map((v) => v.category))];
  const variableCategories = [
    ...DEFAULT_VARIABLE_CATEGORIES,
    ...savedCategories.filter((c) => !DEFAULT_VARIABLE_CATEGORIES.includes(c)),
  ];

  // Baseline = fixed total + sum of single estimates
  const totalFixed = fixed.reduce((sum, f) => sum + f.amount, 0);
  const totalVariable = Object.values(variableEstimates).reduce((sum, amt) => sum + amt, 0);
  const monthlyBaseline = totalFixed + totalVariable;

  return (
    <BudgetEditor
      fixed={fixed.map((f) => ({ id: f.id, category: f.category, amount: f.amount, notes: f.notes ?? undefined }))}
      variableCategories={variableCategories}
      variableEstimates={variableEstimates}
      monthlyBaseline={monthlyBaseline}
    />
  );
}
