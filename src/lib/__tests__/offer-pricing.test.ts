import { describe, expect, it } from 'vitest'
import { parseOfferInput } from '@/lib/offer-pricing'

const validInput = {
  originalPrice: '42.90',
  discountPrice: '29.90',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
}

describe('parseOfferInput', () => {
  it('computes prices in cents and a rounded discount percent', () => {
    const result = parseOfferInput(validInput)
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.originalPrice).toBe(4290)
      expect(result.discountPrice).toBe(2990)
      expect(result.discountPercent).toBe(30)
    }
  })

  it('rejects an invalid original price', () => {
    const result = parseOfferInput({ ...validInput, originalPrice: 'abc' })
    expect(result).toEqual({ error: 'Informe um preço original válido.' })
  })

  it('rejects an invalid discount price', () => {
    const result = parseOfferInput({ ...validInput, discountPrice: 'abc' })
    expect(result).toEqual({ error: 'Informe um preço promocional válido.' })
  })

  it('rejects when the discount price is not lower than the original price', () => {
    const result = parseOfferInput({ ...validInput, discountPrice: '50.00' })
    expect(result).toEqual({ error: 'O preço promocional precisa ser menor que o preço original.' })
  })

  it('rejects invalid dates', () => {
    const result = parseOfferInput({ ...validInput, startDate: 'not-a-date' })
    expect(result).toEqual({ error: 'Datas inválidas.' })
  })

  it('rejects when the end date is not after the start date', () => {
    const result = parseOfferInput({ ...validInput, startDate: '2026-02-01', endDate: '2026-01-01' })
    expect(result).toEqual({ error: 'A data final precisa ser depois da data inicial.' })
  })

  it('parses an optional quantityAvailable', () => {
    const result = parseOfferInput({ ...validInput, quantityAvailable: '10' })
    if (!('error' in result)) {
      expect(result.quantityAvailable).toBe(10)
    } else {
      throw new Error('expected success')
    }
  })

  it('leaves quantityAvailable null when omitted', () => {
    const result = parseOfferInput(validInput)
    if (!('error' in result)) {
      expect(result.quantityAvailable).toBeNull()
    } else {
      throw new Error('expected success')
    }
  })
})
