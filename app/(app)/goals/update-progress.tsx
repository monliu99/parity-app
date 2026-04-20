"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateGoalProgress, addGoalContribution } from "./actions";
import type { Account } from "@/app/generated/prisma/client";

interface GoalAllocation {
  userId: string;
  percentage: number;
}

interface UpdateProgressProps {
  goalId: string;
  currentAmount: number;
  isJoint: boolean;
  accounts: Account[];
  currentUserId: string;
  goalAllocations?: GoalAllocation[];
}

export function UpdateProgress({
  goalId,
  currentAmount,
  isJoint,
  accounts,
  currentUserId,
  goalAllocations = [],
}: UpdateProgressProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const amount = parseFloat(value);
    if (isNaN(amount) || amount <= 0) return;

    if (isJoint) {
      startTransition(async () => {
        await addGoalContribution(goalId, amount, accountId);
        setEditing(false);
        setValue("");
      });
    } else {
      startTransition(async () => {
        await updateGoalProgress(goalId, currentAmount + amount);
        setEditing(false);
        setValue("");
      });
    }
  }

  if (!editing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
        className="text-xs"
      >
        Add progress
      </Button>
    );
  }

  // Helper to get account ownership label
  const getAccountLabel = (account: Account) => {
    if ((account as any).userId === null) return "Joint";
    if ((account as any).userId === currentUserId) return "Mine";
    return "Partner's";
  };

  // Get split hint based on selected account and goal allocations
  const getSplitHint = () => {
    if (!isJoint || !accountId) return null;
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return null;

    if ((account as any).userId === null) {
      // Joint account: split according to goal allocations
      if (goalAllocations.length === 2) {
        const myAlloc = goalAllocations.find((a) => a.userId === currentUserId)?.percentage ?? 50;
        const partnerAlloc = goalAllocations.find((a) => a.userId !== currentUserId)?.percentage ?? 50;
        return `Split: ${myAlloc}% you / ${partnerAlloc}% partner`;
      }
      return "Split: 50/50";
    }
    if ((account as any).userId === currentUserId) return "Credit: 100% you";
    return "Credit: 100% partner";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="Amount"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-24 text-sm"
          autoFocus
        />
        {isJoint && (
          <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
            <SelectTrigger className="h-7 w-auto text-xs min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name} ({getAccountLabel(a)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button size="sm" onClick={handleSave} disabled={isPending} className="h-7 text-xs">
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
      </div>
      {isJoint && accountId && (
        <p className="text-xs text-muted-foreground">{getSplitHint()}</p>
      )}
    </div>
  );
}
