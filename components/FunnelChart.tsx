"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts"
import { GoKwikRow } from "@/lib/types"
import { aggregateGoKwik } from "@/lib/gokwik"

const STEPS = [
  { key: "checkoutStarted", label: "Checkout\nStarted" },
  { key: "addressLanded", label: "Address\nLanded" },
  { key: "paymentStepReached", label: "Payment\nStep" },
  { key: "paymentMethodSelected", label: "Payment\nSelected" },
  { key: "sessionsConverted", label: "Converted" },
]

const COLORS = ["#fad5da", "#f4a8b2", "#eb7a8a", "#de4d61", "#10b981"]

interface Props {
  rows: GoKwikRow[]
}

export default function FunnelChart({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        Upload GoKwik CSV to see funnel
      </div>
    )
  }

  const agg = aggregateGoKwik(rows)
  const data = STEPS.map(({ key, label }, i) => {
    const count = agg[key as keyof typeof agg] as number
    const prev = i === 0 ? count : (agg[STEPS[i - 1].key as keyof typeof agg] as number)
    const dropPct = i === 0 ? 0 : prev > 0 ? ((prev - count) / prev) * 100 : 0
    return { label, count, dropPct, color: COLORS[i] }
  })

  const max = data[0].count

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Checkout Funnel</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 60, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, max]} hide />
          <YAxis
            type="category"
            dataKey="label"
            width={90}
            tick={{ fontSize: 11, fill: "#6b7280" }}
          />
          <Tooltip
            formatter={(val, _name, entry) => [
              `${Number(val).toLocaleString("en-IN")} (${(entry.payload as { dropPct: number }).dropPct > 0 ? `-${(entry.payload as { dropPct: number }).dropPct.toFixed(1)}% from prev` : "top"})`,
              "Count",
            ]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              formatter={(v: unknown) => Number(v).toLocaleString("en-IN")}
              style={{ fontSize: 11, fill: "#374151" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
