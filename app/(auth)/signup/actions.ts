"use server";

import { db } from "@/lib/db";
import { Prisma } from "@/app/generated/prisma/client";
import { generateInviteCode } from "@/lib/invite-code";
import bcrypt from "bcryptjs";

type SignupResult =
  | { success: true }
  | { success: false; error: string };

export async function signupAction(formData: FormData): Promise<SignupResult> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const inviteCode = (formData.get("inviteCode") as string)?.trim().toUpperCase();

  if (!name || !email || !password) {
    return { success: false, error: "All fields are required." };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 8);

  // If invite code provided, join existing partnership; otherwise create new one
  if (inviteCode) {
    // The member-count check and the join run in one serializable transaction,
    // so two people using the same code at once can't both get in.
    try {
      await db.$transaction(
        async (tx) => {
          const partnership = await tx.partnership.findUnique({
            where: { inviteCode },
            select: { id: true, _count: { select: { members: true } } },
          });
          if (!partnership) throw new SignupError("Invalid invite code.");
          if (partnership._count.members >= 2) {
            throw new SignupError("This partnership is already full.");
          }
          await tx.user.create({
            data: {
              name,
              email,
              passwordHash,
              memberships: {
                create: { partnershipId: partnership.id },
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      return signupFailure(error);
    }
  } else {
    // Create new user + new partnership
    let code = generateInviteCode();
    // Ensure uniqueness
    while (await db.partnership.findUnique({ where: { inviteCode: code } })) {
      code = generateInviteCode();
    }

    try {
      await db.user.create({
        data: {
          name,
          email,
          passwordHash,
          memberships: {
            create: {
              partnership: {
                create: { inviteCode: code },
              },
            },
          },
        },
      });
    } catch (error) {
      return signupFailure(error);
    }
  }

  return { success: true };
}

/** An expected, user-facing signup failure. */
class SignupError extends Error {}

function signupFailure(error: unknown): SignupResult {
  if (error instanceof SignupError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: unique constraint (another signup took this email first).
    if (error.code === "P2002") {
      return { success: false, error: "An account with this email already exists." };
    }
    // P2034: serialization conflict (a concurrent signup used the same code).
    if (error.code === "P2034") {
      return { success: false, error: "Something changed while signing up. Please try again." };
    }
  }
  throw error;
}
