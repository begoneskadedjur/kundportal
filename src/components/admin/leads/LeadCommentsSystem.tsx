// src/components/admin/leads/LeadCommentsSystem.tsx - Component for managing lead comments

import React, { useState, useEffect } from 'react'
import { MessageSquare, Plus, Edit3, Trash2, Clock, User, AlertCircle, StickyNote, Phone, Calendar, Users, Mail } from 'lucide-react'
import Button from '../../ui/Button'
import Card from '../../ui/Card'
import LoadingSpinner from '../../shared/LoadingSpinner'
import { supabase } from '../../../lib/supabase'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { 
  LeadComment, 
  LeadCommentInsert, 
  LeadCommentUpdate, 
  CommentType,
  COMMENT_TYPE_DISPLAY 
} from '../../../types/database'

interface LeadCommentsSystemProps {
  leadId: string
  comments: LeadComment[]
  onCommentsChange: () => void
}

interface CommentFormData {
  content: string
  comment_type: CommentType
}

const LeadCommentsSystem: React.FC<LeadCommentsSystemProps> = ({ 
  leadId, 
  comments, 
  onCommentsChange 
}) => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingComment, setEditingComment] = useState<LeadComment | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState<CommentFormData>({
    content: '',
    comment_type: 'note'
  })

  useEffect(() => {
    if (editingComment) {
      setFormData({
        content: editingComment.content || '',
        comment_type: editingComment.comment_type || 'note'
      })
      setShowForm(true)
    }
  }, [editingComment])

  const resetForm = () => {
    setFormData({
      content: '',
      comment_type: 'note'
    })
    setEditingComment(null)
    setShowForm(false)
    setErrors({})
  }

  const handleInputChange = (field: keyof CommentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.content.trim()) {
      newErrors.content = 'Kommentar är obligatorisk'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || !user?.id) return

    try {
      setLoading(true)

      if (editingComment) {
        // Update existing comment
        const updateData: LeadCommentUpdate = {
          content: formData.content,
          comment_type: formData.comment_type
        }
        
        const { error } = await supabase
          .from('lead_comments')
          .update(updateData)
          .eq('id', editingComment.id)

        if (error) throw error
        
        // Log automatic event for comment update
        try {
          await supabase
            .from('lead_events')
            .insert({
              lead_id: leadId,
              event_type: 'updated',
              title: `Kommentar uppdaterad`,
              description: `Kommentar har uppdaterats`,
              data: {
                comment_type: formData.comment_type,
                comment_content: formData.content.substring(0, 100) + (formData.content.length > 100 ? '...' : ''),
                action: 'updated',
                updated_by_profile: user.email
              },
              created_by: user.id
            })
        } catch (eventError) {
          // Event logging failed, but don't fail the main operation
        }
        
        toast.success('Kommentar uppdaterad')
      } else {
        // Create new comment
        const insertData: LeadCommentInsert = {
          lead_id: leadId,
          content: formData.content,
          comment_type: formData.comment_type,
          created_by: user.id
        }

        const { error } = await supabase
          .from('lead_comments')
          .insert(insertData)

        if (error) throw error
        
        // Log automatic event for comment creation
        try {
          await supabase
            .from('lead_events')
            .insert({
              lead_id: leadId,
              event_type: 'note_added',
              title: `Ny kommentar tillagd`,
              description: `Ny kommentar (${formData.comment_type}) har lagts till`,
              data: {
                comment_type: formData.comment_type,
                comment_content: formData.content.substring(0, 100) + (formData.content.length > 100 ? '...' : ''),
                action: 'created',
                created_by_profile: user.email
              },
              created_by: user.id
            })
        } catch (eventError) {
          // Event logging failed, but don't fail the main operation
        }
        
        toast.success('Kommentar tillagd')
      }

      resetForm()
      onCommentsChange()

    } catch (err) {
      console.error('Error saving comment:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara kommentar')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (comment: LeadComment) => {
    if (!window.confirm('Är du säker på att du vill ta bort denna kommentar?')) {
      return
    }

    try {
      setLoading(true)

      const { error } = await supabase
        .from('lead_comments')
        .delete()
        .eq('id', comment.id)

      if (error) throw error

      // Log automatic event for comment deletion
      try {
        await supabase
          .from('lead_events')
          .insert({
            lead_id: leadId,
            event_type: 'updated',
            title: `Kommentar borttagen`,
            description: `Kommentar (${comment.comment_type}) har tagits bort`,
            data: {
              comment_type: comment.comment_type,
              comment_content: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
              action: 'deleted',
              deleted_by_profile: user?.email
            },
            created_by: user?.id
          })
      } catch (eventError) {
        // Event logging failed, but don't fail the main operation
      }

      toast.success('Kommentar borttagen')
      onCommentsChange()

    } catch (err) {
      console.error('Error deleting comment:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte ta bort kommentar')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCommentTypeIcon = (type: CommentType) => {
    const display = COMMENT_TYPE_DISPLAY[type]
    const iconName = display.icon
    
    switch (iconName) {
      case 'StickyNote': return <StickyNote className="w-4 h-4" />
      case 'Clock': return <Clock className="w-4 h-4" />
      case 'Users': return <Users className="w-4 h-4" />
      case 'Phone': return <Phone className="w-4 h-4" />
      case 'Mail': return <Mail className="w-4 h-4" />
      default: return <MessageSquare className="w-4 h-4" />
    }
  }

  // Sort comments by date (newest first)
  const sortedComments = [...comments].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <Card className="p-6 bg-slate-800/50 border-slate-700/50">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          Kommentarer & Anteckningar ({comments.length})
        </h3>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ny kommentar
        </Button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="p-4 bg-slate-700/30 border-slate-600/50 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {editingComment ? 'Redigera kommentar' : 'Ny kommentar'}
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Typ av kommentar
              </label>
              <select
                value={formData.comment_type}
                onChange={(e) => handleInputChange('comment_type', e.target.value as CommentType)}
                className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {Object.entries(COMMENT_TYPE_DISPLAY).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kommentar *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Skriv din kommentar här..."
                rows={4}
                className={`w-full px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none ${
                  errors.content ? 'border-red-500' : ''
                }`}
              />
              {errors.content && (
                <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.content}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-600/30">
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                disabled={loading}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {editingComment ? 'Uppdaterar...' : 'Sparar...'}
                  </>
                ) : (
                  <>
                    {editingComment ? 'Uppdatera' : 'Spara kommentar'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Comments List */}
      {sortedComments.length > 0 ? (
        <div className="space-y-4">
          {sortedComments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${COMMENT_TYPE_DISPLAY[comment.comment_type].color}/10`}>
                    {getCommentTypeIcon(comment.comment_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full bg-${COMMENT_TYPE_DISPLAY[comment.comment_type].color}/20 text-${COMMENT_TYPE_DISPLAY[comment.comment_type].color}`}>
                        {COMMENT_TYPE_DISPLAY[comment.comment_type].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                      <User className="w-3 h-3" />
                      {comment.created_by_profile?.display_name || 'Okänd användare'}
                      <Clock className="w-3 h-3 ml-2" />
                      {formatDate(comment.created_at)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingComment(comment)}
                    disabled={loading}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(comment)}
                    disabled={loading}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="text-slate-200 whitespace-pre-wrap">
                {comment.content}
              </div>
              
              {comment.updated_at !== comment.created_at && (
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" />
                  Redigerad {formatDate(comment.updated_at)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">Inga kommentarer än</p>
            <p className="text-slate-500 text-sm">Klicka på "Ny kommentar" för att lägga till första kommentaren</p>
          </div>
        )
      )}
    </Card>
  )
}

export default LeadCommentsSystem