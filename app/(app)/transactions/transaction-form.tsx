"use client";

import { useRef, useState, useTransition } from "react";
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
import type { Transaction } from "@/app/generated/prisma/client";

const TRANSACTION_CATEGORIES = [
  "Housing",
  "Groceries + Dining",
  "Transport",
  "Kids",
  "Fun + Entertainment",
  "Personal Care",
  "Health",
  "Shopping",
  "Subscriptions",
  "Insurance",
  "Other",
] as const;

interface TransactionFormProps {
  transaction?: Transaction & { account?: { name: string } | null };
  trigger: React.ReactNode;
  accounts: { id: string; name: string }[];
  partnerId?: string;
  partnerName?: string;
  currentUserId: string;
}

export function TransactionForm({
  transaction,
  trigger,
  accounts,
  partnerId,
  partnerName,
  currentUserId,
}: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [forPartner, setForPartner] = useState(
    transaction ? transaction.userId !== currentUserId : false
  );
  const [category, setCategory] = useState(transaction?.category ?? "");
  const [accountId, setAccountId] = useState(transaction?.accountId ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  const dateDefault = transaction
    ? transaction.date.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("category", category);
    formData.set("accountId", accountId);
    formData.set("forPartner", forPartner ? "true" : "false");
    formData.set("partnerId", partnerId ?? "");

    startTransition(async () => {
      const result = transaction
        ? await updateTransaction(transaction.id, formData)
        : await createTransaction(formData);

      if (result && "error" in result) {
        setError(result.error ?? null);
      } else {
        setOpen(false);
        formRef.current?.reset();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement}></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}
        <form key={transaction?.id || "create"} ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {!transaction && partnerId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forPartner"
                checked={forPartner}
                onChange={(e) => setForPartner(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300"
              />
              <Label htmlFor="forPartner" className="font-normal cursor-pointer">
                This is {partnerName ?? "your partner"}&apos;s expense
              </Label>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              placeholder="e.g. Weekly groceries"
              defaultValue={transaction?.description ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              defaultValue={transaction?.amount}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={dateDefault}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant">
              Merchant <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="merchant"
              name="merchant"
              placeholder="e.g. Trader Joe's"
              defaultValue={transaction?.merchant ?? ""}
            />
          </div>
          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Account <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : transaction ? "Save changes" : "Add transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
