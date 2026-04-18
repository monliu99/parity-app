import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - hidden on mobile, visible on md and up */}
      <aside className="hidden md:flex w-56 bg-sidebar border-r border-border flex-shrink-0">
        <Nav user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header - only visible on small screens */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-lg tracking-tight text-foreground font-heading italic">
              Parity
            </span>
          </div>
          <MobileNav user={{ name: session.user?.name, email: session.user?.email, image: session.user?.image }} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
