"use client"

import { DashboardFilters } from "@/lib/types"

interface Props {
  filters: DashboardFilters
  onChange: (f: DashboardFilters) => void
  onApply: () => void
  loading: boolean
}

export default function Filters({ filters, onChange, onApply, loading }: Props) {
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">From</label>
        <input
          type="date"
          value={filters.dateRange.from}
          onChange={(e) => set({ dateRange: { ...filters.dateRange, from: e.target.value } })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">To</label>
        <input
          type="date"
          value={filters.dateRange.to}
          onChange={(e) => set({ dateRange: { ...filters.dateRange, to: e.target.value } })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Channel</label>
        <select
          value={filters.channel}
          onChange={(e) => set({ channel: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="all">All Channels</option>
          <option value="web">Web</option>
          <option value="app">App</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Product Type</label>
        <select
          value={filters.productType}
          onChange={(e) => set({ productType: e.target.value as DashboardFilters["productType"] })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="all">All Products</option>
          <option value="single">Single Products</option>
          <option value="stack">Stacks / Bundles</option>
        </select>
      </div>

      <div className="flex items-center gap-2 pb-2">
        <input
          id="decompose"
          type="checkbox"
          checked={filters.showStackDecomposed}
          onChange={(e) => set({ showStackDecomposed: e.target.checked })}
          className="accent-brand-600 w-4 h-4"
        />
        <label htmlFor="decompose" className="text-sm text-gray-600 cursor-pointer">
          Show individual products from stacks
        </label>
      </div>

      <button
        onClick={onApply}
        disabled={loading}
        className="pb-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Loading…" : "Apply"}
      </button>
    </div>
  )
}
