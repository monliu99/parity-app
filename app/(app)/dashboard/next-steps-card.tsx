import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

interface NextStepsGoal {
  id: string;
  name: string;
  month: number | null;
}

export function NextStepsCard({ goals }: { goals: NextStepsGoal[] }) {
  if (goals.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Next Steps
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Your roadmap actions will appear here once you create a life plan.
          </p>
          <Link
            href="/life-planning"
            className="text-sm text-primary font-medium hover:underline mt-3 block"
          >
            Create your life plan →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card overflow-hidden">
      <CardContent className="p-0">
        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Next Steps
          </p>
        </div>
        <div className="px-3 pb-2 space-y-0.5">
          {goals.map((goal, i) => (
            <div
              key={goal.id}
              className={`flex items-start gap-2.5 px-2 py-2 rounded-lg${i === 0 ? " bg-primary/5" : ""}`}
            >
              <div className="h-3.5 w-3.5 rounded border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-snug">{goal.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {i === 0 ? (
                    <span className="font-medium text-primary">
                      This month{goal.month ? ` · Month ${goal.month}` : ""}
                    </span>
                  ) : goal.month ? (
                    `Month ${goal.month}`
                  ) : null}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border/50">
          <Link href="/goals" className="text-xs text-primary hover:underline">
            View all actions →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
