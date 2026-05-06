"use client"

import { KPIData } from "@/lib/types"

const fmt = (n: number) => n.toLocaleString("en-IN")
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
const fmtPct = (n: number) => `${n.toFixed(2)}%`

interface CardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  dim?: boolean
}

function Card({ label, value, sub, highlight, dim }: CardProps) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        highlight
          ? "bg-brand-50 border-brand-200"
          : dim
          ? "bg-gray-50 border-gray-200 opacity-60"
          : "bg-white border-gray-200"
      }`}
    >
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${highlight ? "text-brand-700" : "text-gray-900"}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

interface SectionProps {
  title: string
  badge?: string
  children: React.ReactNode
}

function Section({ title, badge, children }: SectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {badge && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{children}</div>
    </div>
  )
}

export default function KPICards({ kpi, hasGoKwik }: { kpi: KPIData; hasGoKwik: boolean }) {
  const addressDropPct =
    kpi.checkoutStarted > 0 ? ((kpi.checkoutStarted - kpi.addressLanded) / kpi.checkoutStarted) * 100 : 0
  const payDropPct =
    kpi.addressLanded > 0 ? ((kpi.addressLanded - kpi.paymentStepReached) / kpi.addressLanded) * 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <Section title="GoKwik Checkout Funnel" badge={hasGoKwik ? "live" : "upload CSV to populate"}>
        <Card
          label="Checkout Started"
          value={hasGoKwik ? fmt(kpi.checkoutStarted) : "—"}
          sub="top of funnel"
        />
        <Card
          label="Address Landed"
          value={hasGoKwik ? fmt(kpi.addressLanded) : "—"}
          sub={hasGoKwik ? `${fmtPct(addressDropPct)} drop` : undefined}
          dim={!hasGoKwik}
        />
        <Card
          label="Payment Step"
          value={hasGoKwik ? fmt(kpi.paymentStepReached) : "—"}
          sub={hasGoKwik ? `${fmtPct(payDropPct)} drop` : undefined}
          dim={!hasGoKwik}
        />
        <Card
          label="Payment Selected"
          value={hasGoKwik ? fmt(kpi.paymentMethodSelected) : "—"}
          dim={!hasGoKwik}
        />
        <Card
          label="Converted"
          value={hasGoKwik ? fmt(kpi.sessionsConverted) : "—"}
          sub="checkout completed"
          highlight={hasGoKwik}
          dim={!hasGoKwik}
        />
        <Card
          label="Checkout CVR"
          value={hasGoKwik ? fmtPct(kpi.checkoutCVR) : "—"}
          sub="converted / started"
          highlight={hasGoKwik}
          dim={!hasGoKwik}
        />
      </Section>

      <Section title="Shopify" badge="via API">
        <Card label="Total Orders" value={fmt(kpi.totalOrders)} />
        <Card label="Revenue" value={fmtCurrency(kpi.revenue)} highlight />
        <Card
          label="Add to Cart"
          value={kpi.atc > 0 ? fmt(kpi.atc) : "—"}
          sub={kpi.atc === 0 ? "needs Shopify Analytics" : undefined}
          dim={kpi.atc === 0}
        />
        <Card
          label="Site CVR"
          value={kpi.siteCVR > 0 ? fmtPct(kpi.siteCVR) : "—"}
          sub="orders / sessions"
          dim={kpi.siteCVR === 0}
        />
        <Card label="Stack Orders" value={fmt(kpi.stackOrders)} sub="contain a stack/bundle" />
        <Card label="Single Orders" value={fmt(kpi.singleOrders)} sub="no stack items" />
      </Section>
    </div>
  )
}
