import { describe, expect, it } from '@jest/globals'
import { formatCents } from '@/utils/money'

describe('formatCents', () => {
  it('formats cents as BRL currency', () => {
    expect(formatCents(2990)).toBe(
      (2990 / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    )
  })

  it('handles zero', () => {
    expect(formatCents(0)).toBe((0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
  })
})
