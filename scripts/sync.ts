#!/usr/bin/env tsx
import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.join(process.cwd(), ".env.local") })

// import after dotenv so env vars are loaded
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

async function sync() {
  const now = new Date().toISOString()
  // SYNC_FROM / SYNC_TO in .env.local override everything
  const from = process.env.SYNC_FROM ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() - parseInt(process.env.SYNC_DAYS_BACK ?? "90"))
    return toDateStr(d)
  })()
  const to = process.env.SYNC_TO ?? toDateStr(new Date())

  console.log(`[sync] ${now} | ${from} → ${to}`)

  const { data: logRow } = await supabase
    .from("sync_log")
    .insert({ started_at: now, from_date: from, to_date: to, status: "running" })
    .select("id")
    .single()
  const logId = logRow?.id

  try {
    console.log("[sync] fetching orders…")
    const rawOrders = await fetchOrders(from, to)
    console.log(`[sync] ${rawOrders.length} orders`)

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
    await supabase.from("line_items").delete().in("order_id", rawOrders.map((o) => o.id))
    for (let i = 0; i < liRows.length; i += 500) {
      await supabase.from("line_items").insert(liRows.slice(i, i + 500))
    }

    // Extract refunds — each refund transaction stored by IST refund date
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
      await supabase.from("refunds").delete().in("order_id", rawOrders.map((o) => o.id))
      for (let i = 0; i < refundRows.length; i += 500) {
        await supabase.from("refunds").insert(refundRows.slice(i, i + 500))
      }
      console.log(`[sync] ${refundRows.length} refund rows`)
    }

    console.log("[sync] fetching analytics…")
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
      console.warn("[sync] analytics skipped:", (e as Error).message)
    }

    await supabase
      .from("sync_log")
      .update({ completed_at: new Date().toISOString(), orders_fetched: rawOrders.length, status: "success" })
      .eq("id", logId)

    console.log(`[sync] done — ${rawOrders.length} orders, ${analyticsCount} analytics days`)
  } catch (err) {
    const msg = (err as Error).message
    console.error("[sync] FAILED:", msg)
    await supabase
      .from("sync_log")
      .update({ completed_at: new Date().toISOString(), status: "error", error: msg })
      .eq("id", logId)
    process.exit(1)
  }
}

sync()
