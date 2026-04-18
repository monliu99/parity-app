"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateGoalProgress } from "./actions";

export function UpdateProgress({
  goalId,
  currentAmount,
}: {
  goalId: string;
  currentAmount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentAmount.toString());
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const amount = parseFloat(value);
    if (isNaN(amount)) return;
    startTransition(async () => {
      await updateGoalProgress(goalId, amount);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditing(true)}
        className="text-xs"
      >
        Update progress
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-28 text-sm"
        autoFocus
      />
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
  );
}
