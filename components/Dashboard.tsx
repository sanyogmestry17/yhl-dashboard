"use client"

import { useState, useCallback } from "react"
import { GoKwikRow, ProcessedOrder, KPIData, ProductSalesRow, DashboardFilters, AnalyticsData } from "@/lib/types"
import { filterGoKwikByDateRange, aggregateGoKwik } from "@/lib/gokwik"
import KPICards from "./KPICards"
import FunnelChart from "./FunnelChart"
import TrendChart from "./TrendChart"
import ProductTable from "./ProductTable"
import GoKwikUpload from "./GoKwikUpload"
import Filters from "./Filters"

const DEFAULT_FILTERS: DashboardFilters = {
  dateRange: { from: "2026-04-15", to: "2026-05-04" },
  channel: "all",
  productType: "all",
  showStackDecomposed: false,
}

function buildProductRows(orders: ProcessedOrder[]): ProductSalesRow[] {
  const map = new Map<string, ProductSalesRow>()
  for (const order of orders) {
    for (const item of order.items) {
      const existing = map.get(item.title)
      if (existing) {
        existing.unitsSold += item.quantity
        existing.revenue += item.price * item.quantity
        existing.orderCount += 1
        for (const d of item.decomposed) {
          const found = existing.decomposed.find((x) => x.title === d.title)
          if (found) found.quantity += d.quantity
          else existing.decomposed.push({ ...d })
        }
      } else {
        map.set(item.title, {
          title: item.title,
          isStack: item.isStack,
          unitsSold: item.quantity,
          revenue: item.price * item.quantity,
          orderCount: 1,
          decomposed: item.decomposed.map((d) => ({ ...d })),
        })
      }
    }
  }
  return Array.from(map.values())
}

function buildKPI(rows: GoKwikRow[], orders: ProcessedOrder[], analytics: AnalyticsData[]): KPIData {
  const gk = aggregateGoKwik(rows)
  const totalOrders = orders.length
  const revenue = orders.reduce((s, o) => s + o.revenue, 0)
  const atc = analytics.reduce((s, a) => s + a.atc, 0)
  const sessions = analytics.reduce((s, a) => s + a.sessions, 0)
  return {
    ...gk,
    totalOrders,
    revenue,
    atc,
    sessions,
    siteCVR: sessions > 0 ? (totalOrders / sessions) * 100 : 0,
    stackOrders: orders.filter((o) => o.hasStack).length,
    singleOrders: orders.filter((o) => !o.hasStack).length,
  }
}

export default function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [allGoKwikRows, setAllGoKwikRows] = useState<GoKwikRow[]>([])
  const [orders, setOrders] = useState<ProcessedOrder[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [shopifyError, setShopifyError] = useState("")
  const [syncMsg, setSyncMsg] = useState("")
  const [lastSource, setLastSource] = useState<"db" | "live" | "">("")

  const fetchShopify = useCallback(async (f: DashboardFilters) => {
    setLoading(true)
    setShopifyError("")
    try {
      const [ordersRes, analyticsRes] = await Promise.all([
        fetch(`/api/shopify/orders?from=${f.dateRange.from}&to=${f.dateRange.to}`),
        fetch(`/api/shopify/analytics?from=${f.dateRange.from}&to=${f.dateRange.to}`),
      ])
      const ordersJson = await ordersRes.json()
      if (!ordersRes.ok) setShopifyError(ordersJson.error ?? "Orders fetch failed")
      else {
        setOrders(ordersJson.orders ?? [])
        setLastSource(ordersJson.source ?? "")
      }
      const analyticsJson = await analyticsRes.json()
      setAnalytics(analyticsJson.analytics ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const triggerSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg("")
    try {
      const res = await fetch("/api/sync", { method: "POST" })
      const json = await res.json()
      if (json.ok) {
        setSyncMsg(`Synced ${json.orders} orders (${json.from} → ${json.to})`)
        fetchShopify(filters)
      } else {
        setSyncMsg(`Sync failed: ${json.error}`)
      }
    } finally {
      setSyncing(false)
    }
  }, [filters, fetchShopify])

  const filteredGoKwik = filterGoKwikByDateRange(
    filters.channel === "all"
      ? allGoKwikRows
      : allGoKwikRows.filter((r) => r.salesChannel === filters.channel),
    filters.dateRange.from,
    filters.dateRange.to
  )

  const filteredOrders = orders.filter((o) => {
    if (filters.productType === "stack") return o.hasStack
    if (filters.productType === "single") return !o.hasStack
    return true
  })

  const kpi = buildKPI(filteredGoKwik, filteredOrders, analytics)
  const productRows = buildProductRows(filteredOrders)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Your Happy Life</h1>
          <p className="text-xs text-gray-400">Analytics Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          {lastSource === "db" && (
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
              data from DB
            </span>
          )}
          {syncMsg && (
            <span className={`text-xs px-2 py-1 rounded ${syncMsg.includes("failed") ? "text-red-500 bg-red-50" : "text-green-700 bg-green-50"}`}>
              {syncMsg}
            </span>
          )}
          {shopifyError && (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
              {shopifyError}
            </span>
          )}
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <Filters
            filters={filters}
            onChange={setFilters}
            onApply={() => fetchShopify(filters)}
            loading={loading}
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <KPICards kpi={kpi} hasGoKwik={filteredGoKwik.length > 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <FunnelChart rows={filteredGoKwik} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <GoKwikUpload onData={setAllGoKwikRows} rowCount={allGoKwikRows.length} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <TrendChart rows={filteredGoKwik} />
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <ProductTable
            rows={productRows}
            showDecomposed={filters.showStackDecomposed}
            productTypeFilter={filters.productType}
          />
        </div>
      </main>
    </div>
  )
}
