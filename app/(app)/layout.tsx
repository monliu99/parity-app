import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Nav from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let reviewDue = false;
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    select: { partnershipId: true },
  });
  if (membership) {
    const lastReview = await db.reviewHistory.findFirst({
      where: { partnershipId: membership.partnershipId, skipped: false },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    if (lastReview) {
      const daysSince = Math.floor(
        (Date.now() - lastReview.completedAt.getTime()) / 86400000
      );
      reviewDue = daysSince >= 30;
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <FeedbackWidget />
      <aside className="hidden md:flex w-56 bg-sidebar border-r border-border flex-shrink-0">
        <Nav
          user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }}
          reviewDue={reviewDue}
        />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-lg tracking-tight text-foreground font-heading italic">
              Parity
            </span>
          </div>
          <MobileNav
            user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }}
            reviewDue={reviewDue}
          />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
