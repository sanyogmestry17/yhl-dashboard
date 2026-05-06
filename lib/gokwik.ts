import Papa from "papaparse"
import { GoKwikRow } from "./types"

export function parseGoKwikCSV(csv: string): GoKwikRow[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  return result.data
    .filter((row) => row["Date"]?.trim())
    .map((row) => ({
      date: row["Date"]?.trim() ?? "",
      salesChannel: row["Sales Channel"]?.trim() ?? "web",
      checkoutStarted: parseInt(row["Checkout Started"]) || 0,
      addressLanded: parseInt(row["Address Landed"]) || 0,
      paymentStepReached: parseInt(row["Payment Step Reached"]) || 0,
      paymentMethodSelected: parseInt(row["Payment Method Selected"]) || 0,
      sessionsConverted: parseInt(row["Sessions Converted"]) || 0,
      conversionPct: parseFloat(row["Conversion %"]) || 0,
    }))
}

export function filterGoKwikByDateRange(rows: GoKwikRow[], from: string, to: string): GoKwikRow[] {
  return rows.filter((r) => r.date >= from && r.date <= to)
}

export function aggregateGoKwik(rows: GoKwikRow[]) {
  const totals = rows.reduce(
    (acc, r) => ({
      checkoutStarted: acc.checkoutStarted + r.checkoutStarted,
      addressLanded: acc.addressLanded + r.addressLanded,
      paymentStepReached: acc.paymentStepReached + r.paymentStepReached,
      paymentMethodSelected: acc.paymentMethodSelected + r.paymentMethodSelected,
      sessionsConverted: acc.sessionsConverted + r.sessionsConverted,
    }),
    {
      checkoutStarted: 0,
      addressLanded: 0,
      paymentStepReached: 0,
      paymentMethodSelected: 0,
      sessionsConverted: 0,
    }
  )

  const checkoutCVR =
    totals.checkoutStarted > 0
      ? (totals.sessionsConverted / totals.checkoutStarted) * 100
      : 0

  return { ...totals, checkoutCVR }
}
