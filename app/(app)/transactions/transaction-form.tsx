"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTransaction, updateTransaction } from "./actions";
import type { Account, Transaction } from "@/app/generated/prisma/client";

interface TransactionFormProps {
  accounts: Account[];
  trigger: React.ReactElement;
  currentUserId?: string;
  transaction?: Transaction;
}

export function TransactionForm({ accounts, trigger, currentUserId, transaction }: TransactionFormProps) {
  const isEditing = !!transaction;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState(transaction?.ownerLabel ?? "MINE");
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? "");

  const today = new Date().toISOString().split("T")[0];
  const txDate = transaction?.date
    ? new Date(transaction.date).toISOString().split("T")[0]
    : today;

  // Helper to get account ownership label
  const getAccountLabel = (account: Account) => {
    if ((account as any).userId === null) return "Joint";
    if ((account as any).userId === currentUserId) return "Mine";
    return "Partner's";
  };

  // When account changes, default ownerLabel to JOINT if it's a joint account
  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    const selectedAccount = accounts.find((a) => a.id === newAccountId);
    // Only auto-set ownerLabel for new transactions, not when editing
    if (!isEditing && selectedAccount && (selectedAccount as any).userId === null) {
      setOwnerLabel("JOINT");
    }
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("ownerLabel", ownerLabel);
    formData.set("accountId", accountId);

    startTransition(async () => {
      const result = isEditing
        ? await updateTransaction(transaction.id, formData)
        : await createTransaction(formData);

      if (result && "error" in result) {
        setError(result.error ?? null);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit transaction" : "Add transaction"}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}
        {isPending && !isEditing ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Categorizing with AI…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Whose transaction?</Label>
              <Select
                value={ownerLabel}
                onValueChange={(v) => v && setOwnerLabel(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINE">Mine</SelectItem>
                  <SelectItem value="PARTNER">Partner&apos;s</SelectItem>
                  <SelectItem value="JOINT">Joint</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={accountId}
                onValueChange={(v) => v && handleAccountChange(v)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {accountId
                      ? accounts.find((a) => a.id === accountId)?.name || "Select account"
                      : "Select account"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({getAccountLabel(a)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                name="merchant"
                placeholder="e.g. Whole Foods"
                defaultValue={transaction?.merchant}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={transaction?.amount}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={txDate}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="notes"
                name="notes"
                placeholder="Optional note"
                defaultValue={transaction?.notes ?? ""}
              />
            </div>
            {!isEditing && (
              <p className="text-xs text-muted-foreground">
                Category will be assigned automatically by AI.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (isEditing ? "Saving…" : "Categorizing…") : (isEditing ? "Save changes" : "Add transaction")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
