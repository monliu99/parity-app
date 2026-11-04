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
    // Signed in, but the user has no partnership (e.g. it was deleted). Sign
    // out instead of redirecting to /login, which would loop via the proxy.
    redirect("/signout");
  }

  return { partnership: membership.partnership, userId: session.user.id };
}
