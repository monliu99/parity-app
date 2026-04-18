"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { updateAccountBalance } from "./actions";

interface EditableBalanceProps {
  accountId: string;
  balance: number;
}

export function EditableBalance({ accountId, balance }: EditableBalanceProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(balance.toString());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function handleStartEdit() {
    setValue(balance.toString());
    setIsEditing(true);
    setError(null);
  }

  function handleCancel() {
    setValue(balance.toString());
    setIsEditing(false);
    setError(null);
  }

  function handleSave() {
    const newBalance = parseFloat(value);
    if (isNaN(newBalance)) {
      setError("Invalid amount");
      return;
    }

    startTransition(async () => {
      const result = await updateAccountBalance(accountId, newBalance);
      if (result && "error" in result) {
        setError(result.error ?? null);
      } else {
        setIsEditing(false);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSave();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      handleCancel();
      e.currentTarget.blur();
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-7 w-24 text-sm tabular-nums px-2"
          autoFocus
          disabled={isPending}
        />
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={handleCancel}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            disabled={isPending}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="text-sm font-semibold tabular-nums hover:text-primary transition-colors text-left cursor-pointer rounded px-1 -mx-1"
      title="Click to edit balance"
    >
      {formatCurrency(balance)}
    </button>
  );
}
