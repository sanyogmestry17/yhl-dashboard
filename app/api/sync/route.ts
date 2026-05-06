import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { fetchOrders, fetchAnalytics, toISTDate } from "@/lib/shopify"
import { isStackProduct } from "@/lib/stack-config"

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function resolveRange(bodyFrom?: string, bodyTo?: string) {
  // priority: request body > env vars > default (today - 90d)
  const from = bodyFrom ?? process.env.SYNC_FROM ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return toDateStr(d)
  })()
  const to = bodyTo ?? process.env.SYNC_TO ?? toDateStr(new Date())
  return { from, to }
}

export async function GET() {
  const { data } = await supabase
    .from("sync_log")
    .select("*")
    .order("id", { ascending: false })
    .limit(5)
  return NextResponse.json({ logs: data ?? [] })
}

export async function POST(req: NextRequest) {
  let bodyFrom: string | undefined
  let bodyTo: string | undefined
  try {
    const body = await req.json()
    bodyFrom = body.from
    bodyTo = body.to
  } catch { /* no body = use defaults */ }

  const { from, to } = resolveRange(bodyFrom, bodyTo)
  const now = new Date().toISOString()

  const { data: logRow } = await supabase
    .from("sync_log")
    .insert({ started_at: now, from_date: from, to_date: to, status: "running" })
    .select("id")
    .single()

  const logId = logRow?.id

  try {
    const rawOrders = await fetchOrders(from, to)

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
      await supabase.from("orders").upsert(orderRows.slice(i, i + 500), { onConflict: "id" })
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
    }

    let analyticsCount = 0
    try {
      const analyticsRows = await fetchAnalytics(from, to)
      if (analyticsRows.length > 0) {
        await supabase
          .from("analytics_daily")
          .upsert(analyticsRows.map((r) => ({ ...r, synced_at: now })), { onConflict: "date" })
        analyticsCount = analyticsRows.length
      }
    } catch { /* analytics optional */ }

    await supabase
      .from("sync_log")
      .update({ completed_at: new Date().toISOString(), orders_fetched: rawOrders.length, status: "success" })
      .eq("id", logId)

    return NextResponse.json({ ok: true, orders: rawOrders.length, analytics: analyticsCount, from, to })
  } catch (err) {
    const msg = (err as Error).message
    await supabase
      .from("sync_log")
      .update({ completed_at: new Date().toISOString(), status: "error", error: msg })
      .eq("id", logId)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
