"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { CATEGORY_CHART_COLORS, DEFAULT_CHART_COLOR } from "@/lib/category-colors";

export interface MonthComparisonRow {
  category: string;
  thisMonth: number;
  lastMonth: number;
}

interface SpendingTrendsChartProps {
  data: MonthComparisonRow[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

export function SpendingTrendsChart({ data }: SpendingTrendsChartProps) {
  const hasData = data.some((row) => row.thisMonth > 0 || row.lastMonth > 0);
  if (!hasData) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        barCategoryGap="20%"
      >
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`
          }
        />
        <Tooltip
          formatter={(value, name) => [
            typeof value === "number" ? formatCurrency(value) : value,
            name === "thisMonth" ? "This month" : "Last month",
          ]}
          cursor={{ fill: "oklch(0.515 0.092 155 / 0.06)" }}
          contentStyle={{
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        />
        <Legend
          formatter={(value) => (value === "thisMonth" ? "This month" : "Last month")}
          iconType="circle"
          wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
        />
        <Bar
          dataKey="lastMonth"
          fill="#cbd5e1"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="thisMonth"
          radius={[4, 4, 0, 0]}
        >
          {data.map((row) => (
            <Cell
              key={row.category}
              fill={CATEGORY_CHART_COLORS[row.category] || DEFAULT_CHART_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
