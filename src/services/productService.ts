// src/services/productService.ts - Supabase service för produkthantering

import { supabase } from '../lib/supabase'
import { ProductItem } from '../types/products'
import toast from 'react-hot-toast'

// Databas-typ som matchar products tabellen
export interface DatabaseProduct {
  id: string
  name: string
  description: string
  category: 'pest_control' | 'preventive' | 'specialty' | 'additional'
  
  // Företagspriser
  company_base_price: number
  company_vat_rate: number
  company_discount_percent: number
  
  // Privatpriser
  individual_base_price: number
  individual_tax_deduction: 'rot' | 'rut' | null
  individual_discount_percent: number
  
  // Kvantitet
  quantity_type: 'quantity' | 'single_choice' | 'multiple_choice'
  default_quantity: number
  max_quantity: number
  
  // Egenskaper
  oneflow_compatible: boolean
  is_popular: boolean
  rot_eligible: boolean
  rut_eligible: boolean
  seasonal_available: boolean
  requires_consultation: boolean
  
  // Beskrivning
  contract_description: string
  
  // Metadata
  created_at: string
  updated_at: string
  created_by: string | null
  is_active: boolean
}

// Konvertera från databas-format till ProductItem
export function mapDatabaseProductToProductItem(dbProduct: DatabaseProduct): ProductItem {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    description: dbProduct.description,
    category: dbProduct.category,
    pricing: {
      company: {
        basePrice: dbProduct.company_base_price,
        vatRate: dbProduct.company_vat_rate,
        discountPercent: dbProduct.company_discount_percent > 0 ? dbProduct.company_discount_percent : undefined
      },
      individual: {
        basePrice: dbProduct.individual_base_price,
        taxDeduction: dbProduct.individual_tax_deduction || undefined,
        discountPercent: dbProduct.individual_discount_percent > 0 ? dbProduct.individual_discount_percent : undefined
      }
    },
    quantityType: dbProduct.quantity_type,
    defaultQuantity: dbProduct.default_quantity,
    maxQuantity: dbProduct.max_quantity,
    oneflowCompatible: dbProduct.oneflow_compatible,
    isPopular: dbProduct.is_popular,
    rotEligible: dbProduct.rot_eligible,
    rutEligible: dbProduct.rut_eligible,
    seasonalAvailable: dbProduct.seasonal_available,
    requiresConsultation: dbProduct.requires_consultation,
    contractDescription: dbProduct.contract_description
  }
}

// Konvertera från ProductItem till databas-format
export function mapProductItemToDatabaseProduct(product: ProductItem, userId?: string): Omit<DatabaseProduct, 'created_at' | 'updated_at'> {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    
    company_base_price: product.pricing.company.basePrice,
    company_vat_rate: product.pricing.company.vatRate || 0.25,
    company_discount_percent: product.pricing.company.discountPercent || 0,
    
    individual_base_price: product.pricing.individual.basePrice,
    individual_tax_deduction: product.pricing.individual.taxDeduction || null,
    individual_discount_percent: product.pricing.individual.discountPercent || 0,
    
    quantity_type: product.quantityType,
    default_quantity: product.defaultQuantity,
    max_quantity: product.maxQuantity || 999,
    
    oneflow_compatible: product.oneflowCompatible,
    is_popular: product.isPopular,
    rot_eligible: product.rotEligible,
    rut_eligible: product.rutEligible,
    seasonal_available: product.seasonalAvailable || false,
    requires_consultation: product.requiresConsultation || false,
    
    contract_description: product.contractDescription,
    created_by: userId || null,
    is_active: true
  }
}

// Service-klass för produkthantering
export class ProductService {
  
  // Hämta alla aktiva produkter
  static async getProducts(): Promise<ProductItem[]> {
    try {
      console.log('🔍 Laddar produkter från databas...')
      
      // Kontrollera användarstatus först
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      console.log('👤 Användare:', user?.email || 'Inte inloggad')
      
      if (authError) {
        console.error('❌ Auth fel:', authError)
      }

      // Testa först med RLS
      let { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      
      // Om RLS blockerar, testa med service role (temporärt för debugging)
      if (error && error.code === 'PGRST301') {
        console.log('🔧 RLS blockerar, testar fallback...')
        // Detta kommer bara fungera för testning
        const fallbackResponse = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
        
        data = fallbackResponse.data
        error = fallbackResponse.error
      }
      
      console.log('📊 Databas svar:', { data, error, count: data?.length })
      
      if (error) {
        console.error('❌ Fel vid hämtning av produkter:', error)
        // Mer specifikt felmeddelande
        if (error.code === 'PGRST301') {
          throw new Error('Ingen åtkomst till produkter - kontrollera behörigheter')
        }
        throw new Error(`Databasfel: ${error.message}`)
      }
      
      const products = data?.map(mapDatabaseProductToProductItem) || []
      console.log('✅ Produkter laddade:', products.length)
      
      return products
    } catch (error) {
      console.error('💥 ProductService.getProducts fel:', error)
      throw error
    }
  }
  
  // Skapa ny produkt  
  static async createProduct(product: ProductItem): Promise<ProductItem> {
    try {
      // Hämta nuvarande användare
      const { data: { user } } = await supabase.auth.getUser()
      
      const dbProduct = mapProductItemToDatabaseProduct(product, user?.id)
      
      const { data, error } = await supabase
        .from('products')
        .insert([dbProduct])
        .select()
        .single()
      
      if (error) {
        console.error('Fel vid skapande av produkt:', error)
        throw new Error('Kunde inte skapa produkten')
      }
      
      return mapDatabaseProductToProductItem(data)
    } catch (error) {
      console.error('ProductService.createProduct fel:', error)
      throw error
    }
  }
  
  // Uppdatera befintlig produkt
  static async updateProduct(product: ProductItem): Promise<ProductItem> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const dbProduct = mapProductItemToDatabaseProduct(product, user?.id)
      
      const { data, error } = await supabase
        .from('products')
        .update(dbProduct)
        .eq('id', product.id)
        .select()
        .single()
      
      if (error) {
        console.error('Fel vid uppdatering av produkt:', error)
        throw new Error('Kunde inte uppdatera produkten')
      }
      
      return mapDatabaseProductToProductItem(data)
    } catch (error) {
      console.error('ProductService.updateProduct fel:', error)
      throw error
    }
  }
  
  // Ta bort produkt (soft delete)
  static async deleteProduct(productId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId)
      
      if (error) {
        console.error('Fel vid borttagning av produkt:', error)
        throw new Error('Kunde inte ta bort produkten')
      }
    } catch (error) {
      console.error('ProductService.deleteProduct fel:', error)
      throw error
    }
  }
  
  // Kontrollera om produkt-ID redan existerar
  static async isProductIdExists(productId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
        console.error('Fel vid kontroll av produkt-ID:', error)
        return false
      }
      
      return !!data
    } catch (error) {
      console.error('ProductService.isProductIdExists fel:', error)
      return false
    }
  }
}

// Hook för produkthantering
export function useProducts() {
  const [products, setProducts] = React.useState<ProductItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  
  // Ladda produkter
  const loadProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const productList = await ProductService.getProducts()
      setProducts(productList)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }
  
  // Skapa produkt
  const createProduct = async (product: ProductItem) => {
    try {
      const newProduct = await ProductService.createProduct(product)
      setProducts(prev => [...prev, newProduct])
      toast.success('Produkten skapades framgångsrikt')
      return newProduct
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte skapa produkten'
      toast.error(errorMessage)
      throw err
    }
  }
  
  // Uppdatera produkt
  const updateProduct = async (product: ProductItem) => {
    try {
      const updatedProduct = await ProductService.updateProduct(product)
      setProducts(prev => 
        prev.map(p => p.id === product.id ? updatedProduct : p)
      )
      toast.success('Produkten uppdaterades framgångsrikt')
      return updatedProduct
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte uppdatera produkten'
      toast.error(errorMessage)
      throw err
    }
  }
  
  // Ta bort produkt
  const deleteProduct = async (productId: string) => {
    try {
      await ProductService.deleteProduct(productId)
      setProducts(prev => prev.filter(p => p.id !== productId))
      toast.success('Produkten togs bort framgångsrikt')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Kunde inte ta bort produkten'
      toast.error(errorMessage)
      throw err
    }
  }
  
  React.useEffect(() => {
    loadProducts()
  }, [])
  
  return {
    products,
    loading,
    error,
    loadProducts,
    createProduct,
    updateProduct,
    deleteProduct
  }
}

// Import React för hook
import React from 'react'