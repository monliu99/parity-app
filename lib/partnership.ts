import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export async function getPartnership() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    include: { partnership: true },
  });

  if (!membership) {
    redirect("/login");
  }

  return { partnership: membership.partnership, userId: session.user.id };
}
