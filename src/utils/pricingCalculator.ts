// src/utils/pricingCalculator.ts - Prisberäkningar för BeGone-produkter

import { 
  SelectedProduct, 
  PriceSummary, 
  CustomerType, 
  TaxDeductionType,
  ProductCategory 
} from '../types/products'
import { PRODUCT_CONFIG } from '../data/begoneProducts'

/**
 * Beräknar totalt pris för en enskild produkt baserat på kundtyp
 */
export function calculateProductPrice(
  selectedProduct: SelectedProduct,
  customerType: CustomerType
): number {
  const { product, quantity, customPrice } = selectedProduct
  
  // Använd anpassat pris om tillgängligt
  if (customPrice !== undefined) {
    return customPrice * quantity
  }
  
  const pricing = product.pricing[customerType]
  let basePrice = pricing.basePrice
  
  // Applicera rabatt om tillgänglig
  if (pricing.discountPercent) {
    basePrice = basePrice * (1 - pricing.discountPercent / 100)
  }
  
  return basePrice * quantity
}

/**
 * Beräknar moms för företagskunder
 */
export function calculateVAT(
  subtotal: number,
  customerType: CustomerType
): number {
  if (customerType === 'individual') {
    return 0 // Privatpersoner betalar pris inkl moms
  }
  
  return subtotal * PRODUCT_CONFIG.vatRate
}

/**
 * Beräknar ROT-avdrag
 */
export function calculateROTDeduction(
  selectedProducts: SelectedProduct[],
  customerType: CustomerType
): { amount: number; eligibleAmount: number } {
  if (customerType === 'company') {
    return { amount: 0, eligibleAmount: 0 }
  }
  
  const rotEligibleProducts = selectedProducts.filter(sp => sp.product.rotEligible)
  const eligibleAmount = rotEligibleProducts.reduce((sum, sp) => {
    return sum + calculateProductPrice(sp, customerType)
  }, 0)
  
  const deductionAmount = Math.min(
    eligibleAmount * PRODUCT_CONFIG.rotRate,
    PRODUCT_CONFIG.rotMaxAmount
  )
  
  return { amount: deductionAmount, eligibleAmount }
}

/**
 * Beräknar RUT-avdrag
 */
export function calculateRUTDeduction(
  selectedProducts: SelectedProduct[],
  customerType: CustomerType
): { amount: number; eligibleAmount: number } {
  if (customerType === 'company') {
    return { amount: 0, eligibleAmount: 0 }
  }
  
  const rutEligibleProducts = selectedProducts.filter(sp => sp.product.rutEligible)
  const eligibleAmount = rutEligibleProducts.reduce((sum, sp) => {
    return sum + calculateProductPrice(sp, customerType)
  }, 0)
  
  const deductionAmount = Math.min(
    eligibleAmount * PRODUCT_CONFIG.rutRate,
    PRODUCT_CONFIG.rutMaxAmount
  )
  
  return { amount: deductionAmount, eligibleAmount }
}

/**
 * Bestämmer bästa avdragstyp för privatpersoner
 */
export function getBestTaxDeduction(
  selectedProducts: SelectedProduct[]
): TaxDeductionType {
  const rotDeduction = calculateROTDeduction(selectedProducts, 'individual')
  const rutDeduction = calculateRUTDeduction(selectedProducts, 'individual')
  
  if (rotDeduction.amount === 0 && rutDeduction.amount === 0) {
    return 'none'
  }
  
  return rotDeduction.amount >= rutDeduction.amount ? 'rot' : 'rut'
}

/**
 * Beräknar uppdelning per produktkategori
 */
export function calculateCategoryBreakdown(
  selectedProducts: SelectedProduct[],
  customerType: CustomerType
): PriceSummary['breakdown'] {
  const breakdown: PriceSummary['breakdown'] = {}
  
  selectedProducts.forEach(selectedProduct => {
    const category = selectedProduct.product.category
    const price = calculateProductPrice(selectedProduct, customerType)
    
    if (!breakdown[category]) {
      breakdown[category] = {
        subtotal: 0,
        quantity: 0,
        products: []
      }
    }
    
    breakdown[category]!.subtotal += price
    breakdown[category]!.quantity += selectedProduct.quantity
    breakdown[category]!.products.push(selectedProduct)
  })
  
  return breakdown
}

/**
 * Huvudfunktion för att beräkna fullständig prissammanfattning
 */
export function calculatePriceSummary(
  selectedProducts: SelectedProduct[],
  customerType: CustomerType,
  forcedDeductionType?: TaxDeductionType
): PriceSummary {
  // Beräkna grundpris
  const subtotal = selectedProducts.reduce((sum, sp) => {
    return sum + calculateProductPrice(sp, customerType)
  }, 0)
  
  // Beräkna moms
  const vatAmount = calculateVAT(subtotal, customerType)
  const totalBeforeDeduction = subtotal + vatAmount
  
  // Bestäm avdragstyp
  const deductionType = forcedDeductionType || 
    (customerType === 'individual' ? getBestTaxDeduction(selectedProducts) : 'none')
  
  // Beräkna avdrag
  let taxDeductionAmount = 0
  if (deductionType === 'rot') {
    taxDeductionAmount = calculateROTDeduction(selectedProducts, customerType).amount
  } else if (deductionType === 'rut') {
    taxDeductionAmount = calculateRUTDeduction(selectedProducts, customerType).amount
  }
  
  const totalAfterDeduction = totalBeforeDeduction - taxDeductionAmount
  
  // Beräkna uppdelning per kategori
  const breakdown = calculateCategoryBreakdown(selectedProducts, customerType)
  
  return {
    subtotal,
    vatAmount,
    taxDeductionAmount,
    totalBeforeDeduction,
    totalAfterDeduction,
    deductionType: deductionType !== 'none' ? deductionType : undefined,
    breakdown
  }
}

/**
 * Formaterar pris för visning
 */
export function formatPrice(amount: number, currency = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Beräknar volymrabatt om aktiverat
 */
export function calculateVolumeDiscount(
  selectedProducts: SelectedProduct[],
  customerType: CustomerType
): number {
  if (!PRODUCT_CONFIG.enableQuantityDiscounts) {
    return 0
  }
  
  const totalQuantity = selectedProducts.reduce((sum, sp) => sum + sp.quantity, 0)
  let discountPercent = 0
  
  // Volymrabattstruktur
  if (totalQuantity >= 10) {
    discountPercent = 0.15 // 15% rabatt för 10+ tjänster
  } else if (totalQuantity >= 5) {
    discountPercent = 0.10 // 10% rabatt för 5+ tjänster  
  } else if (totalQuantity >= 3) {
    discountPercent = 0.05 // 5% rabatt för 3+ tjänster
  }
  
  if (discountPercent === 0) {
    return 0
  }
  
  const subtotal = selectedProducts.reduce((sum, sp) => {
    return sum + calculateProductPrice(sp, customerType)
  }, 0)
  
  return subtotal * discountPercent
}

/**
 * Beräknar säsongsrabatt om aktiverat
 */
export function calculateSeasonalDiscount(
  selectedProducts: SelectedProduct[],
  customerType: CustomerType,
  currentDate = new Date()
): number {
  if (!PRODUCT_CONFIG.enableSeasonalPricing) {
    return 0
  }
  
  const month = currentDate.getMonth() + 1 // 1-12
  let discountPercent = 0
  
  // Vinterrabatt (december-februari) för preventiva tjänster
  if (month === 12 || month <= 2) {
    discountPercent = 0.10
  }
  
  const eligibleProducts = selectedProducts.filter(sp => 
    sp.product.category === 'preventive'
  )
  
  if (eligibleProducts.length === 0 || discountPercent === 0) {
    return 0
  }
  
  const eligibleSubtotal = eligibleProducts.reduce((sum, sp) => {
    return sum + calculateProductPrice(sp, customerType)
  }, 0)
  
  return eligibleSubtotal * discountPercent
}

/**
 * Genererar kontraktsbeskrivning baserat på valda produkter
 */
export function generateContractDescription(
  selectedProducts: SelectedProduct[]
): string {
  if (selectedProducts.length === 0) {
    return 'Inga produkter valda.'
  }
  
  const descriptions = selectedProducts.map(sp => {
    const quantity = sp.quantity > 1 ? ` (${sp.quantity} st)` : ''
    const notes = sp.notes ? ` - ${sp.notes}` : ''
    return `• ${sp.product.contractDescription}${quantity}${notes}`
  })
  
  return descriptions.join('\n\n')
}

/**
 * Validerar att alla valda produkter är kompatibla med Oneflow
 */
export function validateOneflowCompatibility(
  selectedProducts: SelectedProduct[]
): { isValid: boolean; incompatibleProducts: string[] } {
  const incompatibleProducts = selectedProducts
    .filter(sp => !sp.product.oneflowCompatible)
    .map(sp => sp.product.name)
  
  return {
    isValid: incompatibleProducts.length === 0,
    incompatibleProducts
  }
}