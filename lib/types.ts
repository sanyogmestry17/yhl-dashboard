export interface GoKwikRow {
  date: string
  salesChannel: string
  checkoutStarted: number
  addressLanded: number
  paymentStepReached: number
  paymentMethodSelected: number
  sessionsConverted: number
  conversionPct: number
}

export interface ShopifyLineItem {
  product_id: number
  variant_id: number
  title: string
  quantity: number
  price: string
  sku: string
}

export interface ShopifyOrder {
  id: number
  created_at: string
  financial_status: string
  total_price: string
  current_total_price: string  // after refunds — matches Shopify Analytics "Total sales"
  line_items: ShopifyLineItem[]
}

export interface ShopifyVariant {
  id: number
  title: string
  price: string
  sku: string
}

export interface ShopifyProduct {
  id: number
  title: string
  product_type: string
  tags: string
  handle: string
  variants: ShopifyVariant[]
}

export interface DecomposedItem {
  title: string
  quantity: number
}

export interface ProcessedLineItem {
  productId: number
  title: string
  quantity: number
  price: number
  isStack: boolean
  decomposed: DecomposedItem[]
}

export interface ProcessedOrder {
  id: number
  date: string
  revenue: number
  items: ProcessedLineItem[]
  hasStack: boolean
}

export interface ProductSalesRow {
  title: string
  isStack: boolean
  unitsSold: number
  revenue: number
  orderCount: number
  decomposed: DecomposedItem[]
}

export interface FunnelStep {
  step: string
  count: number
  dropoffFromPrev: number
  dropoffPct: number
}

export interface AnalyticsData {
  date: string
  atc: number
  sessions: number
}

export interface KPIData {
  // GoKwik funnel
  checkoutStarted: number
  addressLanded: number
  paymentStepReached: number
  paymentMethodSelected: number
  sessionsConverted: number
  checkoutCVR: number
  // Shopify
  totalOrders: number
  revenue: number
  atc: number
  sessions: number
  siteCVR: number
  stackOrders: number
  singleOrders: number
}

export interface DateRange {
  from: string
  to: string
}

export interface DashboardFilters {
  dateRange: DateRange
  channel: string
  productType: 'all' | 'single' | 'stack'
  showStackDecomposed: boolean
}
