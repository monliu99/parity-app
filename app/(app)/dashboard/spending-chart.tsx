"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CATEGORY_CHART_COLORS, DEFAULT_CHART_COLOR } from "@/lib/category-colors";

interface SpendingChartProps {
  data: Record<string, number>;
}

export function SpendingChart({ data }: SpendingChartProps) {
  const chartData = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([category, amount]) => ({ category, amount }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="category"
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
          formatter={(value) =>
            typeof value === "number"
              ? new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                }).format(value)
              : String(value)
          }
          cursor={{ fill: "oklch(0.515 0.092 155 / 0.06)" }}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={CATEGORY_CHART_COLORS[entry.category] ?? DEFAULT_CHART_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
