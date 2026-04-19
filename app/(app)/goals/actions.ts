"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createGoal(formData: FormData) {
  let isFirst = false;
  try {
    const { partnership, userId } = await getPartnership();

    const name = formData.get("name") as string;
    const targetAmountStr = formData.get("targetAmount") as string;
    const currentAmountStr = (formData.get("currentAmount") as string) || "0";
    const targetDateStr = formData.get("targetDate") as string;
    const ownerLabel = (formData.get("ownerLabel") as string) || "JOINT";
    const notes = (formData.get("notes") as string) || null;

    // Validation
    if (!name?.trim()) {
      return { error: "Goal name is required" };
    }
    if (!targetAmountStr) {
      return { error: "Target amount is required" };
    }
    const targetAmount = parseFloat(targetAmountStr);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      return { error: "Target amount must be a positive number" };
    }
    const currentAmount = parseFloat(currentAmountStr);
    if (isNaN(currentAmount) || currentAmount < 0) {
      return { error: "Current amount must be a valid number" };
    }
    if (currentAmount > targetAmount) {
      return { error: "Current amount cannot exceed target amount" };
    }
    if (!["JOINT", "PERSONAL"].includes(ownerLabel)) {
      return { error: "Please select a valid goal type" };
    }

    let targetDate: Date | null = null;
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
      if (isNaN(targetDate.getTime())) {
        return { error: "Invalid target date" };
      }
      // Target date must be in the future
      if (targetDate <= new Date()) {
        return { error: "Target date must be in the future" };
      }
    }

    const existingCount = await db.goal.count({
      where: { partnershipId: partnership.id },
    });
    isFirst = existingCount === 0;

    await (db.goal.create as Function)({
      data: {
        partnershipId: partnership.id,
        userId: ownerLabel === "PERSONAL" ? userId : null,
        ownerLabel,
        name,
        targetAmount,
        currentAmount,
        targetDate,
        notes,
      },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error creating goal:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to create goal",
    };
  }
  if (isFirst) redirect("/dashboard");
  return { success: true };
}

export async function updateGoal(id: string, formData: FormData) {
  try {
    const { partnership } = await getPartnership();

    // Verify goal exists and belongs to partnership
    const existing = await db.goal.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Goal not found" };
    }

    const name = formData.get("name") as string;
    const targetAmountStr = formData.get("targetAmount") as string;
    const targetDateStr = formData.get("targetDate") as string;
    const ownerLabel = (formData.get("ownerLabel") as string) || "JOINT";
    const notes = (formData.get("notes") as string) || null;

    // Validation
    if (!name?.trim()) {
      return { error: "Goal name is required" };
    }
    if (!targetAmountStr) {
      return { error: "Target amount is required" };
    }
    const targetAmount = parseFloat(targetAmountStr);
    if (isNaN(targetAmount) || targetAmount <= 0) {
      return { error: "Target amount must be a positive number" };
    }
    if (!["JOINT", "PERSONAL"].includes(ownerLabel)) {
      return { error: "Please select a valid goal type" };
    }

    let targetDate: Date | null = null;
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
      if (isNaN(targetDate.getTime())) {
        return { error: "Invalid target date" };
      }
    }

    await db.goal.updateMany({
      where: { id, partnershipId: partnership.id },
      data: {
        ownerLabel,
        name,
        targetAmount,
        targetDate,
        notes,
      },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error updating goal:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update goal",
    };
  }
}

export async function updateGoalProgress(id: string, currentAmount: number) {
  try {
    const { partnership } = await getPartnership();

    // Verify goal exists and belongs to partnership
    const existing = await db.goal.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Goal not found" };
    }

    if (isNaN(currentAmount) || currentAmount < 0) {
      return { error: "Invalid amount" };
    }

    if (currentAmount > existing.targetAmount) {
      return { error: "Amount cannot exceed target" };
    }

    await db.goal.updateMany({
      where: { id, partnershipId: partnership.id },
      data: { currentAmount },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error updating goal progress:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to update goal",
    };
  }
}

export async function deleteGoal(id: string) {
  try {
    const { partnership } = await getPartnership();

    // Verify goal exists and belongs to partnership
    const existing = await db.goal.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!existing) {
      return { error: "Goal not found" };
    }

    await db.goal.deleteMany({
      where: { id, partnershipId: partnership.id },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error deleting goal:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete goal",
    };
  }
}
