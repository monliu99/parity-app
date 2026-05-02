"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { askParity } from "@/lib/ai/chat";
import { getMonthlySpending, getSpendingByUser } from "@/lib/transactions";

export async function askParityAction(question: string): Promise<string> {
  const { partnership, userId } = await getPartnership();

  const [accounts, goals, monthlySpending, spendingByUser, memberships] = await Promise.all([
    db.account.findMany({ where: { partnershipId: partnership.id } }),
    db.goal.findMany({ where: { partnershipId: partnership.id } }),
    getMonthlySpending(partnership.id, 3),
    getSpendingByUser(partnership.id, 3),
    db.membership.findMany({
      where: { partnershipId: partnership.id },
      include: { user: true },
    }),
  ]);

  const you = memberships.find((m) => m.userId === userId)?.user;
  const partner = memberships.find((m) => m.userId !== userId)?.user;

  const userNameMap: Record<string, string> = {
    [userId]: you?.name ?? "You",
  };
  if (partner) {
    userNameMap[partner.id] = partner.name ?? "Partner";
  }

  const spendingByPerson = spendingByUser.map((s) => ({
    name: userNameMap[s.userId] ?? "Unknown",
    total: s.total,
    categories: s.byCategory,
  }));

  return askParity(
    question,
    accounts,
    goals,
    monthlySpending,
    spendingByPerson,
    you?.name ?? "You",
    partner?.name ?? "your partner"
  );
}
