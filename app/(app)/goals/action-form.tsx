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
import { createActionGoal, updateActionGoal } from "./actions";
import type { Goal } from "@/app/generated/prisma/client";

interface ActionFormProps {
  trigger: React.ReactElement;
  goal?: Goal;
}

export function ActionForm({ trigger, goal }: ActionFormProps) {
  const isEditing = !!goal;
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEditing
        ? await updateActionGoal(goal.id, formData)
        : await createActionGoal(formData);
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
          <DialogTitle>{isEditing ? "Edit action" : "Add action"}</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Action</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. Research neighborhoods, Book Europe trip"
              defaultValue={goal?.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="month">
              Month{" "}
              <span className="text-muted-foreground font-normal">(optional, 1–12)</span>
            </Label>
            <Input
              id="month"
              name="month"
              type="number"
              min="1"
              max="12"
              placeholder="e.g. 3"
              defaultValue={goal?.month ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Any context"
              defaultValue={goal?.notes ?? ""}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEditing ? "Save changes" : "Add action"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
