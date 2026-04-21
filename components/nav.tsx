"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Target,
  MessageCircle,
  PieChart,
  Settings,
  LogOut,
  ChevronUp,
  Shield,
  Sparkles,
  Calendar,
} from "lucide-react";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/life-planning", label: "Life Plan", icon: Sparkles },
  { href: "/budget", label: "Budget", icon: PieChart },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/review", label: "Monthly Review", icon: Calendar },
];

interface NavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() ?? "?");

  const navLink = (href: string, label: string, Icon: React.ElementType) => (
    <Link
      key={href}
      href={href}
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
  );

  return (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          <span className="text-xl tracking-tight text-foreground font-heading italic">
            Parity
          </span>
        </div>
        <Link
          href="/chat"
          title="Ask Parity"
          aria-label="Ask Parity"
          className={cn(
            "p-1 rounded-md transition-colors",
            pathname === "/chat"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageCircle className="h-4 w-4" />
        </Link>
      </div>

      {/* Main nav */}
      <div className="flex-1 px-2 py-4 flex flex-col gap-0.5">
        {mainNavItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
      </div>

      {/* Profile section */}
      <div className="relative px-3 py-3 border-t border-border" ref={panelRef}>
        {/* Floating panel */}
        {profileOpen && (
          <div className="absolute bottom-full left-0 right-0 mx-3 mb-2 bg-card border border-border rounded-lg shadow-card-hover overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold truncate">{user?.name ?? "You"}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
            </div>

            {/* Actions */}
            <div className="py-1">
              {user?.email === "mo@parity.app" && (
                <Link
                  href="/admin/feedback"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors w-full"
                >
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Admin
                </Link>
              )}
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors w-full"
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                Settings & Partnership
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-secondary transition-colors w-full"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Avatar trigger */}
        <button
          onClick={() => setProfileOpen((o) => !o)}
          className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md hover:bg-secondary transition-colors group"
        >
          <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-semibold truncate text-foreground">{user?.name ?? "You"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
              profileOpen ? "rotate-0" : "rotate-180"
            )}
          />
        </button>
      </div>
    </nav>
  );
}
