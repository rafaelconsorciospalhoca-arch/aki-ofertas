export function reaisToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null

  const [reais, centsPart = '0'] = trimmed.split('.')
  const paddedCents = centsPart.padEnd(2, '0')
  return Number(reais) * 100 + Number(paddedCents)
}

export function centsToReais(cents: number): string {
  return (cents / 100).toFixed(2)
}
