import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Pencil } from "lucide-react";
import { GoalForm } from "./goal-form";
import { UpdateProgress } from "./update-progress";
import { deleteGoal } from "./actions";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getMonthsUntil(date: Date): string {
  const now = new Date();
  const target = new Date(date);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  if (months <= 0) return "Past due";
  if (months === 1) return "1 month away";
  return `${months} months away`;
}

export default async function GoalsPage() {
  const { partnership, userId } = await getPartnership();

  const goals = await db.goal.findMany({
    where: { partnershipId: partnership.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {goals.length} shared goal{goals.length !== 1 ? "s" : ""}
          </p>
        </div>
        <GoalForm
          trigger={
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" />
              New goal
            </Button>
          }
        />
      </div>

      {goals.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-semibold">No goals yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a shared financial goal to track together.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const pct = Math.min(
              100,
              goal.targetAmount > 0
                ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                : 0
            );
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

            return (
              <Card key={goal.id} className="shadow-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-medium leading-snug">
                        {goal.name}
                      </CardTitle>
                      {(goal as any).ownerLabel === "PERSONAL" ? (
                        <Badge className="text-xs border-0 bg-secondary text-secondary-foreground">
                          {(goal as any).userId === userId ? "My goal" : "Partner's goal"}
                        </Badge>
                      ) : (
                        <Badge className="text-xs border-0 bg-secondary text-secondary-foreground">
                          Joint
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 -mt-1">
                      <GoalForm
                        goal={goal}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <form
                        action={async () => {
                          "use server";
                          await deleteGoal(goal.id);
                        }}
                      >
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(goal.currentAmount)}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatCurrency(goal.targetAmount)} goal
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-muted-foreground">
                        {pct}% funded
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(remaining)} to go
                      </span>
                    </div>
                  </div>
                  {goal.targetDate && (
                    <p className="text-xs text-muted-foreground">
                      Target: {formatDate(goal.targetDate)} ·{" "}
                      {getMonthsUntil(goal.targetDate)}
                    </p>
                  )}
                  {goal.notes && (
                    <p className="text-xs text-muted-foreground italic">
                      {goal.notes}
                    </p>
                  )}
                  <UpdateProgress
                    goalId={goal.id}
                    currentAmount={goal.currentAmount}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
