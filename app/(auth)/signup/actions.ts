"use server";

import { db } from "@/lib/db";
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
    const partnership = await db.partnership.findUnique({
      where: { inviteCode },
      include: { members: true },
    });

    if (!partnership) {
      return { success: false, error: "Invalid invite code." };
    }

    if (partnership.members.length >= 2) {
      return { success: false, error: "This partnership is already full." };
    }

    await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        memberships: {
          create: { partnershipId: partnership.id },
        },
      },
    });
  } else {
    // Create new user + new partnership
    let code = generateInviteCode();
    // Ensure uniqueness
    while (await db.partnership.findUnique({ where: { inviteCode: code } })) {
      code = generateInviteCode();
    }

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
  }

  return { success: true };
}
