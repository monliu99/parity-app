"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "INVESTMENT", "RETIREMENT", "CREDIT", "OTHER"];

export async function createAccount(formData: FormData) {
  let isFirst = false;
  try {
    const { partnership, userId } = await getPartnership();

    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const balanceStr = formData.get("balance") as string;
    const institution = (formData.get("institution") as string) || null;
    const forPartner = formData.get("forPartner") === "true";
    const partnerId = formData.get("partnerId") as string | null;

    if (!name?.trim()) {
      return { error: "Account name is required" };
    }
    if (!type || !VALID_ACCOUNT_TYPES.includes(type)) {
      return { error: "Please select a valid account type" };
    }
    if (!balanceStr) {
      return { error: "Balance is required" };
    }
    const balance = parseFloat(balanceStr);
    if (isNaN(balance)) {
      return { error: "Balance must be a valid number" };
    }

    const accountUserId = forPartner && partnerId ? partnerId : userId;

    if (forPartner && partnerId) {
      const partnerMembership = await db.membership.findFirst({
        where: {
          partnershipId: partnership.id,
          userId: partnerId,
        },
      });
      if (!partnerMembership) {
        return { error: "Partner not found in your partnership" };
      }
    }

    const existingCount = await db.account.count({
      where: { partnershipId: partnership.id },
    });
    isFirst = existingCount === 0;

    await (db.account.create as Function)({
      data: {
        partnershipId: partnership.id,
        userId: accountUserId,
        ownerLabel: forPartner ? "PARTNER" : "MINE",
        name,
        type,
        balance,
        institution,
      },
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error creating account:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create account",
    };
  }
  if (isFirst) redirect("/dashboard");
  return { success: true };
}

export async function updateAccount(id: string, formData: FormData) {
  try {
    const { partnership } = await getPartnership();

    const existing = await db.account.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Account not found" };
    }

    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    const balanceStr = formData.get("balance") as string;
    const institution = (formData.get("institution") as string) || null;

    if (!name?.trim()) {
      return { error: "Account name is required" };
    }
    if (!type || !VALID_ACCOUNT_TYPES.includes(type)) {
      return { error: "Please select a valid account type" };
    }
    if (!balanceStr) {
      return { error: "Balance is required" };
    }
    const balance = parseFloat(balanceStr);
    if (isNaN(balance)) {
      return { error: "Balance must be a valid number" };
    }

    await db.account.updateMany({
      where: { id, partnershipId: partnership.id },
      data: {
        name,
        type,
        balance,
        institution,
      },
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error updating account:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update account",
    };
  }
}

export async function deleteAccount(id: string) {
  try {
    const { partnership } = await getPartnership();

    const existing = await db.account.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Account not found" };
    }

    await db.account.deleteMany({
      where: { id, partnershipId: partnership.id },
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting account:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete account",
    };
  }
}

export async function updateAccountBalance(accountId: string, balance: number) {
  try {
    const { partnership } = await getPartnership();

    const existing = await db.account.findFirst({
      where: { id: accountId, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Account not found" };
    }

    if (isNaN(balance) || balance < 0) {
      return { error: "Balance must be a valid number" };
    }

    await db.account.updateMany({
      where: { id: accountId, partnershipId: partnership.id },
      data: { balance },
    });

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error updating account balance:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update balance",
    };
  }
}
