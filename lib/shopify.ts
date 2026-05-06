import { ShopifyOrder, ShopifyProduct, AnalyticsData } from "./types"

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // UTC+5:30

// Convert UTC ISO string → IST date string (YYYY-MM-DD)
export function toISTDate(utcString: string): string {
  return new Date(utcString).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

// Convert IST date string → UTC ISO range for Shopify API
function istDateToUtcRange(istDate: string, end = false): string {
  const [y, m, d] = istDate.split("-").map(Number)
  const istMs = Date.UTC(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0)
  return new Date(istMs - IST_OFFSET_MS).toISOString()
}

const API_VERSION = "2024-01"

// Read lazily so tsx scripts work even when dotenv runs after module load
function shopifyHeaders() {
  return {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN!,
    "Content-Type": "application/json",
  }
}
function shopifyBase() {
  return `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${API_VERSION}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: shopifyHeaders() })
      return res
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(1500 * attempt)
    }
  }
  throw new Error("unreachable")
}

async function paginate<T>(url: string, key: string): Promise<T[]> {
  const all: T[] = []
  let next: string | null = url
  let page = 0

  while (next) {
    if (page > 0) await sleep(500) // avoid Shopify rate limit between pages
    page++
    const response = await fetchWithRetry(next)
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
  // Use IST-converted UTC timestamps so Shopify returns orders matching IST dates
  const url =
    `${shopifyBase()}/orders.json?status=any` +
    `&created_at_min=${istDateToUtcRange(from, false)}` +
    `&created_at_max=${istDateToUtcRange(to, true)}` +
    `&limit=250&fields=id,created_at,line_items,financial_status,total_price,current_total_price,refunds`
  return paginate<ShopifyOrder>(url, "orders")
}

export async function fetchProducts(): Promise<ShopifyProduct[]> {
  const url = `${shopifyBase()}/products.json?limit=250&fields=id,title,product_type,tags,handle,variants`
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

  const res = await fetch(`${shopifyBase()}/graphql.json`, {
    method: "POST",
    headers: shopifyHeaders(),
    body: JSON.stringify({ query: gql }),
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
