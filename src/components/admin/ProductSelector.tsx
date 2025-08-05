// src/components/admin/ProductSelector.tsx - Produktväljare för Oneflow

import React, { useState, useMemo } from 'react'
import { Search, Plus, Minus, Info, Star, Leaf, ShieldCheck } from 'lucide-react'
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
import { BEGONE_PRODUCT_GROUPS } from '../../data/begoneProducts'
import { calculateProductPrice, formatPrice } from '../../utils/pricingCalculator'

interface ProductSelectorProps {
  selectedProducts: SelectedProduct[]
  onSelectionChange: (products: SelectedProduct[]) => void
  customerType: CustomerType
  className?: string
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
    const maxQty = product.maxQuantity || 99
    
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
              disabled={quantity >= (product.maxQuantity || 99)}
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

// Huvudkomponent
export default function ProductSelector({
  selectedProducts,
  onSelectionChange,
  customerType,
  className = ''
}: ProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all')

  // Filtrerade produktgrupper
  const filteredGroups = useMemo(() => {
    return BEGONE_PRODUCT_GROUPS
      .filter(group => selectedCategory === 'all' || group.category === selectedCategory)
      .map(group => ({
        ...group,
        products: group.products.filter(product =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }))
      .filter(group => group.products.length > 0)
  }, [searchTerm, selectedCategory])

  // Hantera kvantitetsändringar
  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      // Ta bort produkt
      const updatedProducts = selectedProducts.filter(sp => sp.product.id !== productId)
      onSelectionChange(updatedProducts)
    } else {
      // Hitta produkten
      const allProducts = BEGONE_PRODUCT_GROUPS.flatMap(g => g.products)
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
            Alla kategorier
          </Button>
          {BEGONE_PRODUCT_GROUPS.map(group => (
            <Button
              key={group.id}
              variant={selectedCategory === group.category ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(group.category)}
              className="flex items-center gap-2"
            >
              <span>{getCategoryIcon(group.category)}</span>
              {group.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Produktgrupper och produkter */}
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

      {/* Ingen träff */}
      {filteredGroups.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">Inga produkter hittades</h3>
          <p className="text-slate-400">Försök med andra sökord eller välj en annan kategori</p>
        </div>
      )}
    </div>
  )
}