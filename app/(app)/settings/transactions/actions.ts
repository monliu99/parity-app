"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { revalidatePath } from "next/cache";
import { TRANSACTION_CATEGORIES } from "@/lib/transactions";

export async function createTransaction(formData: FormData) {
  try {
    const { partnership, userId } = await getPartnership();

    const description = formData.get("description") as string;
    const amountStr = formData.get("amount") as string;
    const category = formData.get("category") as string;
    const dateStr = formData.get("date") as string;
    const merchant = (formData.get("merchant") as string) || null;
    const accountId = (formData.get("accountId") as string) || null;
    const forPartner = formData.get("forPartner") === "true";
    const partnerId = formData.get("partnerId") as string | null;

    if (!amountStr) return { error: "Amount is required" };
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return { error: "Amount must be a valid number" };

    if (!category || !TRANSACTION_CATEGORIES.includes(category as any)) {
      return { error: "Please select a valid category" };
    }

    if (!dateStr) return { error: "Date is required" };
    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) return { error: "Invalid date" };

    const transactionUserId = forPartner && partnerId ? partnerId : userId;

    if (forPartner && partnerId) {
      const partnerMembership = await db.membership.findFirst({
        where: { partnershipId: partnership.id, userId: partnerId },
      });
      if (!partnerMembership) return { error: "Partner not found in your partnership" };
    }

    if (accountId) {
      const account = await db.account.findFirst({
        where: { id: accountId, partnershipId: partnership.id },
      });
      if (!account) return { error: "Account not found" };
    }

    await db.transaction.create({
      data: {
        partnershipId: partnership.id,
        userId: transactionUserId,
        accountId: accountId || null,
        amount,
        category,
        date,
        description: description || null,
        merchant,
      },
    });

    revalidatePath("/settings/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/review");
    return { success: true };
  } catch (error) {
    console.error("Error creating transaction:", error);
    return { error: error instanceof Error ? error.message : "Failed to create transaction" };
  }
}

export async function updateTransaction(id: string, formData: FormData) {
  try {
    const { partnership } = await getPartnership();

    const existing = await db.transaction.findFirst({
      where: { id, partnershipId: partnership.id },
    });
    if (!existing) return { error: "Transaction not found" };

    const description = formData.get("description") as string;
    const amountStr = formData.get("amount") as string;
    const category = formData.get("category") as string;
    const dateStr = formData.get("date") as string;
    const merchant = (formData.get("merchant") as string) || null;

    if (!amountStr) return { error: "Amount is required" };
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return { error: "Amount must be a valid number" };

    if (!category || !TRANSACTION_CATEGORIES.includes(category as any)) {
      return { error: "Please select a valid category" };
    }

    if (!dateStr) return { error: "Date is required" };
    const date = new Date(dateStr + "T00:00:00");

    await db.transaction.updateMany({
      where: { id, partnershipId: partnership.id },
      data: { description: description || null, amount, category, date, merchant },
    });

    revalidatePath("/settings/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/review");
    return { success: true };
  } catch (error) {
    console.error("Error updating transaction:", error);
    return { error: error instanceof Error ? error.message : "Failed to update transaction" };
  }
}

export async function deleteTransaction(id: string) {
  try {
    const { partnership } = await getPartnership();

    const existing = await db.transaction.findFirst({
      where: { id, partnershipId: partnership.id },
    });
    if (!existing) return { error: "Transaction not found" };

    await db.transaction.deleteMany({
      where: { id, partnershipId: partnership.id },
    });

    revalidatePath("/settings/transactions");
    revalidatePath("/dashboard");
    revalidatePath("/review");
    return { success: true };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete transaction" };
  }
}
