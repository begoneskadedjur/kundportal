// src/utils/articlePricingCalculator.ts
// Prisberäkningar för artikelbaserad wizard

import type { SelectedArticleItem } from '../types/products'
import type { SelectedProduct, CustomerType } from '../types/products'
import type { ArticleCategory, ARTICLE_UNIT_CONFIG } from '../types/articles'
import {
  DEFAULT_ROT_PERCENT,
  DEFAULT_RUT_PERCENT,
  ROT_MAX_DEDUCTION,
  RUT_MAX_DEDUCTION,
} from './rotRutConstants'

const ROT_RATE = DEFAULT_ROT_PERCENT / 100
const ROT_MAX = ROT_MAX_DEDUCTION
const RUT_RATE = DEFAULT_RUT_PERCENT / 100
const RUT_MAX = RUT_MAX_DEDUCTION

export function calculateArticleSubtotal(items: SelectedArticleItem[]): number {
  return items.reduce((sum, item) => sum + item.effectivePrice * item.quantity, 0)
}

export function calculateArticleVAT(items: SelectedArticleItem[]): number {
  return items.reduce((sum, item) => {
    return sum + item.effectivePrice * item.quantity * (item.article.vat_rate / 100)
  }, 0)
}

export function calculateArticleROTDeduction(items: SelectedArticleItem[]): number {
  const eligible = items.filter(i => i.article.rot_eligible)
  const eligibleTotal = eligible.reduce((sum, i) => sum + i.effectivePrice * i.quantity, 0)
  return Math.min(eligibleTotal * ROT_RATE, ROT_MAX)
}

export function calculateArticleRUTDeduction(items: SelectedArticleItem[]): number {
  const eligible = items.filter(i => i.article.rut_eligible)
  const eligibleTotal = eligible.reduce((sum, i) => sum + i.effectivePrice * i.quantity, 0)
  return Math.min(eligibleTotal * RUT_RATE, RUT_MAX)
}

export function calculateArticlePriceSummary(
  items: SelectedArticleItem[],
  customerType: CustomerType,
  deductionType?: 'rot' | 'rut' | 'none' | null
) {
  const subtotal = calculateArticleSubtotal(items)
  const vatAmount = calculateArticleVAT(items)

  // 'rot' → bara ROT. 'rut' → bara RUT. Allt annat → inga avdrag.
  const showRot = deductionType === 'rot'
  const showRut = deductionType === 'rut'

  const rotDeduction = (customerType === 'individual' && showRot) ? calculateArticleROTDeduction(items) : 0
  const rutDeduction = (customerType === 'individual' && showRut) ? calculateArticleRUTDeduction(items) : 0

  const totalBeforeDeduction = customerType === 'company'
    ? subtotal + vatAmount
    : subtotal + vatAmount // Privatpersoner: artikelpris är exkl moms, visa inkl.

  const totalAfterDeduction = totalBeforeDeduction - rotDeduction - rutDeduction

  return {
    subtotal,
    vatAmount,
    rotDeduction,
    rutDeduction,
    totalBeforeDeduction,
    totalAfterDeduction,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0)
  }
}

export function generateArticleContractDescription(items: SelectedArticleItem[]): string {
  if (items.length === 0) return ''

  const lines = items.map(item => {
    const qty = item.quantity > 1 ? ` (${item.quantity} ${item.article.unit})` : ''
    const desc = item.article.description ? ` - ${item.article.description}` : ''
    return `- ${item.article.name}${qty}${desc}`
  })

  return `Tjänster som ingår i avtalet:\n\n${lines.join('\n')}`
}

/**
 * Konverterar SelectedArticleItem[] till SelectedProduct[]-format
 * som create-contract.ts API:et förväntar sig.
 */
export function convertArticlesToOneflowProducts(
  items: SelectedArticleItem[],
  partyType: CustomerType
): SelectedProduct[] {
  return items.map(item => ({
    product: {
      id: item.article.id,
      name: item.article.name,
      description: item.article.description || item.article.name,
      category: mapArticleCategoryToProductCategory(item.article.category),
      pricing: {
        company: {
          basePrice: item.effectivePrice,
          vatRate: item.article.vat_rate / 100
        },
        individual: {
          basePrice: item.effectivePrice * (1 + item.article.vat_rate / 100),
          taxDeduction: item.article.rot_eligible ? 'rot' : item.article.rut_eligible ? 'rut' : undefined
        }
      },
      quantityType: 'quantity' as const,
      oneflowCompatible: true,
      defaultQuantity: 1,
      rotEligible: item.article.rot_eligible,
      rutEligible: item.article.rut_eligible,
      contractDescription: item.article.description || item.article.name
    },
    quantity: item.quantity
  }))
}

/**
 * Konverterar tjänsterader (case_billing_items med item_type='service')
 * till SelectedProduct[]-format som OneFlow-API:et förväntar sig.
 * Detta är det som ska skickas till OneFlow — inte inköpsartiklar.
 */
export function convertServicesToOneflowProducts(
  services: Array<{
    service_name?: string | null
    service_code?: string | null
    description?: string | null
    unit_price: number
    quantity: number
    vat_rate?: number | null
    rot_rut_type?: 'ROT' | 'RUT' | null
    service?: { rot_rate_percent?: number | null; rut_rate_percent?: number | null } | null
  }>,
  _partyType: CustomerType
): SelectedProduct[] {
  return services.map((s, idx) => {
    const vatRate = (s.vat_rate ?? 25) / 100
    const name = s.service_name || 'Tjänst'
    const description = s.description || name
    const taxDeduction: 'rot' | 'rut' | undefined =
      s.rot_rut_type === 'ROT' ? 'rot' : s.rot_rut_type === 'RUT' ? 'rut' : undefined

    return {
      product: {
        id: `service-${s.service_code || idx}`,
        name,
        description,
        category: 'pest_control',
        pricing: {
          company: {
            basePrice: s.unit_price,
            vatRate
          },
          individual: {
            basePrice: s.unit_price * (1 + vatRate),
            taxDeduction
          }
        },
        quantityType: 'quantity' as const,
        oneflowCompatible: true,
        defaultQuantity: 1,
        rotEligible: !!s.service?.rot_rate_percent || s.rot_rut_type === 'ROT',
        rutEligible: !!s.service?.rut_rate_percent || s.rot_rut_type === 'RUT',
        contractDescription: description
      },
      quantity: s.quantity
    }
  })
}

// Variant för anpassat pris: artiklar utan priser + en totalrad
export function convertArticlesToOneflowProductsCustomPrice(
  items: SelectedArticleItem[],
  customTotalPrice: number,  // exkl. moms
  partyType: CustomerType
): SelectedProduct[] {
  // Artiklar utan pris — visas bara som namn + beskrivning + antal
  const zeroProducts: SelectedProduct[] = items.map(item => ({
    product: {
      id: item.article.id,
      name: item.article.name,
      description: item.article.description || item.article.name,
      category: mapArticleCategoryToProductCategory(item.article.category),
      pricing: {
        company: { basePrice: 0, vatRate: item.article.vat_rate / 100 },
        individual: { basePrice: 0 }
      },
      quantityType: 'quantity' as const,
      oneflowCompatible: true,
      defaultQuantity: 1,
      rotEligible: false,
      rutEligible: false,
      contractDescription: item.article.description || item.article.name
    },
    quantity: item.quantity,
    hidePrice: true
  }))

  // Extra rad med anpassat totalpris
  const priceForParty = partyType === 'company'
    ? customTotalPrice
    : Math.round(customTotalPrice * 1.25)

  const totalProduct: SelectedProduct = {
    product: {
      id: 'custom-total',
      name: 'Totalpris',
      description: 'Avser tjänst, material, administrativa avgifter & transport',
      category: 'pest_control',
      pricing: {
        company: { basePrice: customTotalPrice, vatRate: 0.25 },
        individual: { basePrice: priceForParty }
      },
      quantityType: 'quantity' as const,
      oneflowCompatible: true,
      defaultQuantity: 1,
      rotEligible: false,
      rutEligible: false,
      contractDescription: 'Avser tjänst, material, administrativa avgifter & transport'
    },
    quantity: 1
  }

  return [...zeroProducts, totalProduct]
}

function mapArticleCategoryToProductCategory(
  category: ArticleCategory
): 'pest_control' | 'preventive' | 'specialty' | 'additional' {
  switch (category) {
    case 'Bekämpning': return 'pest_control'
    case 'Inspektion': return 'preventive'
    case 'Tillbehör': return 'specialty'
    case 'Övrigt': return 'additional'
    default: return 'additional'
  }
}

export function formatArticlePrice(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}
