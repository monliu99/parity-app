import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Pencil } from "lucide-react";
import { TransactionForm } from "./transaction-form";
import { deleteTransaction } from "./actions";
import { CATEGORY_BADGE_CLASSES, DEFAULT_BADGE_CLASS } from "@/lib/category-colors";
import { getSplitSuggestions } from "@/lib/ai/split-suggestions";
import { SplitSuggestionsPanel } from "./split-suggestions-panel";
import { SettlementCard } from "./settlement-card";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatCurrencyShort(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateFull(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function formatDateKey(date: Date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function ownerDisplay(
  tx: { ownerLabel: string; userId?: string | null },
  currentUserId: string
) {
  if (tx.ownerLabel === "JOINT") return "Joint";
  const isMine = (tx as { userId?: string | null }).userId === currentUserId;
  if (tx.ownerLabel === "MINE") return isMine ? "Mine" : "Partner's";
  if (tx.ownerLabel === "PARTNER") return isMine ? "Partner's" : "Mine";
  return tx.ownerLabel;
}

export default async function TransactionsPage() {
  const { partnership, userId } = await getPartnership();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [transactions, accounts, members] = await Promise.all([
    db.transaction.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { date: "desc" },
      take: 100,
      include: { account: true },
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

  // Partner info
  const partner = members.find((m) => m.userId !== userId)?.user ?? null;
  const partnerName = partner?.name ?? "Partner";

  // Group by date
  const grouped: { dateKey: string; dateLabel: string; txns: typeof transactions }[] = [];
  const seenKeys = new Map<string, number>();
  for (const tx of transactions) {
    const key = formatDateKey(tx.date);
    if (seenKeys.has(key)) {
      grouped[seenKeys.get(key)!].txns.push(tx);
    } else {
      seenKeys.set(key, grouped.length);
      grouped.push({ dateKey: key, dateLabel: formatDateFull(tx.date), txns: [tx] });
    }
  }

  // Summary stats
  const totalSpent = transactions
    .filter((t) => t.category !== "Income")
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.category === "Income")
    .reduce((s, t) => s + t.amount, 0);

  // Settlement calculation (last 30 days, JOINT only)
  const recentJoint = transactions.filter(
    (t) => t.ownerLabel === "JOINT" && new Date(t.date) >= thirtyDaysAgo
  );
  let partnerOwesMe = 0;
  let iOwePartner = 0;
  for (const tx of recentJoint) {
    if (tx.userId === userId) {
      partnerOwesMe += tx.amount / 2;
    } else {
      iOwePartner += tx.amount / 2;
    }
  }
  const settlementNet = partnerOwesMe - iOwePartner; // positive = partner owes me

  // AI split suggestions (last 30 days, MINE/PARTNER only)
  const individualRecent = transactions.filter(
    (t) =>
      (t.ownerLabel === "MINE" || t.ownerLabel === "PARTNER") &&
      new Date(t.date) >= thirtyDaysAgo
  );
  const splitSuggestions = await getSplitSuggestions(partnership.id, individualRecent);

  const showSettlement = members.length === 2 && recentJoint.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <TransactionForm
          accounts={accounts}
          currentUserId={userId}
          trigger={
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" />
              Add transaction
            </Button>
          }
        />
      </div>

      {/* Summary strip */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="shadow-card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
                Total Spent
              </p>
              <p className="text-3xl font-bold tabular-nums text-foreground leading-none">
                {formatCurrencyShort(totalSpent)}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">
                Total Income
              </p>
              <p className="text-3xl font-bold tabular-nums text-moss leading-none">
                {formatCurrencyShort(totalIncome)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settlement card */}
      {showSettlement && (
        <SettlementCard
          netAmount={settlementNet}
          partnerName={partnerName}
          jointCount={recentJoint.length}
        />
      )}

      {/* AI split suggestions */}
      {splitSuggestions.length > 0 && (
        <SplitSuggestionsPanel suggestions={splitSuggestions} />
      )}

      {/* Transaction list */}
      <Card className="shadow-card">
        {transactions.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-semibold">No transactions yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              {accounts.length === 0
                ? "Add an account first, then record transactions."
                : "Add your first transaction to get started."}
            </p>
          </CardContent>
        ) : (
          <CardContent className="pt-4 pb-4">
            {grouped.map(({ dateKey, dateLabel, txns }, groupIdx) => (
              <div key={dateKey} className={groupIdx > 0 ? "mt-2" : ""}>
                {/* Date group header */}
                <div className={`flex items-center gap-3 ${groupIdx > 0 ? "pt-3" : "pb-1"} pb-2`}>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium whitespace-nowrap">
                    {dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>

                <div className="space-y-1.5">
                  {txns.map((tx) => {
                    const isIncome = tx.category === "Income";
                    return (
                      <div
                        key={tx.id}
                        className="relative flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors group"
                      >
                        {/* Left: merchant + meta */}
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{tx.merchant}</p>
                            <Badge
                              className={`text-xs border-0 shrink-0 ${CATEGORY_BADGE_CLASSES[tx.category] ?? DEFAULT_BADGE_CLASS}`}
                            >
                              {tx.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ownerDisplay(tx, userId)} · {tx.account.name}
                          </p>
                        </div>

                        {/* Right: amount */}
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            isIncome ? "text-moss" : "text-foreground"
                          }`}
                        >
                          {isIncome ? "+" : ""}{formatCurrency(tx.amount)}
                        </span>

                        {/* Action buttons */}
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-md">
                          <TransactionForm
                            accounts={accounts}
                            currentUserId={userId}
                            transaction={tx}
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
                              await deleteTransaction(tx.id);
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
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
