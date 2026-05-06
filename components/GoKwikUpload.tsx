"use client"

import { useRef, useState } from "react"
import { parseGoKwikCSV } from "@/lib/gokwik"
import { GoKwikRow } from "@/lib/types"

interface Props {
  onData: (rows: GoKwikRow[]) => void
  rowCount: number
}

export default function GoKwikUpload({ onData, rowCount }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState("")

  function handle(file: File) {
    setError("")
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const rows = parseGoKwikCSV(text)
        if (rows.length === 0) throw new Error("No valid rows found in CSV")
        onData(rows)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Parse failed")
      }
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">GoKwik Data</h3>
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragging ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-gray-300"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handle(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }}
        />

        {rowCount > 0 ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">✓</span>
            <span className="text-sm font-medium text-green-700">{rowCount} rows loaded</span>
            <span className="text-xs text-gray-400">Click to replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-gray-400 text-3xl">↑</span>
            <span className="text-sm text-gray-600 font-medium">Drop GoKwik CSV or click to upload</span>
            <span className="text-xs text-gray-400">
              Columns: Date, Sales Channel, Checkout Started, Address Landed,<br />
              Payment Step Reached, Payment Method Selected, Sessions Converted, Conversion %
            </span>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}
