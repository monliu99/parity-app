"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { askParity } from "@/lib/ai/chat";
import { getMonthlyBaseline } from "@/lib/budget";

export async function askParityAction(question: string): Promise<string> {
  const { partnership } = await getPartnership();

  const [accounts, goals, baseline] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getMonthlyBaseline(partnership.id),
  ]);

  return askParity(question, accounts, goals, baseline);
}
