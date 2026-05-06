import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { fetchAnalytics } from "@/lib/shopify"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = searchParams.get("from") ?? ""
  const to = searchParams.get("to") ?? ""

  if (!from || !to) {
    return NextResponse.json({ error: "from and to required" }, { status: 400 })
  }

  try {
    const { count } = await supabase
      .from("analytics_daily")
      .select("*", { count: "exact", head: true })
      .gte("date", from)
      .lte("date", to)

    if (count && count > 0) {
      const { data, error } = await supabase
        .from("analytics_daily")
        .select("date, atc, sessions")
        .gte("date", from)
        .lte("date", to)
        .order("date")

      if (error) throw new Error(error.message)
      return NextResponse.json({ analytics: data ?? [], source: "db" })
    }

    const analytics = await fetchAnalytics(from, to)

    if (analytics.length > 0) {
      const now = new Date().toISOString()
      await supabase
        .from("analytics_daily")
        .upsert(analytics.map((r) => ({ ...r, synced_at: now })), { onConflict: "date" })
    }

    return NextResponse.json({ analytics, source: "live" })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, analytics: [] }, { status: 200 })
  }
}
