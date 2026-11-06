export function formatTokenCount(value: number | null): string {
  if (value == null) return '—'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
  }
  return String(value)
}
