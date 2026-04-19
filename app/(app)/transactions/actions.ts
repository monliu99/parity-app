"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { categorizeTransaction } from "@/lib/ai/categorize";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTransaction(formData: FormData) {
  let isFirst = false;
  try {
    const { partnership, userId } = await getPartnership();

    const merchant = formData.get("merchant") as string;
    const amountStr = formData.get("amount") as string;
    const accountId = formData.get("accountId") as string;
    const ownerLabel = formData.get("ownerLabel") as string;
    const dateStr = formData.get("date") as string;
    const notes = (formData.get("notes") as string) || null;

    // Validation
    if (!merchant?.trim()) {
      return { error: "Merchant name is required" };
    }
    if (!amountStr) {
      return { error: "Amount is required" };
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { error: "Amount must be a positive number" };
    }
    if (!accountId) {
      return { error: "Please select an account" };
    }
    if (!ownerLabel || !["MINE", "PARTNER", "JOINT"].includes(ownerLabel)) {
      return { error: "Please select who this transaction is for" };
    }
    if (!dateStr) {
      return { error: "Date is required" };
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return { error: "Invalid date" };
    }

    // Verify account exists and belongs to partnership
    const account = await db.account.findFirst({
      where: { id: accountId, partnershipId: partnership.id },
    });

    if (!account) {
      return { error: "Selected account not found" };
    }

    const existingCount = await db.transaction.count({
      where: { partnershipId: partnership.id },
    });
    isFirst = existingCount === 0;

    // AI categorization
    const category = await categorizeTransaction(merchant, amount);

    await (db.transaction.create as Function)({
      data: {
        partnershipId: partnership.id,
        accountId,
        userId,
        ownerLabel,
        merchant,
        amount,
        category,
        date,
        notes,
      },
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error creating transaction:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create transaction",
    };
  }
  if (isFirst) redirect("/dashboard");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  try {
    const { partnership } = await getPartnership();

    // Verify transaction exists and belongs to partnership
    const existing = await db.transaction.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Transaction not found" };
    }

    const merchant = formData.get("merchant") as string;
    const amountStr = formData.get("amount") as string;
    const ownerLabel = formData.get("ownerLabel") as string;
    const accountId = formData.get("accountId") as string;
    const dateStr = formData.get("date") as string;
    const notes = (formData.get("notes") as string) || null;

    // Validation
    if (!merchant?.trim()) {
      return { error: "Merchant name is required" };
    }
    if (!amountStr) {
      return { error: "Amount is required" };
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) {
      return { error: "Amount must be a valid number" };
    }
    if (!accountId) {
      return { error: "Please select an account" };
    }
    if (!ownerLabel || !["MINE", "PARTNER", "JOINT"].includes(ownerLabel)) {
      return { error: "Please select who this transaction is for" };
    }
    if (!dateStr) {
      return { error: "Date is required" };
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return { error: "Invalid date" };
    }

    // Verify account exists and belongs to partnership
    const account = await db.account.findFirst({
      where: { id: accountId, partnershipId: partnership.id },
    });

    if (!account) {
      return { error: "Selected account not found" };
    }

    await db.transaction.updateMany({
      where: { id, partnershipId: partnership.id },
      data: { merchant, amount, ownerLabel, accountId, date, notes },
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error updating transaction:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update transaction",
    };
  }
}

export async function deleteTransaction(id: string) {
  try {
    const { partnership } = await getPartnership();

    // Verify transaction exists and belongs to partnership
    const existing = await db.transaction.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Transaction not found" };
    }

    await db.transaction.deleteMany({
      where: { id, partnershipId: partnership.id },
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete transaction",
    };
  }
}

export async function markAsJointAction(id: string) {
  try {
    const { partnership } = await getPartnership();

    const existing = await db.transaction.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Transaction not found" };
    }

    await db.transaction.updateMany({
      where: { id, partnershipId: partnership.id },
      data: { ownerLabel: "JOINT" },
    });

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error marking transaction as joint:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update transaction",
    };
  }
}
