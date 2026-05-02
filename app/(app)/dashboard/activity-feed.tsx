import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  type: "goal_contribution" | "transaction" | "review" | "goal_created" | "life_plan";
  description: string;
  createdAt: Date;
  avatarVariant: "primary" | "earthy";
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Avatar({
  name,
  variant,
}: {
  name: string;
  variant: "primary" | "earthy";
}) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        variant === "primary"
          ? "bg-primary/15 text-primary"
          : "bg-earthy-light text-earthy-foreground"
      }`}
    >
      {initial}
    </div>
  );
}

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-0">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Recent Activity
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-5 pb-5">
            <p className="text-sm text-muted-foreground">
              Start building your financial picture together.
            </p>
            <Link href="/transactions" className="text-xs text-primary hover:underline mt-2 inline-block">
              Add your first transaction →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                <Avatar name={item.userName} variant={item.avatarVariant} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">{item.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
