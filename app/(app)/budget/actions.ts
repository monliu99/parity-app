"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { revalidatePath } from "next/cache";

export async function upsertFixedCost(category: string, amount: number, notes?: string) {
  try {
    const { partnership } = await getPartnership();

    if (!category?.trim()) return { error: "Category is required" };
    if (isNaN(amount) || amount < 0) return { error: "Amount must be a valid number" };

    await db.budgetFixed.upsert({
      where: { partnershipId_category: { partnershipId: partnership.id, category: category.trim() } },
      update: { amount, notes: notes ?? null },
      create: { partnershipId: partnership.id, category: category.trim(), amount, notes: notes ?? null },
    });

    revalidatePath("/budget");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }
}

export async function deleteFixedCost(id: string) {
  try {
    const { partnership } = await getPartnership();

    await db.budgetFixed.deleteMany({
      where: { id, partnershipId: partnership.id },
    });

    revalidatePath("/budget");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete" };
  }
}

export async function upsertVariableEstimate(category: string, amount: number) {
  try {
    const { partnership, userId } = await getPartnership();

    if (!category?.trim()) return { error: "Category is required" };
    if (isNaN(amount) || amount < 0) return { error: "Amount must be a valid number" };

    await db.budgetVariable.upsert({
      where: {
        partnershipId_userId_category: {
          partnershipId: partnership.id,
          userId,
          category: category.trim(),
        },
      },
      update: { amount },
      create: { partnershipId: partnership.id, userId, category: category.trim(), amount },
    });

    revalidatePath("/budget");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }
}
