import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { fetchOrders, toISTDate } from "@/lib/shopify"
import { isStackProduct, decomposeStack } from "@/lib/stack-config"
import { ProcessedOrder, ShopifyOrder } from "@/lib/types"

function buildProcessed(rawOrders: ShopifyOrder[]): ProcessedOrder[] {
  return rawOrders.map((o) => {
    const items = (o.line_items ?? []).map((li) => {
      const stack = isStackProduct(li.title)
      return {
        productId: li.product_id,
        title: li.title,
        quantity: li.quantity,
        price: parseFloat(li.price),
        isStack: stack,
        decomposed: stack ? decomposeStack(li.title, li.quantity) : [],
      }
    })
    return {
      id: o.id,
      date: toISTDate(o.created_at),
      revenue: parseFloat(o.total_price),
      items,
      hasStack: items.some((i) => i.isStack),
    }
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 })
  }

  try {
    // serve from Supabase if data exists
    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("date", from)
      .lte("date", to)

    if (count && count > 0) {
      const { data, error } = await supabase
        .from("orders")
        .select("raw_json")
        .gte("date", from)
        .lte("date", to)

      if (error) throw new Error(error.message)
      const rawOrders: ShopifyOrder[] = (data ?? []).map((r) => r.raw_json as ShopifyOrder)
      return NextResponse.json({ orders: buildProcessed(rawOrders), source: "db" })
    }

    // fetch live + cache
    const rawOrders = await fetchOrders(from, to)
    if (rawOrders.length > 0) await cacheOrders(rawOrders)

    return NextResponse.json({ orders: buildProcessed(rawOrders), source: "live" })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function cacheOrders(rawOrders: ShopifyOrder[]) {
  const orderRows = rawOrders.map((o) => ({
    id: o.id,
    created_at: o.created_at,
    date: toISTDate(o.created_at),
    financial_status: o.financial_status ?? "",
    total_price: parseFloat(o.total_price ?? "0"),
    has_stack: (o.line_items ?? []).some((li) => isStackProduct(li.title)),
    raw_json: o,
  }))

  // upsert in chunks of 500
  for (let i = 0; i < orderRows.length; i += 500) {
    await supabase
      .from("orders")
      .upsert(orderRows.slice(i, i + 500), { onConflict: "id" })
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

  // delete old line items then re-insert
  const orderIds = rawOrders.map((o) => o.id)
  await supabase.from("line_items").delete().in("order_id", orderIds)
  for (let i = 0; i < liRows.length; i += 500) {
    await supabase.from("line_items").insert(liRows.slice(i, i + 500))
  }
}
