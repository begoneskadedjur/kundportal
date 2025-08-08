// src/components/admin/ProductsViewer.tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight, Package, DollarSign, Hash, FileText, Edit3 } from 'lucide-react'
import Button from '../ui/Button'

interface Product {
  id?: string
  name: string
  description?: string
  quantity?: number
  price?: number
  category?: string
  [key: string]: any
}

interface ProductsViewerProps {
  products: any
  onEdit?: () => void
  editable?: boolean
}

export default function ProductsViewer({ products, onEdit, editable = false }: ProductsViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  if (!products) {
    return (
      <div className="group">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-slate-400">Produkter</label>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 text-center">
          Inga produkter angivna
        </div>
      </div>
    )
  }

  // Försök parsa JSON om det är en sträng
  let parsedProducts: Product[] = []
  try {
    if (typeof products === 'string') {
      parsedProducts = JSON.parse(products)
    } else if (Array.isArray(products)) {
      parsedProducts = products
    } else if (typeof products === 'object') {
      // Om det är ett objekt, konvertera till array
      parsedProducts = [products]
    }
  } catch (error) {
    console.error('Error parsing products:', error)
  }

  if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
    return (
      <div className="group">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm text-slate-400">Produkter</label>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 text-center">
          Ogiltigt produktformat
        </div>
      </div>
    )
  }

  const toggleProductExpanded = (productId: string) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
    }
    setExpandedProducts(newExpanded)
  }

  const formatPrice = (price: number | string | undefined) => {
    if (!price) return '-'
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    if (isNaN(numPrice)) return price.toString()
    
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(numPrice)
  }

  const getProductIcon = (category?: string) => {
    if (!category) return <Package className="w-4 h-4 text-blue-400" />
    
    switch (category.toLowerCase()) {
      case 'pest_control':
        return <span className="text-sm">🐭</span>
      case 'preventive':
        return <span className="text-sm">🛡️</span>
      case 'specialty':
        return <span className="text-sm">🧹</span>
      case 'additional':
        return <span className="text-sm">📋</span>
      default:
        return <Package className="w-4 h-4 text-blue-400" />
    }
  }

  const totalValue = parsedProducts.reduce((sum, product) => {
    const price = typeof product.price === 'string' ? parseFloat(product.price) : (product.price || 0)
    const quantity = product.quantity || 1
    return sum + (price * quantity)
  }, 0)

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm text-slate-400">Produkter ({parsedProducts.length})</label>
        <div className="flex items-center gap-2">
          {totalValue > 0 && (
            <span className="text-sm text-green-400 font-medium">
              {formatPrice(totalValue)}
            </span>
          )}
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit3 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        {/* Header med sammanfattning */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-800/70 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-white font-medium">
                {parsedProducts.length} {parsedProducts.length === 1 ? 'produkt' : 'produkter'}
              </div>
              {totalValue > 0 && (
                <div className="text-sm text-slate-400">
                  Totalt värde: {formatPrice(totalValue)}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </button>

        {/* Expanderad produktlista */}
        {isExpanded && (
          <div className="border-t border-slate-700">
            {parsedProducts.map((product, index) => {
              const productId = product.id || `product-${index}`
              const isProductExpanded = expandedProducts.has(productId)
              
              return (
                <div key={productId} className="border-b border-slate-700 last:border-b-0">
                  <button
                    onClick={() => toggleProductExpanded(productId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {getProductIcon(product.category)}
                      <div>
                        <div className="text-white font-medium">
                          {product.name || `Produkt ${index + 1}`}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          {product.quantity && (
                            <div className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              <span>{product.quantity}</span>
                            </div>
                          )}
                          {product.price && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              <span>{formatPrice(product.price)}</span>
                            </div>
                          )}
                          {product.category && (
                            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">
                              {product.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {product.price && product.quantity && (
                        <span className="text-green-400 font-medium text-sm">
                          {formatPrice(product.price * product.quantity)}
                        </span>
                      )}
                      {isProductExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Detaljerad produktinformation */}
                  {isProductExpanded && (
                    <div className="px-4 pb-4 bg-slate-900/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-900/50 rounded-lg">
                        {product.description && (
                          <div className="md:col-span-2">
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                              <FileText className="w-3 h-3" />
                              <span>Beskrivning</span>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">
                              {product.description}
                            </p>
                          </div>
                        )}
                        
                        {/* Visa alla andra properties */}
                        {Object.entries(product).map(([key, value]) => {
                          if (['id', 'name', 'description', 'quantity', 'price', 'category'].includes(key)) {
                            return null
                          }
                          
                          return (
                            <div key={key}>
                              <div className="text-xs text-slate-400 mb-1 capitalize">
                                {key.replace(/_/g, ' ')}
                              </div>
                              <div className="text-sm text-slate-300">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}