import { auth } from "@/auth";
import { redirect } from "next/navigation";

const ADMIN_EMAIL = "mo@parity.app";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest font-medium text-muted-foreground">
          Admin
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-sm font-heading italic text-foreground">Parity</span>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
