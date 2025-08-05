// src/components/admin/ProductManagement.tsx - Admin produkthantering

import React, { useState } from 'react'
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
  Info
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { 
  ProductItem, 
  ProductGroup, 
  ProductCategory, 
  CustomerType 
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
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)

  // Använd produkthook för databas-integration
  const { 
    products, 
    loading: isLoading, 
    error,
    createProduct, 
    updateProduct, 
    deleteProduct 
  } = useProducts()

  // Filtrerade produkter
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

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
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="w-8 h-8 text-green-400" />
            Produkthantering
          </h1>
          <p className="text-slate-400 mt-1">
            Hantera produkter och tjänster för avtal och offerter
          </p>
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
          <Input
            placeholder="Sök produkter..."
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
              Alla kategorier ({products.length})
            </Button>
            {['pest_control', 'preventive', 'specialty', 'additional'].map(category => {
              const count = products.filter(p => p.category === category).length
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category as ProductCategory)}
                  className="flex items-center gap-2"
                >
                  <span>{getCategoryIcon(category as ProductCategory)}</span>
                  {getCategoryName(category as ProductCategory)} ({count})
                </Button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Produktlista */}
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
    <Card className="p-6 hover:border-slate-600 transition-colors">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{getCategoryIcon(product.category)}</span>
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
        </div>

        {/* Priser */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">Företag:</span>
            <span className="text-white font-medium">
              {formatPrice(product.pricing.company.basePrice)}
              <span className="text-xs text-slate-400 ml-1">+ moms</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">Privatperson:</span>
            <span className="text-white font-medium">
              {formatPrice(product.pricing.individual.basePrice)}
            </span>
          </div>
        </div>

        {/* Åtgärder */}
        <div className="flex gap-2 pt-2 border-t border-slate-700">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Redigera
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="px-3 text-red-400 hover:text-red-300"
            title="Ta bort produkt"
          >
            <Trash2 className="w-4 h-4" />
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
      className="max-w-6xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Grundinformation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kontraktsbeskrivning *
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
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
                  step="100"
                  value={formData.pricing.company.basePrice}
                  onChange={(e) => updateFormData('pricing.company.basePrice', Number(e.target.value))}
                  placeholder="2400"
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
                  step="100"
                  value={formData.pricing.individual.basePrice}
                  onChange={(e) => updateFormData('pricing.individual.basePrice', Number(e.target.value))}
                  placeholder="3000"
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
          </div>
        </div>

        {/* Konfiguration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Kvantitet</h3>
            
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

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Egenskaper</h3>
            
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