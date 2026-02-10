// src/components/admin/leads/LeadTagsManager.tsx - Component for managing lead tags

import React, { useState, useEffect } from 'react'
import { Tag, Plus, X, Hash, AlertCircle } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'

interface LeadTagsManagerProps {
  leadId: string
  tags: string[]
  onTagsChange: () => void
}

const PREDEFINED_TAGS = [
  'Prisdriven kund',
  'Stororder / ramavtal',
  'Långsiktig relation',
  'Ny marknad / ny kundkategori',
  'Förebyggande insats',
  'Offertförfrågan',
  'Inspektionsbehov',
  'Uppföljningsjobb',
  'Specialsanering',
  'Bygg & entreprenad',
  'Livsmedelsbutik / restaurang',
  'Industri & lager',
  'Vård & omsorg',
  'Bostadsrättsförening / fastighetsbolag',
  'Avtalskund',
  'Återkommande sanering',
  'Förebyggande avtal',
  'Utgående avtal',
  'Ny avtalsförfrågan',
  'Akut angrepp',
  'Pågående skadedjursproblem',
  'Boendeakut (hem, lägenhet, förening)',
  'Företagskritisk driftstörning'
]

const TAG_COLORS = [
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-green-500/20 text-green-400 border-green-500/30',
  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'bg-red-500/20 text-red-400 border-red-500/30',
  'bg-orange-500/20 text-orange-400 border-orange-500/30'
]

const LeadTagsManager: React.FC<LeadTagsManagerProps> = ({ 
  leadId, 
  tags, 
  onTagsChange 
}) => {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Real-time subscription for lead tags updates
  useEffect(() => {
    const subscription = supabase
      .channel(`lead_tags_${leadId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'leads',
          filter: `id=eq.${leadId}`
        },
        (payload) => {
          // Small delay to ensure database consistency
          setTimeout(() => {
            onTagsChange()
          }, 500)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [leadId, onTagsChange])

  const getTagColor = (tag: string, index: number) => {
    // Use a simple hash function to consistently assign colors
    const hashCode = tag.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    const colorIndex = Math.abs(hashCode) % TAG_COLORS.length
    return TAG_COLORS[colorIndex]
  }

  const validateTag = (tag: string): boolean => {
    const newErrors: Record<string, string> = {}

    if (!tag.trim()) {
      newErrors.newTag = 'Tagg kan inte vara tom'
      setErrors(newErrors)
      return false
    }

    if (tag.length > 50) {
      newErrors.newTag = 'Tagg kan inte vara längre än 50 tecken'
      setErrors(newErrors)
      return false
    }

    if (tags.includes(tag.trim())) {
      newErrors.newTag = 'Denna tagg finns redan'
      setErrors(newErrors)
      return false
    }

    setErrors({})
    return true
  }

  const addTag = async (tag: string) => {
    if (!validateTag(tag) || (!profile?.id && !user?.id)) return

    try {
      setLoading(true)
      
      const updatedTags = [...tags, tag.trim()]

      const { error } = await supabase
        .from('leads')
        .update({ 
          tags: updatedTags,
          updated_by: profile?.id || user.id 
        })
        .eq('id', leadId)

      if (error) throw error

      // Log automatic event for tag addition
      try {
        await supabase
          .from('lead_events')
          .insert({
            lead_id: leadId,
            event_type: 'updated',
            title: `Tagg tillagd: ${tag.trim()}`,
            description: `Tagg "${tag.trim()}" har lagts till`,
            data: {
              tag_added: tag.trim(),
              updated_by_profile: user.email
            },
            created_by: profile?.id || user.id
          })
      } catch (eventError) {
        console.warn('Could not log tag addition event:', eventError)
      }

      toast.success('Tagg tillagd')
      setNewTag('')
      setShowForm(false)
      onTagsChange()

    } catch (err) {
      console.error('Error adding tag:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte lägga till tagg')
    } finally {
      setLoading(false)
    }
  }

  const removeTag = async (tagToRemove: string) => {
    if (!profile?.id && !user?.id) return

    try {
      setLoading(true)
      
      const updatedTags = tags.filter(tag => tag !== tagToRemove)

      const { error } = await supabase
        .from('leads')
        .update({ 
          tags: updatedTags,
          updated_by: profile?.id || user.id 
        })
        .eq('id', leadId)

      if (error) throw error

      // Log automatic event for tag removal
      try {
        await supabase
          .from('lead_events')
          .insert({
            lead_id: leadId,
            event_type: 'updated',
            title: `Tagg borttagen: ${tagToRemove}`,
            description: `Tagg "${tagToRemove}" har tagits bort`,
            data: {
              tag_removed: tagToRemove,
              updated_by_profile: user.email
            },
            created_by: profile?.id || user.id
          })
      } catch (eventError) {
        console.warn('Could not log tag removal event:', eventError)
      }

      toast.success('Tagg borttagen')
      onTagsChange()

    } catch (err) {
      console.error('Error removing tag:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort tagg')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addTag(newTag)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(newTag)
    }
    if (e.key === 'Escape') {
      setNewTag('')
      setShowForm(false)
      setErrors({})
    }
  }

  const addPredefinedTag = (tag: string) => {
    addTag(tag)
  }

  const availablePredefinedTags = PREDEFINED_TAGS.filter(tag => !tags.includes(tag))

  return (
    <Card className="p-6 bg-slate-800/40 border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Tag className="w-5 h-5 text-orange-400" />
          Taggar ({tags.length})
        </h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Lägg till tagg
        </Button>
      </div>

      {/* Current Tags */}
      {tags.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getTagColor(tag, index)}`}
              >
                <Hash className="w-3 h-3" />
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  disabled={loading}
                  className="hover:bg-black/20 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add Tag Form */}
      {showForm && (
        <Card className="p-4 bg-slate-800/30 border-slate-700/40 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-white flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Lägg till ny tagg
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tagg namn *
              </label>
              <Input
                value={newTag}
                onChange={(e) => {
                  setNewTag(e.target.value)
                  if (errors.newTag) setErrors({})
                }}
                onKeyDown={handleKeyPress}
                placeholder="Skriv tagg namn..."
                className={errors.newTag ? 'border-red-500' : ''}
                maxLength={50}
              />
              {errors.newTag && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.newTag}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Tryck Enter för att lägga till, Escape för att avbryta
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false)
                  setNewTag('')
                  setErrors({})
                }}
                disabled={loading}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                disabled={loading || !newTag.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Lägger till...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Lägg till tagg
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Predefined Tags */}
      {availablePredefinedTags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">
            Fördefinierade taggar:
          </h4>
          <div className="flex flex-wrap gap-2">
            {availablePredefinedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => addPredefinedTag(tag)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border border-slate-600/50 bg-slate-700/30 text-slate-300 hover:bg-slate-600/50 hover:border-slate-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tags.length === 0 && !showForm && (
        <div className="text-center py-8">
          <Tag className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Inga taggar än</p>
          <p className="text-slate-500 text-sm">Taggar hjälper till att kategorisera och filtrera leads</p>
        </div>
      )}
    </Card>
  )
}

export default LeadTagsManager