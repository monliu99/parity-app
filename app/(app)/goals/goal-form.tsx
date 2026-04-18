"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createGoal, updateGoal } from "./actions";
import type { Goal } from "@/app/generated/prisma/client";

interface GoalFormProps {
  trigger: React.ReactElement;
  goal?: Goal;
}

export function GoalForm({ trigger, goal }: GoalFormProps) {
  const isEditing = !!goal;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targetDateValue = goal?.targetDate
    ? new Date(goal.targetDate).toISOString().split("T")[0]
    : "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEditing
        ? await updateGoal(goal.id, formData)
        : await createGoal(formData);

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
          <DialogTitle>{isEditing ? "Edit goal" : "Create goal"}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Goal type</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "JOINT", label: "Joint", desc: "Shared with partner" },
                { value: "PERSONAL", label: "Personal", desc: "Just for me" },
              ].map(({ value, label, desc }) => (
                <label key={value} className="relative flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 has-[:checked]:border-ring has-[:checked]:bg-accent">
                  <input
                    type="radio"
                    name="ownerLabel"
                    value={value}
                    defaultChecked={value === (goal?.ownerLabel ?? "JOINT")}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Goal name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Vacation fund, Emergency fund"
              defaultValue={goal?.name}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="targetAmount">Target ($)</Label>
              <Input
                id="targetAmount"
                name="targetAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="10000"
                defaultValue={goal?.targetAmount}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetDate">
                Target date{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="targetDate"
                name="targetDate"
                type="date"
                defaultValue={targetDateValue}
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
              placeholder="Any notes"
              defaultValue={goal?.notes ?? ""}
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
              {isPending ? "Saving…" : (isEditing ? "Save changes" : "Create goal")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
