"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { upsertFixedCost, deleteFixedCost, upsertVariableEstimate } from "./actions";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

interface FixedRow {
  id: string;
  category: string;
  amount: number;
  notes?: string;
}

interface BudgetEditorProps {
  fixed: FixedRow[];
  variableCategories: string[];
  variableEstimates: Record<string, number>;
  monthlyBaseline: number;
}

function InlineAmountInput({
  initialValue,
  onSave,
  placeholder = "0",
}: {
  initialValue: number | null;
  onSave: (amount: number) => Promise<void>;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function handleBlur() {
    const n = parseFloat(value);
    if (!isNaN(n) && n >= 0) {
      startTransition(async () => {
        await onSave(n);
        setEditing(false);
      });
    } else {
      setValue(initialValue?.toString() ?? "");
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <Input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setValue(initialValue?.toString() ?? ""); setEditing(false); }
        }}
        className="h-7 w-24 text-sm tabular-nums px-2"
        autoFocus
        disabled={pending}
      />
    );
  }

  return (
    <button
      onClick={() => { setValue(initialValue?.toString() ?? ""); setEditing(true); }}
      className="text-sm font-semibold tabular-nums hover:text-primary transition-colors cursor-pointer rounded px-1 -mx-1 min-w-[4rem] text-right"
      title="Click to edit"
    >
      {initialValue !== null ? fmt(initialValue) : <span className="text-muted-foreground font-normal">{placeholder}</span>}
    </button>
  );
}

function AddFixedCostRow({ onAdd }: { onAdd: (category: string, amount: number) => Promise<void> }) {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!category.trim() || isNaN(n) || n < 0) return;
    startTransition(async () => {
      await onAdd(category.trim(), n);
      setCategory("");
      setAmount("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center mt-2">
      <Input
        placeholder="Category (e.g. Rent)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="flex-1 h-8 text-sm"
        disabled={pending}
      />
      <Input
        type="number"
        min="0"
        step="1"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-28 h-8 text-sm"
        disabled={pending}
      />
      <Button type="submit" size="sm" disabled={pending || !category.trim() || !amount}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}

export function BudgetEditor({
  fixed,
  variableCategories,
  variableEstimates,
  monthlyBaseline,
}: BudgetEditorProps) {
  const [, startTransition] = useTransition();
  const [income, setIncome] = useState("");

  const incomeNum = parseFloat(income);
  const hasIncome = !isNaN(incomeNum) && incomeNum > 0;
  const availableForSavings = hasIncome ? incomeNum - monthlyBaseline : null;

  async function handleSaveFixed(category: string, amount: number) {
    await upsertFixedCost(category, amount);
  }

  async function handleAddFixed(category: string, amount: number) {
    await upsertFixedCost(category, amount);
  }

  async function handleDeleteFixed(id: string) {
    startTransition(async () => {
      await deleteFixedCost(id);
    });
  }

  async function handleSaveVariable(category: string, amount: number) {
    await upsertVariableEstimate(category, amount);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Budget</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What does your life cost each month?
        </p>
      </div>

      {/* Headline */}
      {monthlyBaseline > 0 && (
        <Card className="shadow-card bg-primary/5 border-primary/10">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Monthly baseline</p>
            <p className="text-3xl font-bold tabular-nums">{fmt(monthlyBaseline)}<span className="text-base font-normal text-muted-foreground">/mo</span></p>
            <p className="text-xs text-muted-foreground mt-1">Your estimated cost of life together.</p>

            {/* Income + savings line */}
            <div className="mt-4 pt-4 border-t border-primary/10 flex items-center gap-3">
              <p className="text-xs text-muted-foreground shrink-0">Combined income</p>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 12000"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  className="h-8 w-36 text-sm pl-6 tabular-nums"
                />
              </div>
              {availableForSavings !== null && (
                <p className={`text-sm font-semibold tabular-nums ${availableForSavings >= 0 ? "text-emerald-600" : "text-amber-700"}`}>
                  {availableForSavings >= 0 ? `${fmt(availableForSavings)} for savings` : `${fmt(Math.abs(availableForSavings))} over budget`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fixed costs */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div>
            <p className="text-sm font-semibold">Fixed costs</p>
            <p className="text-xs text-muted-foreground mt-0.5">Rent, insurance, subscriptions, childcare — costs that don&apos;t change much.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {fixed.length === 0 && (
            <p className="text-sm text-muted-foreground py-1">No fixed costs yet.</p>
          )}
          {fixed.map((row) => (
            <div key={row.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 group">
              <span className="text-sm">{row.category}</span>
              <div className="flex items-center gap-3">
                <InlineAmountInput
                  initialValue={row.amount}
                  onSave={(amount) => handleSaveFixed(row.category, amount)}
                />
                <button
                  onClick={() => handleDeleteFixed(row.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <AddFixedCostRow onAdd={handleAddFixed} />
        </CardContent>
      </Card>

      {/* Variable estimates */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div>
            <p className="text-sm font-semibold">Variable estimates</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your best guess at monthly spending across categories.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            {variableCategories.map((cat) => {
              const amt = variableEstimates[cat] ?? null;
              return (
                <div
                  key={cat}
                  className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/30"
                >
                  <span className="text-sm">{cat}</span>
                  <InlineAmountInput
                    initialValue={amt}
                    onSave={(amount) => handleSaveVariable(cat, amount)}
                    placeholder="—"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
