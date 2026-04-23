import { db } from "@/lib/db";
import { getPartnership } from "@/lib/partnership";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyInviteCode } from "./copy-invite-code";
import Link from "next/link";
import { CreditCard, ChevronRight, Receipt } from "lucide-react";

export default async function SettingsPage() {
  const { partnership, userId } = await getPartnership();

  const members = await db.membership.findMany({
    where: { partnershipId: partnership.id },
    include: { user: true },
  });

  const me = members.find((m) => m.userId === userId);
  const partner = members.find((m) => m.userId !== userId);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your partnership.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Accounts & Net Worth</CardTitle>
          <CardDescription>
            Manage your accounts and track combined net worth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/accounts"
            className="flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Manage accounts</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Transactions</CardTitle>
          <CardDescription>
            Track spending to see your monthly baseline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/transactions"
            className="flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Manage transactions</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Your Partnership</CardTitle>
          <CardDescription>
            Share your invite code to connect with your partner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">You</p>
            <p className="text-sm font-medium">{me?.user.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{me?.user.email}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Partner</p>
            {partner ? (
              <>
                <p className="text-sm font-medium">{partner.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {partner.user.email}
                </p>
              </>
            ) : (
              <p className="text-sm text-amber-700 font-medium">
                Not joined yet
              </p>
            )}
          </div>

          <div className="pt-2 border-t space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Invite code</p>
            <CopyInviteCode code={partnership.inviteCode} />
            <p className="text-xs text-muted-foreground">
              Share this code with your partner when they sign up.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
