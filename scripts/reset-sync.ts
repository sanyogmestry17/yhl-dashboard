#!/usr/bin/env tsx
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

import { createClient } from "@supabase/supabase-js"
import { fetchOrders, fetchAnalytics, toISTDate } from "../lib/shopify"
import { isStackProduct } from "../lib/stack-config"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function resetAndSync() {
  const from = "2026-04-01"
  const to = toDateStr(new Date())
  const now = new Date().toISOString()

  console.log(`[reset-sync] Clearing all tables…`)

  // order of deletion respects FK constraints
  await supabase.from("refunds").delete().neq("id", 0)
  await supabase.from("line_items").delete().neq("id", 0)
  await supabase.from("analytics_daily").delete().neq("date", "")
  await supabase.from("sync_log").delete().neq("id", 0)
  await supabase.from("orders").delete().neq("id", 0)

  console.log(`[reset-sync] Tables cleared. Syncing ${from} → ${to}`)

  const { data: logRow } = await supabase
    .from("sync_log")
    .insert({ started_at: now, from_date: from, to_date: to, status: "running" })
    .select("id")
    .single()
  const logId = logRow?.id

  try {
    console.log("[reset-sync] Fetching orders…")
    const rawOrders = await fetchOrders(from, to)
    console.log(`[reset-sync] ${rawOrders.length} orders fetched`)

    const orderRows = rawOrders.map((o) => ({
      id: o.id,
      created_at: o.created_at,
      date: toISTDate(o.created_at),
      financial_status: o.financial_status ?? "",
      total_price: parseFloat(o.current_total_price ?? o.total_price ?? "0"),
      has_stack: (o.line_items ?? []).some((li) => isStackProduct(li.title)),
      raw_json: o,
    }))

    for (let i = 0; i < orderRows.length; i += 500) {
      const { error } = await supabase
        .from("orders")
        .upsert(orderRows.slice(i, i + 500), { onConflict: "id" })
      if (error) throw new Error(`orders upsert: ${error.message}`)
    }
    console.log(`[reset-sync] ${orderRows.length} orders stored`)

    const liRows = rawOrders.flatMap((o) =>
      (o.line_items ?? []).map((li) => ({
        order_id: o.id,
        product_id: li.product_id ?? null,
        title: li.title ?? "",
        quantity: li.quantity ?? 1,
        price: parseFloat(li.price ?? "0"),
        is_stack: isStackProduct(li.title),
        sku: li.sku ?? "",
      }))
    )
    for (let i = 0; i < liRows.length; i += 500) {
      await supabase.from("line_items").insert(liRows.slice(i, i + 500))
    }
    console.log(`[reset-sync] ${liRows.length} line items stored`)

    // Extract refunds by IST refund date
    const refundRows = rawOrders.flatMap((o) =>
      (o.refunds ?? []).flatMap((r) => {
        const date = toISTDate(r.created_at)
        const amount = (r.transactions ?? [])
          .filter((t) => t.kind === "refund" && t.status === "success")
          .reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0)
        if (amount === 0) return []
        return [{ order_id: o.id, refund_date: date, amount }]
      })
    )
    if (refundRows.length > 0) {
      for (let i = 0; i < refundRows.length; i += 500) {
        await supabase.from("refunds").insert(refundRows.slice(i, i + 500))
      }
      console.log(`[reset-sync] ${refundRows.length} refund rows stored`)
    } else {
      console.log("[reset-sync] No refunds found")
    }

    console.log("[reset-sync] Fetching analytics…")
    let analyticsCount = 0
    try {
      const analyticsRows = await fetchAnalytics(from, to)
      if (analyticsRows.length > 0) {
        await supabase
          .from("analytics_daily")
          .upsert(analyticsRows.map((r) => ({ ...r, synced_at: now })), { onConflict: "date" })
        analyticsCount = analyticsRows.length
      }
    } catch (e) {
      console.warn("[reset-sync] analytics skipped:", (e as Error).message)
    }

    await supabase
      .from("sync_log")
      .update({ completed_at: new Date().toISOString(), orders_fetched: rawOrders.length, status: "success" })
      .eq("id", logId)

    console.log(`[reset-sync] Done — ${rawOrders.length} orders, ${refundRows.length} refunds, ${analyticsCount} analytics days`)
  } catch (err) {
    const msg = (err as Error).message
    console.error("[reset-sync] FAILED:", msg)
    await supabase
      .from("sync_log")
      .update({ completed_at: new Date().toISOString(), status: "error", error: msg })
      .eq("id", logId)
    process.exit(1)
  }
}

resetAndSync()
