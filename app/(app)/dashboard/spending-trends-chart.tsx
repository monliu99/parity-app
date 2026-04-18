"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CATEGORY_CHART_COLORS } from "@/lib/category-colors";

export interface MonthlySpendingData {
  month: string;
  [category: string]: string | number;
}

interface SpendingTrendsChartProps {
  data: MonthlySpendingData[];
  categories: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  HOUSING: "Housing",
  GROCERIES: "Groceries",
  DINING: "Dining Out",
  TRANSPORT: "Transport",
  SHOPPING: "Shopping",
  ENTERTAINMENT: "Entertainment",
  UTILITIES: "Utilities",
  HEALTHCARE: "Healthcare",
  INSURANCE: "Insurance",
  OTHER: "Other",
};

export function SpendingTrendsChart({ data, categories }: SpendingTrendsChartProps) {
  // Sort categories by total spending across all months (descending)
  const categoryTotals: Record<string, number> = {};
  for (const category of categories) {
    for (const month of data) {
      categoryTotals[category] = (categoryTotals[category] || 0) + (month[category] as number || 0);
    }
  }
  const sortedCategories = categories.sort((a, b) => (categoryTotals[b] || 0) - (categoryTotals[a] || 0));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
          }
        />
        <Tooltip
          formatter={(value, name) => {
            const label = CATEGORY_LABELS[name as string] || name;
            return [
              typeof value === "number"
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                  }).format(value)
                : value,
              label,
            ];
          }}
          cursor={{ fill: "oklch(0.515 0.092 155 / 0.06)" }}
          contentStyle={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        />
        {sortedCategories.map((category) => (
          <Area
            key={category}
            type="monotone"
            dataKey={category}
            stackId="1"
            stroke={CATEGORY_CHART_COLORS[category] || "#888"}
            fill={CATEGORY_CHART_COLORS[category] || "#888"}
            fillOpacity={0.7}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
