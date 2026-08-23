import { reaisToCents } from '@/lib/money'

export type OfferFormInput = {
  originalPrice: string
  discountPrice: string
  startDate: string
  endDate: string
  quantityAvailable?: string
}

export type ParsedOffer = {
  originalPrice: number
  discountPrice: number
  discountPercent: number
  startDate: Date
  endDate: Date
  quantityAvailable: number | null
}

export function parseOfferInput(input: OfferFormInput): ParsedOffer | { error: string } {
  const originalPrice = reaisToCents(input.originalPrice)
  if (originalPrice === null || originalPrice <= 0) {
    return { error: 'Informe um preço original válido.' }
  }

  const discountPrice = reaisToCents(input.discountPrice)
  if (discountPrice === null || discountPrice <= 0) {
    return { error: 'Informe um preço promocional válido.' }
  }

  if (discountPrice >= originalPrice) {
    return { error: 'O preço promocional precisa ser menor que o preço original.' }
  }

  const startDate = new Date(input.startDate)
  const endDate = new Date(input.endDate)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: 'Datas inválidas.' }
  }
  if (endDate <= startDate) {
    return { error: 'A data final precisa ser depois da data inicial.' }
  }

  let quantityAvailable: number | null = null
  if (input.quantityAvailable) {
    const parsedQuantity = Number(input.quantityAvailable)
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      return { error: 'Quantidade disponível inválida.' }
    }
    quantityAvailable = parsedQuantity
  }

  const discountPercent = Math.round((1 - discountPrice / originalPrice) * 100)

  return { originalPrice, discountPrice, discountPercent, startDate, endDate, quantityAvailable }
}
