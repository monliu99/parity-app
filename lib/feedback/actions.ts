"use server";

import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";

export async function submitFeedback(input: {
  rating: number;
  comment?: string;
  page: string;
  userAgent?: string;
}): Promise<{ success: true } | { error: string }> {
  try {
    const { partnership, userId } = await getPartnership();

    const { rating, comment, page, userAgent } = input;

    if (!Number.isInteger(rating) || rating < 1 || rating > 3) {
      return { error: "Rating must be 1, 2, or 3" };
    }
    if (!page?.trim()) {
      return { error: "Page is required" };
    }

    const trimmedComment = comment?.trim().slice(0, 2000) || null;

    await db.feedback.create({
      data: {
        userId,
        partnershipId: partnership.id,
        rating,
        comment: trimmedComment,
        page: page.trim(),
        userAgent: userAgent?.slice(0, 500) || null,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to submit feedback",
    };
  }
}
