"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";

interface SettlementCardProps {
  netAmount: number;       // positive = partner owes you, negative = you owe partner
  partnerName: string;
  jointCount: number;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Math.abs(n));
}

interface PayModalProps {
  service: "Zelle" | "Venmo";
  partnerName: string;
  amount: number;
  youOwe: boolean;
  onClose: () => void;
}

function PayModal({ service, partnerName, amount, youOwe, onClose }: PayModalProps) {
  const serviceUrl = service === "Zelle" ? "https://enroll.zellepay.com/" : "https://venmo.com/";
  const verb = youOwe ? `Send ${partnerName}` : `Request from ${partnerName}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              {service}
            </p>
            <p className="text-sm font-bold mt-0.5">
              {verb} {formatCurrency(amount)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          {service} integration is coming soon. For now, open {service} and{" "}
          {youOwe
            ? `send ${partnerName} ${formatCurrency(amount)} to settle your balance.`
            : `request ${formatCurrency(amount)} from ${partnerName}.`}
        </p>

        <a
          href={serviceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Open {service}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export function SettlementCard({ netAmount, partnerName, jointCount }: SettlementCardProps) {
  const [payModal, setPayModal] = useState<"Zelle" | "Venmo" | null>(null);
  const settled = Math.abs(netAmount) < 1;
  const youOwe = netAmount < 0;

  return (
    <>
      <Card className="shadow-card">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
            Settlement · Last 30 Days
          </p>

          {settled ? (
            <p className="text-sm font-medium text-foreground">
              You&apos;re settled up — no balance between you.
            </p>
          ) : (
            <>
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  {youOwe ? `You owe ${partnerName}` : `${partnerName} owes you`}
                </p>
                <p className="text-3xl font-bold tabular-nums text-foreground leading-none mt-0.5">
                  {formatCurrency(netAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {jointCount} joint expense{jointCount !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPayModal("Zelle")}
                  className="cursor-pointer text-xs"
                >
                  Pay with Zelle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPayModal("Venmo")}
                  className="cursor-pointer text-xs"
                >
                  Pay with Venmo
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {payModal && (
        <PayModal
          service={payModal}
          partnerName={partnerName}
          amount={netAmount}
          youOwe={youOwe}
          onClose={() => setPayModal(null)}
        />
      )}
    </>
  );
}
