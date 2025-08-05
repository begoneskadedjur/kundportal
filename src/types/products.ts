// src/types/products.ts - Produkttyper för BeGone Oneflow-integration

export type ProductCategory = 
  | 'pest_control'      // Skadedjursbekämpning
  | 'preventive'        // Preventiva lösningar  
  | 'specialty'         // Specialtjänster
  | 'additional'        // Tillvalstjänster

export type CustomerType = 'company' | 'individual'

export type TaxDeductionType = 
  | 'rot'              // ROT-avdrag (30%, max 50,000 kr/år)
  | 'rut'              // RUT-avdrag (50%, max 75,000 kr/år) 
  | 'none'             // Ingen avdrag

export type QuantityType = 
  | 'single_choice'     // Endast ett val per produktgrupp
  | 'multiple_choice'   // Flera val tillåtna
  | 'quantity'          // Numerisk kvantitet

// Prisstruktur för olika kundtyper
export interface PricingTier {
  company: {
    basePrice: number        // Pris exkl moms
    vatRate: number         // Momssats (0.25 för Sverige)
    discountPercent?: number // Eventuell rabatt
  }
  individual: {
    basePrice: number        // Pris inkl moms
    taxDeduction?: TaxDeductionType
    maxDeductionAmount?: number
    discountPercent?: number
  }
}

// Prisvariant för produkter med olika prissättningsalternativ
export interface PriceVariant {
  id: string                 // Unik identifierare för varianten
  name: string              // Namn på varianten (t.ex. "2 sovrum + vardagsrum")
  description?: string      // Detaljerad beskrivning av varianten
  pricing: PricingTier      // Priser för denna variant
  isDefault?: boolean       // Om detta är standardvarianten
  sortOrder?: number        // Sorteringsordning i UI
}

// Produktdefinition
export interface ProductItem {
  id: string
  name: string
  description: string
  category: ProductCategory
  pricing: PricingTier          // Baspris (används om inga prisvarianter finns)
  priceVariants?: PriceVariant[] // Optionella prisvarianter
  quantityType: QuantityType
  
  // Oneflow-specifika fält
  oneflowCompatible: boolean
  defaultQuantity: number
  maxQuantity?: number
  
  // Metadata
  isPopular?: boolean
  seasonalAvailable?: boolean
  requiresConsultation?: boolean
  
  // ROT/RUT-kvalificering
  rotEligible: boolean
  rutEligible: boolean
  
  // Beskrivningstext för kontrakt
  contractDescription: string
}

// Produktgrupp för organisering
export interface ProductGroup {
  id: string
  name: string
  description: string
  category: ProductCategory
  icon: string
  products: ProductItem[]
  displayOrder: number
}

// Valda produkter i kundvagn
export interface SelectedProduct {
  product: ProductItem
  quantity: number
  selectedVariant?: PriceVariant  // Vald prisvariant (om produkten har varianter)
  customPrice?: number
  notes?: string
}

// Prissammanfattning
export interface PriceSummary {
  subtotal: number
  vatAmount: number
  taxDeductionAmount: number
  totalBeforeDeduction: number
  totalAfterDeduction: number
  deductionType?: TaxDeductionType
  
  // Uppdelning per kategori
  breakdown: {
    [key in ProductCategory]?: {
      subtotal: number
      quantity: number
      products: SelectedProduct[]
    }
  }
}

// Oneflow produktdata för API
export interface OneflowProductData {
  name: string
  description: string
  price_1: {
    base_amount: number
    discount_amount?: number
    currency: string
  }
  price_2?: {
    base_amount: number
    discount_amount?: number  
    currency: string
  }
  quantity: {
    type: QuantityType
    amount: number
  }
  counterparty_lock: boolean
}

// Produktgrupp för Oneflow
export interface OneflowProductGroup {
  id?: number
  products: OneflowProductData[]
  configuration: {
    hide_price_summation: boolean
    allow_quantity_change?: boolean
  }
}

// Konfiguration för produkthantering
export interface ProductConfig {
  defaultCurrency: string
  vatRate: number
  rotMaxAmount: number
  rutMaxAmount: number
  rotRate: number
  rutRate: number
  enableQuantityDiscounts: boolean
  enableSeasonalPricing: boolean
}