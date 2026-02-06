// src/utils/articlePricingCalculator.ts
// Prisberäkningar för artikelbaserad wizard

import type { SelectedArticleItem } from '../types/products'
import type { SelectedProduct, CustomerType } from '../types/products'
import type { ArticleCategory, ARTICLE_UNIT_CONFIG } from '../types/articles'

// ROT/RUT-konfiguration
const ROT_RATE = 0.30
const ROT_MAX = 50000
const RUT_RATE = 0.50
const RUT_MAX = 75000

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
  customerType: CustomerType
) {
  const subtotal = calculateArticleSubtotal(items)
  const vatAmount = calculateArticleVAT(items)
  const rotDeduction = customerType === 'individual' ? calculateArticleROTDeduction(items) : 0
  const rutDeduction = customerType === 'individual' ? calculateArticleRUTDeduction(items) : 0

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
