import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { TransactionForm } from "./transaction-form";
import { deleteTransaction } from "./actions";
import { CATEGORY_BADGE_CLASSES, DEFAULT_BADGE_CLASS } from "@/lib/category-colors";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function TransactionsPage() {
  const { partnership, userId } = await getPartnership();

  const [transactions, accounts, members] = await Promise.all([
    db.transaction.findMany({
      where: { partnershipId: partnership.id },
      include: { account: true },
      orderBy: { date: "desc" },
    }),
    db.account.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "asc" },
    }),
    db.membership.findMany({
      where: { partnershipId: partnership.id },
      include: { user: true },
    }),
  ]);

  const partnerMember = members.find((m) => m.userId !== userId);
  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));

  // Group by month
  const grouped: Record<string, typeof transactions> = {};
  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, "0")}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  const sortedMonths = Object.keys(grouped).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your spending to see your baseline.
          </p>
        </div>
        <TransactionForm
          accounts={accountOptions}
          partnerId={partnerMember?.userId}
          partnerName={partnerMember?.user.name}
          currentUserId={userId}
          trigger={
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" />
              Add transaction
            </Button>
          }
        />
      </div>

      {transactions.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-semibold">No transactions yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add transactions to track your spending and see your monthly baseline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedMonths.map((month) => {
            const monthTx = grouped[month];
            const monthTotal = monthTx.reduce((s, t) => s + t.amount, 0);
            const [year, mon] = month.split("-");
            const label = new Date(+year, +mon - 1).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            });

            return (
              <Card key={month} className="shadow-card">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-5 pt-4 pb-2">
                    <p className="text-sm font-semibold">{label}</p>
                    <span className="text-sm font-bold tabular-nums">
                      {formatCurrency(monthTotal)}
                    </span>
                  </div>
                  <div className="space-y-0.5 px-2 pb-3">
                    {monthTx.map((t) => (
                      <div
                        key={t.id}
                        className="relative flex items-center justify-between p-3 rounded-lg hover:bg-secondary/60 transition-colors group"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="text-sm font-medium truncate">
                            {t.description || t.merchant || t.category}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className={`text-xs ${CATEGORY_BADGE_CLASSES[t.category] ?? DEFAULT_BADGE_CLASS}`}>
                              {t.category}
                            </Badge>
                            {t.merchant && (
                              <span className="text-xs text-muted-foreground">
                                {t.merchant}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {t.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(t.amount)}
                        </span>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background rounded-md">
                          <TransactionForm
                            transaction={t}
                            accounts={accountOptions}
                            partnerId={partnerMember?.userId}
                            partnerName={partnerMember?.user.name}
                            currentUserId={userId}
                            trigger={
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                          <form
                            action={async () => {
                              "use server";
                              await deleteTransaction(t.id);
                            }}
                          >
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
