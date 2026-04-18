"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { askParity } from "@/lib/ai/chat";

export async function askParityAction(question: string): Promise<string> {
  const { partnership } = await getPartnership();

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [accounts, transactions, goals] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.transaction.findMany({
      where: { partnershipId: partnership.id, date: { gte: sixtyDaysAgo } },
      include: { account: true },
      orderBy: { date: "desc" },
    }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
  ]);

  return askParity(question, accounts, transactions, goals);
}
