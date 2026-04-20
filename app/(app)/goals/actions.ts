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
    const myAllocationStr = formData.get("myAllocation") as string || "50";
    const partnerAllocationStr = formData.get("partnerAllocation") as string || "50";

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

    // Validate allocations for joint goals
    if (ownerLabel === "JOINT") {
      const myAllocation = parseInt(myAllocationStr);
      const partnerAllocation = parseInt(partnerAllocationStr);
      if (isNaN(myAllocation) || isNaN(partnerAllocation)) {
        return { error: "Allocation percentages must be numbers" };
      }
      if (myAllocation + partnerAllocation !== 100) {
        return { error: "Allocations must add up to 100%" };
      }
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

    // Get partnership members for allocations
    const members = await db.membership.findMany({
      where: { partnershipId: partnership.id },
      select: { userId: true },
    });

    const myUserId = userId;
    const partnerUserId = members.find((m) => m.userId !== userId)?.userId;

    const goal = await (db.goal.create as Function)({
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

    // Create allocation records for joint goals
    if (ownerLabel === "JOINT" && partnerUserId) {
      await (db.goalAllocation.createMany as Function)({
        data: [
          { goalId: goal.id, userId: myUserId, percentage: parseInt(myAllocationStr) },
          { goalId: goal.id, userId: partnerUserId, percentage: parseInt(partnerAllocationStr) },
        ],
      });
    }

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
    const { partnership, userId } = await getPartnership();

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
    const myAllocationStr = formData.get("myAllocation") as string || "50";
    const partnerAllocationStr = formData.get("partnerAllocation") as string || "50";

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

    // Validate allocations for joint goals
    if (ownerLabel === "JOINT") {
      const myAllocation = parseInt(myAllocationStr);
      const partnerAllocation = parseInt(partnerAllocationStr);
      if (isNaN(myAllocation) || isNaN(partnerAllocation)) {
        return { error: "Allocation percentages must be numbers" };
      }
      if (myAllocation + partnerAllocation !== 100) {
        return { error: "Allocations must add up to 100%" };
      }
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

    // Update allocation records for joint goals
    if (ownerLabel === "JOINT") {
      const members = await db.membership.findMany({
        where: { partnershipId: partnership.id },
        select: { userId: true },
      });

      const myUserId = userId;
      const partnerUserId = members.find((m) => m.userId !== userId)?.userId;

      if (partnerUserId) {
        // Delete existing allocations and create new ones
        await db.goalAllocation.deleteMany({
          where: { goalId: id },
        });

        await (db.goalAllocation.createMany as Function)({
          data: [
            { goalId: id, userId: myUserId, percentage: parseInt(myAllocationStr) },
            { goalId: id, userId: partnerUserId, percentage: parseInt(partnerAllocationStr) },
          ],
        });
      }
    }

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

export async function addGoalContribution(goalId: string, amount: number, accountId: string) {
  let isFirst = false;
  try {
    const { partnership, userId } = await getPartnership();

    // Verify goal exists and belongs to partnership
    const goal = await db.goal.findFirst({
      where: { id, partnershipId: partnership.id },
    });

    if (!goal) {
      return { error: "Goal not found" };
    }

    if (isNaN(amount) || amount <= 0) {
      return { error: "Amount must be positive" };
    }

    const newTotal = goal.currentAmount + amount;
    if (newTotal > goal.targetAmount) {
      return { error: "Amount would exceed goal target" };
    }

    // Get the account to determine ownership
    const account = await db.account.findFirst({
      where: { id: accountId, partnershipId: partnership.id },
    });

    if (!account) {
      return { error: "Account not found" };
    }

    // Get both partnership members
    const members = await db.membership.findMany({
      where: { partnershipId: partnership.id },
      select: { userId: true },
    });

    if (members.length !== 2) {
      return { error: "Joint goals require exactly two partners" };
    }

    const myUserId = userId;
    const partnerUserId = members.find((m) => m.userId !== userId)?.userId || null;

    if (!partnerUserId) {
      return { error: "Partner not found" };
    }

    // Determine contribution amounts based on account ownership
    let myContribution = 0;
    let partnerContribution = 0;

    if (account.userId === null) {
      // Joint account: split according to goal's allocation percentages
      const allocations = await db.goalAllocation.findMany({
        where: { goalId },
      });

      if (allocations.length === 2) {
        const myAllocation = allocations.find((a) => a.userId === myUserId);
        const partnerAlloc = allocations.find((a) => a.userId === partnerUserId);

        if (myAllocation && partnerAlloc) {
          myContribution = (amount * myAllocation.percentage) / 100;
          partnerContribution = (amount * partnerAlloc.percentage) / 100;
        } else {
          // Fallback to 50/50 if allocations not found
          myContribution = amount / 2;
          partnerContribution = amount / 2;
        }
      } else {
        // Fallback to 50/50 if allocations not set
        myContribution = amount / 2;
        partnerContribution = amount / 2;
      }
    } else if (account.userId === myUserId) {
      // My account: 100% me
      myContribution = amount;
      partnerContribution = 0;
    } else {
      // Partner's account: 100% partner
      myContribution = 0;
      partnerContribution = amount;
    }

    // Create contribution records
    await (db.goalContribution.createMany as Function)({
      data: [
        ...(myContribution > 0
          ? [{ goalId, userId: myUserId, amount: myContribution }]
          : []),
        ...(partnerContribution > 0
          ? [{ goalId, userId: partnerUserId, amount: partnerContribution }]
          : []),
      ],
    });

    // Update goal current amount
    await db.goal.updateMany({
      where: { id, partnershipId: partnership.id },
      data: { currentAmount: newTotal },
    });

    revalidatePath("/goals");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error adding goal contribution:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to add contribution",
    };
  }
}
