import { describe, expect, it } from '@jest/globals'
import { firstWord } from '@/components/CategoryGrid'

describe('firstWord', () => {
  it('keeps the whole first segment, not the letter before the first "e"', () => {
    expect(firstWord('Restaurantes e Lanchonetes')).toBe('Restaurantes')
    expect(firstWord('Bares e Cafeterias')).toBe('Bares')
    expect(firstWord('Beleza e Estética')).toBe('Beleza')
    expect(firstWord('Saúde e Bem-estar')).toBe('Saúde')
    expect(firstWord('Serviços e Manutenção')).toBe('Serviços')
    expect(firstWord('Casa e Construção')).toBe('Casa')
  })

  it('returns the whole name when there is no " e " conjunction', () => {
    expect(firstWord('Automotivo')).toBe('Automotivo')
  })
})
