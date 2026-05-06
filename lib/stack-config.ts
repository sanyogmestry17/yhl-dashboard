import { DecomposedItem } from "./types"

// Edit keys to match EXACT product titles in Shopify (case-sensitive)
// Values: component product title => quantity per stack unit
export const STACK_MAP: Record<string, Record<string, number>> = {
  "Glow Stack": {
    "Collagen Powder": 1,
    "Vitamin C Serum": 1,
    "Wellness Capsules": 1,
  },
  "Complete Bundle": {
    "Collagen Powder": 1,
    "Vitamin C Serum": 1,
    "Wellness Capsules": 1,
  },
}

export function isStackProduct(title: string): boolean {
  const lower = title.toLowerCase()
  return lower.includes("stack") || lower.includes("bundle")
}

export function decomposeStack(title: string, quantity: number): DecomposedItem[] {
  const map = STACK_MAP[title]
  if (!map) return []
  return Object.entries(map).map(([component, qty]) => ({
    title: component,
    quantity: qty * quantity,
  }))
}
