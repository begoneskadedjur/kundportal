// src/components/admin/ProductSelector.tsx - Produktväljare för Oneflow

import React, { useState, useMemo } from 'react'
import { Search, Plus, Minus, Info, Star, Leaf, ShieldCheck, Sparkles } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import { 
  ProductGroup,
  ProductItem,
  SelectedProduct,
  CustomerType,
  ProductCategory 
} from '../../types/products'
import { useProducts } from '../../services/productService'
import { calculateProductPrice, formatPrice } from '../../utils/pricingCalculator'

interface ProductSelectorProps {
  selectedProducts: SelectedProduct[]
  onSelectionChange: (products: SelectedProduct[]) => void
  customerType: CustomerType
  className?: string
}

interface CustomProduct {
  id: string
  name: string
  description: string
  price: number
  quantity: number
  quantityType: 'quantity' | 'single_choice'
}

interface ProductCardProps {
  product: ProductItem
  selectedProduct?: SelectedProduct
  customerType: CustomerType
  onQuantityChange: (productId: string, quantity: number) => void
}

// Ikon för produktkategorier
const getCategoryIcon = (category: ProductCategory) => {
  switch (category) {
    case 'pest_control': return '🐭'
    case 'preventive': return '🛡️'
    case 'specialty': return '🧹'
    case 'additional': return '📋'
    default: return '•'
  }
}

// Produktkort-komponent
const ProductCard: React.FC<ProductCardProps> = ({
  product,
  selectedProduct,
  customerType,
  onQuantityChange
}) => {
  const quantity = selectedProduct?.quantity || 0
  const isSelected = quantity > 0
  
  const pricing = product.pricing[customerType]
  const basePrice = pricing.basePrice
  const discountedPrice = pricing.discountPercent 
    ? basePrice * (1 - pricing.discountPercent / 100)
    : basePrice
  
  const handleQuantityChange = (delta: number) => {
    const newQuantity = Math.max(0, quantity + delta)
    const maxQty = product.maxQuantity || 999
    
    if (newQuantity <= maxQty) {
      onQuantityChange(product.id, newQuantity)
    }
  }

  return (
    <Card className={`p-4 border-2 transition-all duration-200 ${
      isSelected 
        ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
        : 'border-slate-700 hover:border-slate-600'
    }`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">{product.name}</h3>
              {product.isPopular && (
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
              )}
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {product.rotEligible && (
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              ROT-berättigad
            </span>
          )}
          {product.rutEligible && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
              <Leaf className="w-3 h-3" />
              RUT-berättigad
            </span>
          )}
          {product.seasonalAvailable && (
            <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full">
              Säsong
            </span>
          )}
          {product.requiresConsultation && (
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
              <Info className="w-3 h-3" />
              Konsult
            </span>
          )}
        </div>

        {/* Pris */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Pris:</span>
            <div className="text-right">
              {pricing.discountPercent ? (
                <div>
                  <span className="text-slate-500 line-through text-sm">
                    {formatPrice(basePrice)}
                  </span>
                  <span className="text-green-400 font-semibold ml-2">
                    {formatPrice(discountedPrice)}
                  </span>
                </div>
              ) : (
                <span className="text-white font-semibold">
                  {formatPrice(discountedPrice)}
                </span>
              )}
            </div>
          </div>
          
          {customerType === 'company' && (
            <div className="text-xs text-slate-500">
              + moms ({formatPrice(discountedPrice * 0.25)})
            </div>
          )}
          
          {customerType === 'individual' && product.rotEligible && (
            <div className="text-xs text-blue-400">
              ROT-avdrag: -{formatPrice(discountedPrice * 0.30)}
            </div>
          )}
          
          {customerType === 'individual' && product.rutEligible && (
            <div className="text-xs text-green-400">
              RUT-avdrag: -{formatPrice(discountedPrice * 0.50)}
            </div>
          )}
        </div>

        {/* Kvantitetskontroller */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity === 0}
              className="w-8 h-8 p-0"
            >
              <Minus className="w-4 h-4" />
            </Button>
            
            <span className="text-white font-medium w-8 text-center">
              {quantity}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= (product.maxQuantity || 999)}
              className="w-8 h-8 p-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {quantity > 0 && (
            <div className="text-right">
              <div className="text-sm text-slate-400">Totalt:</div>
              <div className="font-semibold text-green-400">
                {formatPrice(calculateProductPrice({ product, quantity }, customerType))}
              </div>
            </div>
          )}
        </div>

        {/* Snabb-lägg-till knappar */}
        {quantity === 0 && product.quantityType === 'quantity' && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onQuantityChange(product.id, 1)}
              className="flex-1 text-xs"
            >
              + 1
            </Button>
            {product.defaultQuantity > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onQuantityChange(product.id, product.defaultQuantity)}
                className="flex-1 text-xs"
              >
                + {product.defaultQuantity}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// Anpassat produktkort-komponent
const CustomProductCard: React.FC<{
  customerType: CustomerType
  onAddCustomProduct: (product: CustomProduct) => void
}> = ({ customerType, onAddCustomProduct }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [customProduct, setCustomProduct] = useState<Partial<CustomProduct>>({
    name: '',
    description: '',
    price: '',
    quantity: 1,
    quantityType: 'quantity'
  })

  const handleAddProduct = () => {
    if (!customProduct.name || !customProduct.description || !customProduct.price) {
      return
    }

    const newProduct: CustomProduct = {
      id: `custom-${Date.now()}`,
      name: customProduct.name!,
      description: customProduct.description!,
      price: Number(customProduct.price),
      quantity: customProduct.quantity || 1,
      quantityType: customProduct.quantityType || 'quantity'
    }

    onAddCustomProduct(newProduct)

    // Återställ formuläret
    setCustomProduct({
      name: '',
      description: '',
      price: '',
      quantity: 1,
      quantityType: 'quantity'
    })
    setIsExpanded(false)
  }

  const isValid = customProduct.name && customProduct.description && customProduct.price && Number(customProduct.price) > 0

  return (
    <Card className="p-4 border-2 border-dashed border-blue-500/50 bg-blue-500/5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Anpassad produkt</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-400 border-blue-500/50"
          >
            {isExpanded ? 'Stäng' : 'Lägg till'}
          </Button>
        </div>

        {!isExpanded && (
          <p className="text-sm text-slate-400">
            Skapa anpassade produkter och tjänster för specifika kundkrav
          </p>
        )}

        {isExpanded && (
          <div className="space-y-4 pt-3 border-t border-blue-500/20">
            <Input
              label="Produktnamn"
              placeholder="T.ex. Specialrengöring"
              value={customProduct.name || ''}
              onChange={(e) => setCustomProduct(prev => ({ ...prev, name: e.target.value }))}
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Detaljerad beskrivning av tjänsten..."
                rows={3}
                value={customProduct.description || ''}
                onChange={(e) => setCustomProduct(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label={`Pris (${customerType === 'company' ? 'exkl. moms' : 'inkl. moms'})`}
                type="number"
                placeholder="0"
                min="0"
                step="100"
                value={customProduct.price || ''}
                onChange={(e) => setCustomProduct(prev => ({ ...prev, price: e.target.value }))}
                required
              />

              <Input
                label="Antal"
                type="number"
                placeholder="1"
                min="1"
                max="999"
                value={customProduct.quantity || 1}
                onChange={(e) => setCustomProduct(prev => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Typ
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={customProduct.quantityType || 'quantity'}
                onChange={(e) => setCustomProduct(prev => ({ ...prev, quantityType: e.target.value as 'quantity' | 'single_choice' }))}
              >
                <option value="quantity">Kvantitet (kan ändras)</option>
                <option value="single_choice">Ja/Nej val</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddProduct}
                disabled={!isValid}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Lägg till produkt
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
              >
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// Huvudkomponent
export default function ProductSelector({
  selectedProducts,
  onSelectionChange,
  customerType,
  className = ''
}: ProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all')
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([])

  // Ladda produkter från databas
  const { products: allProducts, loading, error } = useProducts()

  // Helper-funktioner för kategorier (flytta före useMemo)
  const getCategoryName = (category: ProductCategory): string => {
    switch (category) {
      case 'pest_control': return 'Skadedjursbekämpning'
      case 'preventive': return 'Preventiva lösningar'
      case 'specialty': return 'Specialtjänster'
      case 'additional': return 'Tillvalstjänster'
      default: return category
    }
  }

  const getCategoryDescription = (category: ProductCategory): string => {
    switch (category) {
      case 'pest_control': return 'Aktiv bekämpning av skadedjur'
      case 'preventive': return 'Förebyggande åtgärder och kontinuerlig övervakning'
      case 'specialty': return 'Sanering, desinfektion och specialbehandlingar'
      case 'additional': return 'Tillval och tilläggstjänster'
      default: return ''
    }
  }

  const getCategoryOrder = (category: ProductCategory): number => {
    switch (category) {
      case 'pest_control': return 1
      case 'preventive': return 2
      case 'specialty': return 3
      case 'additional': return 4
      default: return 5
    }
  }

  // Filtrerade produkter organiserade per kategori
  const filteredGroups = useMemo(() => {
    // Filtrera produkter baserat på sök och kategori
    const filtered = allProducts.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
      return matchesSearch && matchesCategory
    })

    // Gruppera per kategori
    const groupedByCategory = filtered.reduce((groups, product) => {
      if (!groups[product.category]) {
        groups[product.category] = []
      }
      groups[product.category].push(product)
      return groups
    }, {} as Record<ProductCategory, ProductItem[]>)

    // Skapa ProductGroup-strukturer
    return Object.entries(groupedByCategory).map(([category, products]) => ({
      id: `${category}-group`,
      name: getCategoryName(category as ProductCategory),
      description: getCategoryDescription(category as ProductCategory),
      category: category as ProductCategory,
      icon: getCategoryIcon(category as ProductCategory),
      products,
      displayOrder: getCategoryOrder(category as ProductCategory)
    })).sort((a, b) => a.displayOrder - b.displayOrder)
  }, [allProducts, searchTerm, selectedCategory])

  // Hantera kvantitetsändringar
  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      // Ta bort produkt
      const updatedProducts = selectedProducts.filter(sp => sp.product.id !== productId)
      onSelectionChange(updatedProducts)
    } else {
      // Hitta produkten
      const product = allProducts.find(p => p.id === productId)
      if (!product) return

      // Uppdatera eller lägg till produkt
      const existingIndex = selectedProducts.findIndex(sp => sp.product.id === productId)
      const updatedProducts = [...selectedProducts]
      
      if (existingIndex >= 0) {
        updatedProducts[existingIndex].quantity = newQuantity
      } else {
        updatedProducts.push({
          product,
          quantity: newQuantity
        })
      }
      
      onSelectionChange(updatedProducts)
    }
  }

  // Hantera anpassade produkter
  const handleAddCustomProduct = (customProduct: CustomProduct) => {
    // Konvertera anpassad produkt till ProductItem format
    const productItem: ProductItem = {
      id: customProduct.id,
      name: customProduct.name,
      description: customProduct.description,
      category: 'additional' as ProductCategory,
      pricing: {
        company: { basePrice: customProduct.price, vatRate: 0.25 },
        individual: { basePrice: customProduct.price }
      },
      quantityType: customProduct.quantityType,
      oneflowCompatible: true,
      contractDescription: `${customProduct.name} - ${customProduct.description}`,
      defaultQuantity: customProduct.quantity,
      maxQuantity: 999,
      rotEligible: false,
      rutEligible: false,
      isPopular: false,
      seasonalAvailable: false,
      requiresConsultation: false
    }

    // Lägg till i anpassade produkter listan
    setCustomProducts(prev => [...prev, customProduct])

    // Lägg till produkten direkt i valda produkter
    const selectedProduct: SelectedProduct = {
      product: productItem,
      quantity: customProduct.quantity
    }

    const updatedProducts = [...selectedProducts, selectedProduct]
    onSelectionChange(updatedProducts)
  }

  // Ta bort anpassad produkt
  const handleRemoveCustomProduct = (customProductId: string) => {
    setCustomProducts(prev => prev.filter(cp => cp.id !== customProductId))
    const updatedProducts = selectedProducts.filter(sp => sp.product.id !== customProductId)
    onSelectionChange(updatedProducts)
  }

  // Få vald produkt för ett produktID
  const getSelectedProduct = (productId: string): SelectedProduct | undefined => {
    return selectedProducts.find(sp => sp.product.id === productId)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Sök och filter */}
      <div className="space-y-4">
        <Input
          placeholder="Sök produkter och tjänster..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            Alla kategorier ({allProducts.length})
          </Button>
          {(['pest_control', 'preventive', 'specialty', 'additional'] as ProductCategory[]).map(category => {
            const count = allProducts.filter(p => p.category === category).length
            if (count === 0) return null
            
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="flex items-center gap-2"
              >
                <span>{getCategoryIcon(category)}</span>
                {getCategoryName(category)} ({count})
              </Button>
            )
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Laddar produkter...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card className="p-6 bg-red-500/10 border-red-500/20">
          <div className="text-red-400 text-center">
            <strong>Fel:</strong> {error}
          </div>
        </Card>
      )}

      {/* Anpassad produkt kort */}
      {!loading && !error && (
        <CustomProductCard
          customerType={customerType}
          onAddCustomProduct={handleAddCustomProduct}
        />
      )}

      {/* Valda anpassade produkter */}
      {customProducts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            Dina anpassade produkter ({customProducts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customProducts.map(customProduct => {
              // Skapa en temporär ProductItem för att använda befintlig ProductCard
              const productItem: ProductItem = {
                id: customProduct.id,
                name: customProduct.name,
                description: customProduct.description,
                category: 'additional' as ProductCategory,
                pricing: {
                  company: { basePrice: customProduct.price, vatRate: 0.25 },
                  individual: { basePrice: customProduct.price }
                },
                quantityType: customProduct.quantityType,
                oneflowCompatible: true,
                contractDescription: `${customProduct.name} - ${customProduct.description}`,
                defaultQuantity: customProduct.quantity,
                maxQuantity: 999,
                rotEligible: false,
                rutEligible: false,
                isPopular: false,
                seasonalAvailable: false,
                requiresConsultation: false
              }

              return (
                <div key={customProduct.id} className="relative">
                  <ProductCard
                    product={productItem}
                    selectedProduct={getSelectedProduct(customProduct.id)}
                    customerType={customerType}
                    onQuantityChange={handleQuantityChange}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCustomProduct(customProduct.id)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-300 bg-slate-800/80"
                    title="Ta bort anpassad produkt"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Produktgrupper och produkter */}
      {!loading && !error && (
        <div className="space-y-8">
          {filteredGroups.map(group => (
            <div key={group.id}>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">{group.icon}</span>
                  {group.name}
                </h2>
                <p className="text-slate-400 text-sm mt-1">{group.description}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    selectedProduct={getSelectedProduct(product.id)}
                    customerType={customerType}
                    onQuantityChange={handleQuantityChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ingen träff */}
      {!loading && !error && filteredGroups.length === 0 && allProducts.length > 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">Inga produkter hittades</h3>
          <p className="text-slate-400">Försök med andra sökord eller välj en annan kategori</p>
        </div>
      )}
    </div>
  )
}