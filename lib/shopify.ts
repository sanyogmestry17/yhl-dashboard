import { ShopifyOrder, ShopifyProduct, AnalyticsData } from "./types"

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!
const API_VERSION = "2024-01"
const BASE = `https://${SHOP}/admin/api/${API_VERSION}`

const headers = {
  "X-Shopify-Access-Token": TOKEN,
  "Content-Type": "application/json",
}

async function paginate<T>(url: string, key: string): Promise<T[]> {
  const all: T[] = []
  let next: string | null = url

  while (next) {
    const response: Response = await fetch(next, { headers, cache: "no-store" })
    if (!response.ok) throw new Error(`Shopify API ${response.status}: ${await response.text()}`)
    const data: Record<string, T[]> = await response.json()
    all.push(...(data[key] ?? []))

    const linkHeader: string = response.headers.get("link") ?? ""
    const match: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
    next = match ? match[1] : null
  }

  return all
}

export async function fetchOrders(from: string, to: string): Promise<ShopifyOrder[]> {
  const url =
    `${BASE}/orders.json?status=any` +
    `&created_at_min=${from}T00:00:00&created_at_max=${to}T23:59:59` +
    `&limit=250&fields=id,created_at,line_items,financial_status,total_price`
  return paginate<ShopifyOrder>(url, "orders")
}

export async function fetchProducts(): Promise<ShopifyProduct[]> {
  const url = `${BASE}/products.json?limit=250&fields=id,title,product_type,tags,handle,variants`
  return paginate<ShopifyProduct>(url, "products")
}

export async function fetchAnalytics(from: string, to: string): Promise<AnalyticsData[]> {
  const shopifyqlQuery = `SHOW sum(sessions_with_add_to_cart) AS atc, sum(sessions) AS sessions FROM sessions SINCE ${from} UNTIL ${to} GROUP BY day ORDER BY day ASC`

  const gql = `
    query {
      shopifyqlQuery(query: ${JSON.stringify(shopifyqlQuery)}) {
        ... on TableResponse {
          tableData {
            rowData
            columns { name dataType }
          }
        }
        parseErrors { code message }
      }
    }
  `

  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: gql }),
    cache: "no-store",
  })

  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}`)
  const json = await res.json()

  const tableData = json?.data?.shopifyqlQuery?.tableData
  if (!tableData) return []

  const cols: string[] = tableData.columns.map((c: { name: string }) => c.name)
  const dayIdx = cols.indexOf("day")
  const atcIdx = cols.indexOf("atc")
  const sessIdx = cols.indexOf("sessions")

  return (tableData.rowData as string[][]).map((row) => ({
    date: row[dayIdx],
    atc: Number(row[atcIdx]) || 0,
    sessions: Number(row[sessIdx]) || 0,
  }))
}
