"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  Target,
  MessageCircle,
  PieChart,
  Settings,
  LogOut,
  Menu,
  Shield,
} from "lucide-react";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: CreditCard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budget", label: "Budget", icon: PieChart },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/chat", label: "Ask Parity", icon: MessageCircle },
];

interface MobileNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function MobileNav({ user }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() ?? "?");

  function handleNavClick() {
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      } />
      <SheetContent side="left" className="w-3/4 p-0">
        <div className="flex flex-col h-full bg-sidebar">
          {/* Logo */}
          <div className="px-5 py-6 border-b border-border flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-xl tracking-tight text-foreground font-heading italic">
              Parity
            </span>
          </div>

          {/* Main nav */}
          <div className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">
            {mainNavItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors relative",
                  pathname === href
                    ? "bg-primary/8 text-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-primary before:rounded-full"
                    : "text-muted-foreground font-medium hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>

          {/* Profile section */}
          <div className="px-3 py-3 border-t border-border">
            <div className="flex items-center gap-2.5 px-2 py-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate text-foreground">
                  {user?.name ?? "You"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              {user?.email === "mo@parity.app" && (
                <Link
                  href="/admin/feedback"
                  onClick={handleNavClick}
                  className="flex items-center gap-2.5 px-2 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Admin
                </Link>
              )}
              <Link
                href="/settings"
                onClick={handleNavClick}
                className="flex items-center gap-2.5 px-2 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                Settings & Partnership
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2.5 px-2 py-2 text-sm text-red-500 hover:bg-secondary rounded-md transition-colors text-left"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
