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
import { createAccount, updateAccount } from "./actions";
import type { Account } from "@/app/generated/prisma/client";

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Checking" },
  { value: "SAVINGS", label: "Savings" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "RETIREMENT", label: "Retirement (401k/IRA)" },
  { value: "CREDIT", label: "Credit Card" },
  { value: "OTHER", label: "Other" },
];

interface AccountFormProps {
  account?: Account;
  trigger: React.ReactNode;
  partnerId?: string;
  partnerName?: string;
}

export function AccountForm({ account, trigger, partnerId, partnerName }: AccountFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [forPartner, setForPartner] = useState(false);
  const [accountType, setAccountType] = useState(account?.type ?? "CHECKING");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("type", accountType);
    formData.set("forPartner", forPartner ? "true" : "false");
    formData.set("partnerId", partnerId ?? "");

    startTransition(async () => {
      const result = account
        ? await updateAccount(account.id, formData)
        : await createAccount(formData);

      if (result && "error" in result) {
        setError(result.error);
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
          <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}
        <form key={account?.id || "create"} ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {!account && partnerId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="forPartner"
                checked={forPartner}
                onChange={(e) => setForPartner(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="forPartner" className="font-normal cursor-pointer">
                This is {partnerName ?? "your partner"}&apos;s account
              </Label>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Account name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Chase Checking"
              defaultValue={account?.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Account type</Label>
            <Select value={accountType} onValueChange={(v) => v && setAccountType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="balance">Current balance ($)</Label>
            <Input
              id="balance"
              name="balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              defaultValue={account?.balance}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="institution">
              Institution{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="institution"
              name="institution"
              placeholder="e.g. Chase, Fidelity"
              defaultValue={account?.institution ?? ""}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : account ? "Save changes" : "Add account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
