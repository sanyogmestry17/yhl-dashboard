import { NextResponse } from "next/server"
import { fetchProducts } from "@/lib/shopify"

export async function GET() {
  try {
    const products = await fetchProducts()
    return NextResponse.json({ products })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
