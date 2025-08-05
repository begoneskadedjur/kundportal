// src/components/admin/ProductSummary.tsx - Sammanfattning av valda produkter

import React from 'react'
import { Edit2, Trash2, ShieldCheck, Leaf, Info, Calculator } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { 
  SelectedProduct, 
  CustomerType, 
  PriceSummary,
  ProductCategory 
} from '../../types/products'
import { 
  calculatePriceSummary, 
  formatPrice,
  calculateVolumeDiscount,
  calculateSeasonalDiscount
} from '../../utils/pricingCalculator'

interface ProductSummaryProps {
  selectedProducts: SelectedProduct[]
  customerType: CustomerType
  onEditProduct?: (productId: string) => void
  onRemoveProduct?: (productId: string) => void
  showDetailedBreakdown?: boolean
  className?: string
}

interface ProductLineProps {
  selectedProduct: SelectedProduct
  customerType: CustomerType
  onEdit?: () => void
  onRemove?: () => void
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

// Produktrad-komponent
const ProductLine: React.FC<ProductLineProps> = ({
  selectedProduct,
  customerType,
  onEdit,
  onRemove
}) => {
  const { product, quantity, notes } = selectedProduct
  const pricing = product.pricing[customerType]
  const unitPrice = pricing.discountPercent 
    ? pricing.basePrice * (1 - pricing.discountPercent / 100)
    : pricing.basePrice
  const totalPrice = unitPrice * quantity

  return (
    <div className="flex items-start justify-between p-4 border border-slate-700 rounded-lg bg-slate-800/30">
      <div className="flex-1">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getCategoryIcon(product.category)}</span>
              <h4 className="font-medium text-white">{product.name}</h4>
              <span className="text-slate-400 text-sm">× {quantity}</span>
            </div>
            
            {/* Badges */}
            <div className="flex gap-2 mt-1">
              {product.rotEligible && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                  <ShieldCheck className="w-3 h-3 inline mr-1" />
                  ROT
                </span>
              )}
              {product.rutEligible && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  <Leaf className="w-3 h-3 inline mr-1" />
                  RUT
                </span>
              )}
              {product.requiresConsultation && (
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                  <Info className="w-3 h-3 inline mr-1" />
                  Konsult
                </span>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-white font-semibold">
              {formatPrice(totalPrice)}
            </div>
            <div className="text-xs text-slate-400">
              {formatPrice(unitPrice)} / st
            </div>
          </div>
        </div>
        
        {notes && (
          <div className="text-sm text-slate-400 bg-slate-900 p-2 rounded">
            <strong>Anteckning:</strong> {notes}
          </div>
        )}
      </div>
      
      {/* Åtgärdsknappar */}
      <div className="flex gap-2 ml-4">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="p-2"
            title="Redigera"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="p-2 text-red-400 hover:text-red-300"
            title="Ta bort"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// Prisuppdelning-komponent
interface PriceBreakdownProps {
  priceSummary: PriceSummary
  customerType: CustomerType
  volumeDiscount?: number
  seasonalDiscount?: number
}

const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  priceSummary,
  customerType,
  volumeDiscount = 0,
  seasonalDiscount = 0
}) => {
  const totalDiscounts = volumeDiscount + seasonalDiscount

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-slate-300">
        <span>Grundpris:</span>
        <span>{formatPrice(priceSummary.subtotal)}</span>
      </div>
      
      {totalDiscounts > 0 && (
        <div className="flex justify-between text-green-400">
          <span>Rabatter:</span>
          <span>-{formatPrice(totalDiscounts)}</span>
        </div>
      )}
      
      {priceSummary.vatAmount > 0 && (
        <div className="flex justify-between text-slate-300">
          <span>Moms (25%):</span>
          <span>{formatPrice(priceSummary.vatAmount)}</span>
        </div>
      )}
      
      <div className="border-t border-slate-600 pt-2">
        <div className="flex justify-between font-semibold text-white">
          <span>Totalt före avdrag:</span>
          <span>{formatPrice(priceSummary.totalBeforeDeduction - totalDiscounts)}</span>
        </div>
      </div>
      
      {priceSummary.taxDeductionAmount > 0 && (
        <>
          <div className="flex justify-between text-green-400">
            <span>
              {priceSummary.deductionType?.toUpperCase()}-avdrag:
            </span>
            <span>-{formatPrice(priceSummary.taxDeductionAmount)}</span>
          </div>
          
          <div className="border-t border-slate-600 pt-2">
            <div className="flex justify-between font-bold text-lg text-green-400">
              <span>Att betala:</span>
              <span>{formatPrice(priceSummary.totalAfterDeduction - totalDiscounts)}</span>
            </div>
          </div>
        </>
      )}
      
      {customerType === 'individual' && priceSummary.deductionType && (
        <div className="text-xs text-slate-400 bg-slate-900 p-2 rounded">
          <Info className="w-3 h-3 inline mr-1" />
          {priceSummary.deductionType === 'rot' && 
            'ROT-avdraget dras av direkt från din skatt (30% av arbetskostnaden).'
          }
          {priceSummary.deductionType === 'rut' && 
            'RUT-avdraget dras av direkt från din skatt (50% av arbetskostnaden).'
          }
        </div>
      )}
    </div>
  )
}

// Huvudkomponent
export default function ProductSummary({
  selectedProducts,
  customerType,
  onEditProduct,
  onRemoveProduct,
  showDetailedBreakdown = false,
  className = ''
}: ProductSummaryProps) {
  if (selectedProducts.length === 0) {
    return (
      <Card className={`p-8 text-center ${className}`}>
        <div className="text-6xl mb-4">🛒</div>
        <h3 className="text-lg font-semibold text-white mb-2">Inga produkter valda</h3>
        <p className="text-slate-400">Välj produkter och tjänster för att se en sammanfattning här</p>
      </Card>
    )
  }

  // Beräkna priser och rabatter
  const priceSummary = calculatePriceSummary(selectedProducts, customerType)
  const volumeDiscount = calculateVolumeDiscount(selectedProducts, customerType)
  const seasonalDiscount = calculateSeasonalDiscount(selectedProducts, customerType)
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Valda produkter */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">
            Valda produkter ({selectedProducts.length})
          </h3>
        </div>
        
        <div className="space-y-3">
          {selectedProducts.map(selectedProduct => (
            <ProductLine
              key={selectedProduct.product.id}
              selectedProduct={selectedProduct}
              customerType={customerType}
              onEdit={onEditProduct ? () => onEditProduct(selectedProduct.product.id) : undefined}
              onRemove={onRemoveProduct ? () => onRemoveProduct(selectedProduct.product.id) : undefined}
            />
          ))}
        </div>
      </Card>

      {/* Prissammanfattning */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Prissammanfattning</h3>
        
        <PriceBreakdown
          priceSummary={priceSummary}
          customerType={customerType}
          volumeDiscount={volumeDiscount}
          seasonalDiscount={seasonalDiscount}
        />
      </Card>

      {/* Detaljerad uppdelning per kategori */}
      {showDetailedBreakdown && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Uppdelning per kategori</h3>
          
          <div className="space-y-4">
            {Object.entries(priceSummary.breakdown).map(([category, breakdown]) => (
              <div key={category} className="border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{getCategoryIcon(category as ProductCategory)}</span>
                    <span className="font-medium text-white capitalize">
                      {category.replace('_', ' ')}
                    </span>
                    <span className="text-slate-400 text-sm">
                      ({breakdown.quantity} st)
                    </span>
                  </div>
                  <span className="font-semibold text-white">
                    {formatPrice(breakdown.subtotal)}
                  </span>
                </div>
                
                <div className="text-sm text-slate-400">
                  {breakdown.products.map(sp => sp.product.name).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Rabattinformation */}
      {(volumeDiscount > 0 || seasonalDiscount > 0) && (
        <Card className="p-4 bg-green-500/10 border-green-500/20">
          <h4 className="font-semibold text-green-400 mb-2">🎉 Aktiva rabatter</h4>
          <div className="space-y-1 text-sm">
            {volumeDiscount > 0 && (
              <div className="text-green-300">
                Volymrabatt: {formatPrice(volumeDiscount)}
              </div>
            )}
            {seasonalDiscount > 0 && (
              <div className="text-green-300">
                Säsongsrabatt: {formatPrice(seasonalDiscount)}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}