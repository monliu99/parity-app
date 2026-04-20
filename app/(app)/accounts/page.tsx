import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AccountForm } from "./account-form";
import { EditableBalance } from "./editable-balance";
import { deleteAccount } from "./actions";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  INVESTMENT: "Investment",
  RETIREMENT: "Retirement",
  CREDIT: "Credit Card",
  OTHER: "Other",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function AccountsPage() {
  const { partnership, userId } = await getPartnership();

  const [accounts, members] = await Promise.all([
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

  // Joint accounts: userId is null (shared between partners)
  const jointAccounts = accounts.filter((a) => (a as any).userId === null);
  const totalJoint = jointAccounts.reduce((sum, a) => sum + a.balance, 0);

  // My accounts: owned by me
  const mine = accounts.filter((a) => (a as any).userId === userId);
  const totalMine = mine.reduce((sum, a) => sum + a.balance, 0);

  // Partner's accounts: owned by partner
  const partnerAccounts = accounts.filter((a) => (a as any).userId !== null && (a as any).userId !== userId);
  const totalPartner = partnerAccounts.reduce((sum, a) => sum + a.balance, 0);

  const combined = totalJoint + totalMine + totalPartner;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Combined net worth:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(combined)}
            </span>
          </p>
        </div>
        <AccountForm
          partnerId={partnerMember?.userId}
          partnerName={partnerMember?.user.name}
          trigger={
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1" />
              Add account
            </Button>
          }
        />
      </div>

      {accounts.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-semibold">No accounts yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first account to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Joint accounts section - full width */}
          <AccountGroup
            label="Joint"
            accounts={jointAccounts}
            total={totalJoint}
          />
          {/* Individual accounts - two columns below */}
          <div className="grid gap-6 md:grid-cols-2">
            <AccountGroup
              label="Mine"
              accounts={mine}
              total={totalMine}
            />
            <AccountGroup
              label={partnerMember ? `${partnerMember.user.name}'s` : "Partner's"}
              accounts={partnerAccounts}
              total={totalPartner}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AccountGroup({
  label,
  accounts,
  total,
}: {
  label: string;
  accounts: Awaited<ReturnType<typeof db.account.findMany>>;
  total: number;
}) {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          {/* Total sits flush right, same size as label — same edge as individual balances below */}
          <span className="text-base font-bold tabular-nums text-moss">
            {formatCurrency(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No accounts added yet.
          </p>
        ) : (
          accounts.map((account) => (
            <div
              key={account.id}
              className="relative flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors group"
            >
              <div className="min-w-0 flex-1 pr-4">
                <p className="text-sm font-medium">{account.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                  </Badge>
                  {account.institution && (
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      {account.institution}
                    </span>
                  )}
                </div>
              </div>
              {/* Balance — flush right, same edge as group total */}
              <EditableBalance accountId={account.id} balance={account.balance} />
              {/* Buttons absolutely positioned so they don't shift the balance */}
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-md">
                <AccountForm
                  account={account}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <form
                  action={async () => {
                    "use server";
                    await deleteAccount(account.id);
                  }}
                >
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
