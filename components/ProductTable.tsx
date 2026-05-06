"use client"

import React from "react"
import { ProductSalesRow } from "@/lib/types"

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

interface Props {
  rows: ProductSalesRow[]
  showDecomposed: boolean
  productTypeFilter: "all" | "single" | "stack"
}

export default function ProductTable({ rows, showDecomposed, productTypeFilter }: Props) {
  const filtered = rows.filter((r) => {
    if (productTypeFilter === "single") return !r.isStack
    if (productTypeFilter === "stack") return r.isStack
    return true
  })

  const sorted = [...filtered].sort((a, b) => b.revenue - a.revenue)

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        No product data — connect Shopify API
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Product Sales Breakdown</h3>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Product</th>
              <th className="px-4 py-3 text-center font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Units Sold</th>
              <th className="px-4 py-3 text-right font-medium">Orders</th>
              <th className="px-4 py-3 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row) => (
              <React.Fragment key={row.title}>
                <tr className={row.isStack ? "bg-brand-50/40" : "bg-white"}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {row.title}
                    {row.isStack && (
                      <span className="ml-2 text-xs bg-brand-100 text-brand-600 px-1.5 py-0.5 rounded-full">
                        Stack
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {row.isStack ? "Stack / Bundle" : "Single"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.unitsSold.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.orderCount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtCurrency(row.revenue)}</td>
                </tr>
                {showDecomposed && row.isStack && row.decomposed.length > 0 &&
                  row.decomposed.map((d) => (
                    <tr key={`${row.title}-${d.title}`} className="bg-brand-50/20">
                      <td className="px-4 py-2 pl-10 text-gray-500 text-xs">↳ {d.title}</td>
                      <td className="px-4 py-2 text-center text-gray-400 text-xs">from stack</td>
                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{d.quantity.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 text-right text-gray-400 text-xs">—</td>
                      <td className="px-4 py-2 text-right text-gray-400 text-xs">—</td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
