// src/components/admin/ProductManagement.tsx - Admin produkthantering

import React, { useState, useMemo, useEffect } from 'react'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  ShieldCheck, 
  Leaf, 
  Star,
  Save,
  X,
  Package,
  DollarSign,
  Info,
  ArrowLeft,
  Copy,
  Minus
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { 
  ProductItem, 
  ProductGroup, 
  ProductCategory, 
  CustomerType,
  PriceVariant 
} from '../../types/products'
import { formatPrice } from '../../utils/pricingCalculator'
import { useProducts } from '../../services/productService'
import toast from 'react-hot-toast'

interface ProductManagementProps {
  className?: string
}

interface ProductFormData {
  id?: string
  name: string
  description: string
  category: ProductCategory
  pricing: {
    company: {
      basePrice: number
      vatRate: number
      discountPercent?: number
    }
    individual: {
      basePrice: number
      taxDeduction?: 'rot' | 'rut'
      discountPercent?: number
    }
  }
  priceVariants: PriceVariant[]  // Prisvarianter
  quantityType: 'quantity' | 'single_choice' | 'multiple_choice'
  oneflowCompatible: boolean
  defaultQuantity: number
  maxQuantity: number
  isPopular: boolean
  rotEligible: boolean
  rutEligible: boolean
  contractDescription: string
  seasonalAvailable?: boolean
  requiresConsultation?: boolean
}

// Kategori-ikon mapping
const getCategoryIcon = (category: ProductCategory): string => {
  switch (category) {
    case 'pest_control': return '🐭'
    case 'preventive': return '🛡️'
    case 'specialty': return '🧹'
    case 'additional': return '📋'
    default: return '•'
  }
}

// Kategori-namn mapping
const getCategoryName = (category: ProductCategory): string => {
  switch (category) {
    case 'pest_control': return 'Skadedjursbekämpning'
    case 'preventive': return 'Förebyggande'
    case 'specialty': return 'Specialtjänster'
    case 'additional': return 'Tilläggstjänster'
    default: return category
  }
}

export default function ProductManagement({ className = '' }: ProductManagementProps) {
  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Använd produkthook för databas-integration
  const { 
    products, 
    loading: isLoading, 
    error,
    createProduct, 
    updateProduct, 
    deleteProduct 
  } = useProducts()

  // Filtrerade produkter med memoization
  const filteredProducts = useMemo(() => {
    if (!products.length) return []
    
    return products.filter(product => {
      const matchesSearch = !debouncedSearchTerm || 
        product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
      
      return matchesSearch && matchesCategory
    })
  }, [products, debouncedSearchTerm, selectedCategory])

  // Kategori-räknare
  const categoryCounts = useMemo(() => {
    const counts = {
      all: products.length,
      pest_control: 0,
      preventive: 0,
      specialty: 0,
      additional: 0
    }
    
    products.forEach(product => {
      counts[product.category]++
    })
    
    return counts
  }, [products])

  // Hantera ny produkt
  const handleNewProduct = () => {
    setEditingProduct(null)
    setIsModalOpen(true)
  }

  // Hantera redigering
  const handleEditProduct = (product: ProductItem) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  // Hantera borttagning
  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna produkt?')) {
      return
    }

    try {
      await deleteProduct(productId)
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      // Felmeddelande hanteras redan i useProducts hook
    }
  }

  // Hantera spara produkt  
  const handleSaveProduct = async (productData: ProductFormData) => {
    try {
      const newProduct: ProductItem = {
        id: productData.id || `custom-${Date.now()}`,
        name: productData.name,
        description: productData.description,
        category: productData.category,
        pricing: productData.pricing,
        priceVariants: productData.priceVariants.length > 0 ? productData.priceVariants : undefined,
        quantityType: productData.quantityType,
        oneflowCompatible: productData.oneflowCompatible,
        defaultQuantity: productData.defaultQuantity,
        maxQuantity: productData.maxQuantity,
        isPopular: productData.isPopular,
        rotEligible: productData.rotEligible,
        rutEligible: productData.rutEligible,
        contractDescription: productData.contractDescription,
        seasonalAvailable: productData.seasonalAvailable,
        requiresConsultation: productData.requiresConsultation
      }

      if (productData.id) {
        // Uppdatera befintlig produkt
        await updateProduct(newProduct)
      } else {
        // Skapa ny produkt
        await createProduct(newProduct)
      }

      setIsModalOpen(false)
    } catch (error) {
      console.error('Fel vid sparande:', error)
      // Felmeddelande hanteras redan i useProducts hook
      throw error
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="w-8 h-8 text-green-400" />
              Produkthantering
            </h1>
            <p className="text-slate-400 mt-1">
              Hantera produkter och tjänster för avtal och offerter
            </p>
          </div>
        </div>
        
        <Button
          variant="primary"
          onClick={handleNewProduct}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ny produkt
        </Button>
      </div>

      {/* Felmeddelande */}
      {error && (
        <Card className="p-4 bg-red-500/10 border-red-500/20">
          <div className="text-red-400">
            <strong>Fel:</strong> {error}
          </div>
        </Card>
      )}

      {/* Sök och filter */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="relative">
            <Input
              placeholder="Sök produkter efter namn eller beskrivning..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              className="pr-20"
            />
            {(searchTerm !== debouncedSearchTerm) && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          {debouncedSearchTerm && (
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>
                Visar {filteredProducts.length} av {products.length} produkter
                {debouncedSearchTerm && (
                  <span> för "<span className="text-white font-medium">{debouncedSearchTerm}</span>"</span>
                )}
              </span>
              {debouncedSearchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-white"
                >
                  Rensa
                </Button>
              )}
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="relative"
            >
              Alla kategorier 
              <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                selectedCategory === 'all' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {categoryCounts.all}
              </span>
            </Button>
            {['pest_control', 'preventive', 'specialty', 'additional'].map(category => {
              const count = categoryCounts[category as keyof typeof categoryCounts]
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category as ProductCategory)}
                  className="flex items-center gap-2 relative"
                  disabled={count === 0}
                >
                  <span>{getCategoryIcon(category as ProductCategory)}</span>
                  {getCategoryName(category as ProductCategory)}
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    selectedCategory === category 
                      ? 'bg-white/20 text-white' 
                      : count === 0 
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-slate-700 text-slate-300'
                  }`}>
                    {count}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Produktlista */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-700 rounded"></div>
                  <div className="h-5 bg-slate-700 rounded w-32"></div>
                </div>
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                <div className="flex justify-between">
                  <div className="h-4 bg-slate-700 rounded w-20"></div>
                  <div className="h-4 bg-slate-700 rounded w-24"></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <div className="h-8 bg-slate-700 rounded flex-1"></div>
                  <div className="h-8 w-8 bg-slate-700 rounded"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => handleEditProduct(product)}
              onDelete={() => handleDeleteProduct(product.id)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Ingen träff */}
      {filteredProducts.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Inga produkter hittades
          </h3>
          <p className="text-slate-400">
            Försök med andra sökord eller skapa en ny produkt
          </p>
        </Card>
      )}

      {/* Modal för redigering */}
      {isModalOpen && (
        <ProductModal
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}

// Produktkort komponent
interface ProductCardProps {
  product: ProductItem
  onEdit: () => void
  onDelete: () => void
  isLoading: boolean
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onEdit, 
  onDelete, 
  isLoading 
}) => {
  return (
    <Card className="p-6 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/20 transition-all duration-200 group">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                <span className="text-lg">{getCategoryIcon(product.category)}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white group-hover:text-green-400 transition-colors">
                    {product.name}
                  </h3>
                  {product.isPopular && (
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  )}
                </div>
                <p className="text-xs text-slate-500 capitalize">
                  {getCategoryName(product.category)}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
              {product.description}
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {product.rotEligible && (
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              ROT
            </span>
          )}
          {product.rutEligible && (
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
              <Leaf className="w-3 h-3" />
              RUT
            </span>
          )}
          {product.requiresConsultation && (
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
              <Info className="w-3 h-3" />
              Konsult
            </span>
          )}
          {!product.oneflowCompatible && (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
              Ej Oneflow
            </span>
          )}
          {product.priceVariants && product.priceVariants.length > 0 && (
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
              <Copy className="w-3 h-3" />
              {product.priceVariants.length} varianter
            </span>
          )}
        </div>

        {/* Priser */}
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
          {product.priceVariants && product.priceVariants.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Copy className="w-3 h-3" />
                  Prisintervall ({product.priceVariants.length} varianter)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Företag
                </span>
                <div className="text-right">
                  <span className="text-white font-semibold">
                    {formatPrice(Math.min(...product.priceVariants.map(v => v.pricing.company.basePrice)))} - {formatPrice(Math.max(...product.priceVariants.map(v => v.pricing.company.basePrice)))}
                  </span>
                  <span className="text-xs text-slate-400 block">+ moms</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Privatperson
                </span>
                <div className="text-right">
                  <span className="text-white font-semibold">
                    {formatPrice(Math.min(...product.priceVariants.map(v => v.pricing.individual.basePrice)))} - {formatPrice(Math.max(...product.priceVariants.map(v => v.pricing.individual.basePrice)))}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Företag
                </span>
                <div className="text-right">
                  <span className="text-white font-semibold">
                    {formatPrice(product.pricing.company.basePrice)}
                  </span>
                  <span className="text-xs text-slate-400 block">+ moms</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Privatperson
                </span>
                <div className="text-right">
                  <span className="text-white font-semibold">
                    {formatPrice(product.pricing.individual.basePrice)}
                  </span>
                  {product.pricing.individual.taxDeduction && (
                    <span className="text-xs text-green-400 block uppercase">
                      {product.pricing.individual.taxDeduction}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Åtgärder */}
        <div className="flex gap-3 pt-4 border-t border-slate-700/50">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 hover:border-green-500/50 hover:text-green-400 transition-all duration-200 group/edit"
          >
            <Edit2 className="w-4 h-4 group-hover/edit:scale-110 transition-transform duration-200" />
            Redigera
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 group/delete"
            title="Ta bort produkt"
          >
            <Trash2 className="w-4 h-4 group-hover/delete:scale-110 transition-transform duration-200" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Modal för produktredigering
interface ProductModalProps {
  product: ProductItem | null
  onSave: (product: ProductFormData) => void
  onClose: () => void
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState<ProductFormData>(() => {
    if (product) {
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        pricing: {
          company: {
            basePrice: product.pricing.company.basePrice,
            vatRate: product.pricing.company.vatRate || 0.25,
            discountPercent: product.pricing.company.discountPercent || 0
          },
          individual: {
            basePrice: product.pricing.individual.basePrice,
            taxDeduction: product.pricing.individual.taxDeduction,
            discountPercent: product.pricing.individual.discountPercent || 0
          }
        },
        priceVariants: product.priceVariants || [],
        quantityType: product.quantityType,
        oneflowCompatible: product.oneflowCompatible,
        defaultQuantity: product.defaultQuantity,
        maxQuantity: product.maxQuantity || 999,
        isPopular: product.isPopular,
        rotEligible: product.rotEligible,
        rutEligible: product.rutEligible,
        contractDescription: product.contractDescription,
        seasonalAvailable: product.seasonalAvailable || false,
        requiresConsultation: product.requiresConsultation || false
      }
    } else {
      return {
        name: '',
        description: '',
        category: 'additional',
        pricing: {
          company: {
            basePrice: 0,
            vatRate: 0.25,
            discountPercent: 0
          },
          individual: {
            basePrice: 0,
            discountPercent: 0
          }
        },
        priceVariants: [],
        quantityType: 'quantity',
        oneflowCompatible: true,
        defaultQuantity: 1,
        maxQuantity: 999,
        isPopular: false,
        rotEligible: false,
        rutEligible: false,
        contractDescription: '',
        seasonalAvailable: false,
        requiresConsultation: false
      }
    }
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.description || formData.pricing.company.basePrice <= 0) {
      toast.error('Fyll i alla obligatoriska fält')
      return
    }

    setIsSubmitting(true)
    try {
      await onSave(formData)
      toast.success(product ? 'Produkten uppdaterades' : 'Produkten skapades')
    } catch (error) {
      toast.error('Ett fel uppstod')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (path: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev }
      const keys = path.split('.')
      let current: any = newData
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newData
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={product ? 'Redigera produkt' : 'Ny produkt'}
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Grundinformation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-green-400" />
              Grundinformation
            </h3>
            
            <Input
              label="Produktnamn *"
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="T.ex. Rått- och musbekämpning"
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning *
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={3}
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Detaljerad beskrivning av tjänsten..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kategori *
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={formData.category}
                onChange={(e) => updateFormData('category', e.target.value)}
                required
              >
                <option value="pest_control">🐭 Skadedjursbekämpning</option>
                <option value="preventive">🛡️ Förebyggande</option>
                <option value="specialty">🧹 Specialtjänster</option>
                <option value="additional">📋 Tilläggstjänster</option>
              </select>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h4 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-green-400" />
                Kontraktsbeskrivning
              </h4>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning *
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={4}
                value={formData.contractDescription}
                onChange={(e) => updateFormData('contractDescription', e.target.value)}
                placeholder="Beskrivning som visas i kontrakt..."
                required
              />
            </div>
          </div>

          {/* Prissättning */}
          <div className="space-y-4 border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              Prissättning
            </h3>

            {/* Företagspriser */}
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-3">Företagskunder</h4>
              <div className="space-y-3">
                <Input
                  label="Grundpris (exkl. moms) *"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.pricing.company.basePrice}
                  onChange={(e) => updateFormData('pricing.company.basePrice', Number(e.target.value))}
                  placeholder="2490"
                  helperText="Ange pris i hela kronor"
                  required
                />
                
                <Input
                  label="Rabatt (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.pricing.company.discountPercent}
                  onChange={(e) => updateFormData('pricing.company.discountPercent', Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Privatpriser */}
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-3">Privatpersoner</h4>
              <div className="space-y-3">
                <Input
                  label="Grundpris (inkl. moms) *"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.pricing.individual.basePrice}
                  onChange={(e) => updateFormData('pricing.individual.basePrice', Number(e.target.value))}
                  placeholder="3490"
                  helperText="Ange pris i hela kronor"
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Skatteavdrag
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={formData.pricing.individual.taxDeduction || ''}
                    onChange={(e) => updateFormData('pricing.individual.taxDeduction', e.target.value || undefined)}
                  >
                    <option value="">Ingen</option>
                    <option value="rot">ROT-avdrag</option>
                    <option value="rut">RUT-avdrag</option>
                  </select>
                </div>

                <Input
                  label="Rabatt (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.pricing.individual.discountPercent}
                  onChange={(e) => updateFormData('pricing.individual.discountPercent', Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Prisvarianter */}
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-600/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-white flex items-center gap-2">
                  <Copy className="w-4 h-4 text-green-400" />
                  Prisvarianter
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newVariant: PriceVariant = {
                      id: `variant-${Date.now()}`,
                      name: '',
                      description: '',
                      pricing: {
                        company: {
                          basePrice: formData.pricing.company.basePrice,
                          vatRate: formData.pricing.company.vatRate,
                          discountPercent: formData.pricing.company.discountPercent || 0
                        },
                        individual: {
                          basePrice: formData.pricing.individual.basePrice,
                          taxDeduction: formData.pricing.individual.taxDeduction,
                          discountPercent: formData.pricing.individual.discountPercent || 0
                        }
                      },
                      isDefault: formData.priceVariants.length === 0,
                      sortOrder: formData.priceVariants.length
                    }
                    updateFormData('priceVariants', [...formData.priceVariants, newVariant])
                  }}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Lägg till variant
                </Button>
              </div>
              
              <p className="text-xs text-slate-400 mb-4">
                Skapa olika prisalternativ för samma produkt (t.ex. olika storlekar, arbetstider, eller omfattning)
              </p>

              {formData.priceVariants.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Copy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Inga prisvarianter ännu</p>
                  <p className="text-xs">Klicka "Lägg till variant" för att skapa alternativ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.priceVariants.map((variant, index) => (
                    <div key={variant.id} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600/30">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded">
                            #{index + 1}
                          </span>
                          {variant.isDefault && (
                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                              Standard
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const variants = [...formData.priceVariants]
                              variants[index] = { ...variants[index], isDefault: !variants[index].isDefault }
                              // Ta bort default från andra
                              if (variants[index].isDefault) {
                                variants.forEach((v, i) => {
                                  if (i !== index) v.isDefault = false
                                })
                              }
                              updateFormData('priceVariants', variants)
                            }}
                            className="text-green-400 hover:text-green-300 px-2"
                            title={variant.isDefault ? "Ta bort som standard" : "Sätt som standard"}
                          >
                            <Star className={`w-3 h-3 ${variant.isDefault ? 'fill-current' : ''}`} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              updateFormData('priceVariants', formData.priceVariants.filter((_, i) => i !== index))
                            }}
                            className="text-red-400 hover:text-red-300 px-2"
                            title="Ta bort variant"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <Input
                            label="Variantnamn *"
                            value={variant.name}
                            onChange={(e) => {
                              const variants = [...formData.priceVariants]
                              variants[index] = { ...variants[index], name: e.target.value }
                              updateFormData('priceVariants', variants)
                            }}
                            placeholder="t.ex. 2 sovrum + vardagsrum"
                            className="text-sm"
                          />
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Beskrivning
                            </label>
                            <textarea
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm"
                              rows={2}
                              value={variant.description || ''}
                              onChange={(e) => {
                                const variants = [...formData.priceVariants]
                                variants[index] = { ...variants[index], description: e.target.value }
                                updateFormData('priceVariants', variants)
                              }}
                              placeholder="Detaljerad beskrivning..."
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              label="Företag (exkl. moms)"
                              type="number"
                              min="0"
                              step="1"
                              value={variant.pricing.company.basePrice}
                              onChange={(e) => {
                                const variants = [...formData.priceVariants]
                                variants[index] = {
                                  ...variants[index],
                                  pricing: {
                                    ...variants[index].pricing,
                                    company: {
                                      ...variants[index].pricing.company,
                                      basePrice: Number(e.target.value)
                                    }
                                  }
                                }
                                updateFormData('priceVariants', variants)
                              }}
                              className="text-sm"
                            />
                            <Input
                              label="Privatperson (inkl. moms)"
                              type="number"
                              min="0"
                              step="1"
                              value={variant.pricing.individual.basePrice}
                              onChange={(e) => {
                                const variants = [...formData.priceVariants]
                                variants[index] = {
                                  ...variants[index],
                                  pricing: {
                                    ...variants[index].pricing,
                                    individual: {
                                      ...variants[index].pricing.individual,
                                      basePrice: Number(e.target.value)
                                    }
                                  }
                                }
                                updateFormData('priceVariants', variants)
                              }}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Konfiguration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Kvantitet</h3>
            
            <div className="bg-slate-800/50 p-4 rounded-lg space-y-4">
              <h4 className="font-medium text-white">Kvantitetsinställningar</h4>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Kvantitetstyp
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={formData.quantityType}
                  onChange={(e) => updateFormData('quantityType', e.target.value)}
                >
                  <option value="quantity">Kvantitet (kan ändras)</option>
                  <option value="single_choice">Ja/Nej val</option>
                  <option value="multiple_choice">Flera val</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Standardantal"
                  type="number"
                  min="1"
                  max="999"
                  value={formData.defaultQuantity}
                  onChange={(e) => updateFormData('defaultQuantity', Number(e.target.value))}
                />
                
                <Input
                  label="Max antal"
                  type="number"
                  min="1"
                  max="999"
                  value={formData.maxQuantity}
                  onChange={(e) => updateFormData('maxQuantity', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              Egenskaper
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.oneflowCompatible}
                  onChange={(e) => updateFormData('oneflowCompatible', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Oneflow-kompatibel</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.isPopular}
                  onChange={(e) => updateFormData('isPopular', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Populär produkt</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.rotEligible}
                  onChange={(e) => updateFormData('rotEligible', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">ROT-berättigad</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.rutEligible}
                  onChange={(e) => updateFormData('rutEligible', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">RUT-berättigad</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.seasonalAvailable}
                  onChange={(e) => updateFormData('seasonalAvailable', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Säsongstillgänglig</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.requiresConsultation}
                  onChange={(e) => updateFormData('requiresConsultation', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Kräver konsultation</span>
              </label>
            </div>
          </div>
        </div>

        {/* Åtgärdsknappar */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {product ? 'Uppdatera' : 'Skapa'} produkt
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}