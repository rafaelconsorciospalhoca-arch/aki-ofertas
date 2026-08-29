export function calculateOrderTotal(subtotalCents: number, feeCents: number | null): number {
  return subtotalCents + (feeCents ?? 0)
}
