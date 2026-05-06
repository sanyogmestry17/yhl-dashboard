"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts"
import { GoKwikRow } from "@/lib/types"
import { format } from "date-fns"

interface Props {
  rows: GoKwikRow[]
}

export default function TrendChart({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        Upload GoKwik CSV to see CVR trend
      </div>
    )
  }

  const data = rows.map((r) => ({
    date: format(new Date(r.date), "dd MMM"),
    CVR: r.conversionPct,
    Started: r.checkoutStarted,
    Converted: r.sessionsConverted,
  }))

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">CVR Trend (Checkout Conversion %)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} />
          <YAxis
            yAxisId="pct"
            unit="%"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            domain={[0, "auto"]}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
          />
          <Tooltip
            formatter={(val, name) =>
              name === "CVR"
                ? [`${Number(val).toFixed(2)}%`, "Checkout CVR"]
                : [Number(val).toLocaleString("en-IN"), String(name)]
            }
          />
          <Legend />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="CVR"
            stroke="#bf0426"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="Started"
            stroke="#d1d5db"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 4"
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="Converted"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
