"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { askParity } from "@/lib/ai/chat";
import { getRollingBaseline } from "@/lib/transactions";

export async function askParityAction(question: string): Promise<string> {
  const { partnership } = await getPartnership();

  const [accounts, goals, baseline] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getRollingBaseline(partnership.id),
  ]);

  return askParity(question, accounts, goals, baseline?.average ?? null);
}
