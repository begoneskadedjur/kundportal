// src/pages/technician/guides/CommunicationSystemGuide.tsx
// SUPER-PEDAGOGISK GUIDE: Hur du använder kommunikationssystemet
// Version 1.0 - Optimerad för tekniker, koordinatorer och admin med begränsad datorvana
// Samma standard som FollowUpCaseGuide.tsx och EquipmentPlacementGuide.tsx

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MessageSquareText,
  MessageCircle,
  Send,
  AtSign,
  Users,
  Reply,
  CornerDownRight,
  CheckCircle2,
  CheckCircle,
  Bell,
  Inbox,
  Filter,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Sparkles,
  X,
  Loader2,
  Archive,
  Clock,
  Circle,
  ArrowDown,
  MousePointer2,
  User,
  UserCheck,
  Users2
} from 'lucide-react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'

// ============================================================================
// MOCK-KOMPONENTER - Visar hur riktiga UI-element ser ut
// ============================================================================

// Mock: Kommentarsinput med @mention-stöd
const MockCommentInput = ({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Skriv ett meddelande...',
  showSendButton = true,
  animated = false,
  disabled = false,
  replyingTo
}: {
  value?: string
  onChange?: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  showSendButton?: boolean
  animated?: boolean
  disabled?: boolean
  replyingTo?: string
}) => (
  <motion.div
    className="w-full"
    animate={animated ? {
      boxShadow: [
        '0 0 0 0 rgba(6, 182, 212, 0)',
        '0 0 0 10px rgba(6, 182, 212, 0.2)',
        '0 0 0 0 rgba(6, 182, 212, 0)'
      ]
    } : {}}
    transition={animated ? { duration: 2, repeat: Infinity } : {}}
  >
    {replyingTo && (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-t-xl border-b border-slate-700 text-sm">
        <CornerDownRight className="w-4 h-4 text-cyan-400" />
        <span className="text-slate-400">Svarar på:</span>
        <span className="text-white truncate">{replyingTo}</span>
      </div>
    )}
    <div className={`flex items-end gap-2 bg-slate-800/70 border-2 border-slate-600 ${replyingTo ? 'rounded-b-xl' : 'rounded-xl'} p-3 focus-within:border-cyan-500 transition-colors`}>
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 bg-transparent text-white placeholder:text-slate-500 resize-none outline-none min-h-[48px] text-lg"
        rows={2}
      />
      {showSendButton && (
        <motion.button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className={`p-3 rounded-lg transition-all ${
            value.trim()
              ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
          whileTap={value.trim() ? { scale: 0.95 } : {}}
        >
          <Send className="w-5 h-5" />
        </motion.button>
      )}
    </div>
  </motion.div>
)

// Mock: Mention suggestions dropdown
const MockMentionSuggestions = ({
  suggestions,
  selectedIndex = -1,
  onSelect,
  visible = true
}: {
  suggestions: Array<{
    type: 'user' | 'role' | 'all'
    name: string
    subtitle?: string
  }>
  selectedIndex?: number
  onSelect?: (index: number) => void
  visible?: boolean
}) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50"
      >
        <div className="p-2 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider px-2">Förslag</p>
        </div>
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.name}
            onClick={() => onSelect?.(index)}
            className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
              selectedIndex === index
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'hover:bg-slate-700/50 text-white'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              suggestion.type === 'user' ? 'bg-purple-500/20' :
              suggestion.type === 'role' ? 'bg-amber-500/20' :
              'bg-cyan-500/20'
            }`}>
              {suggestion.type === 'user' ? (
                <User className="w-4 h-4 text-purple-400" />
              ) : suggestion.type === 'role' ? (
                <Users className="w-4 h-4 text-amber-400" />
              ) : (
                <Users2 className="w-4 h-4 text-cyan-400" />
              )}
            </div>
            <div>
              <div className="font-medium">{suggestion.name}</div>
              {suggestion.subtitle && (
                <div className="text-sm text-slate-400">{suggestion.subtitle}</div>
              )}
            </div>
          </button>
        ))}
      </motion.div>
    )}
  </AnimatePresence>
)

// Mock: Kommentars-item
const MockCommentItem = ({
  author,
  authorRole,
  content,
  time,
  mentions = [],
  status,
  isReply = false,
  replyCount = 0,
  onReply,
  onMarkResolved,
  isNew = false,
  showReplyButton = true,
  showResolveButton = false,
  animated = false
}: {
  author: string
  authorRole: 'admin' | 'koordinator' | 'technician'
  content: string
  time: string
  mentions?: string[]
  status?: 'open' | 'resolved'
  isReply?: boolean
  replyCount?: number
  onReply?: () => void
  onMarkResolved?: () => void
  isNew?: boolean
  showReplyButton?: boolean
  showResolveButton?: boolean
  animated?: boolean
}) => {
  const roleColors = {
    admin: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Admin' },
    koordinator: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Koordinator' },
    technician: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Tekniker' }
  }

  const roleStyle = roleColors[authorRole]

  // Highlighta @mentions i content
  const highlightMentions = (text: string) => {
    const parts = text.split(/(@\w+(?:\s+\w+)?)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded font-medium">
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 20, scale: 0.95 } : {}}
      animate={isNew ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ type: 'spring', damping: 15 }}
      className={`${isReply ? 'ml-8 border-l-2 border-slate-700 pl-4' : ''}`}
    >
      <motion.div
        className={`p-4 rounded-xl ${
          isNew
            ? 'bg-cyan-500/10 border-2 border-cyan-500/30'
            : 'bg-slate-800/50 border border-slate-700'
        }`}
        animate={animated ? {
          boxShadow: [
            '0 0 0 0 rgba(6, 182, 212, 0)',
            '0 0 15px 5px rgba(6, 182, 212, 0.3)',
            '0 0 0 0 rgba(6, 182, 212, 0)'
          ]
        } : {}}
        transition={animated ? { duration: 2, repeat: Infinity } : {}}
      >
        {isNew && (
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" />
            NYTT MEDDELANDE!
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-full ${roleStyle.bg} flex items-center justify-center`}>
            <User className={`w-4 h-4 ${roleStyle.text}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{author}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${roleStyle.bg} ${roleStyle.text}`}>
                {roleStyle.label}
              </span>
            </div>
            <span className="text-xs text-slate-500">{time}</span>
          </div>

          {/* Status badge */}
          {status && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
              status === 'resolved'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {status === 'resolved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Avklarad
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5" />
                  Aktiv
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <p className="text-slate-200 text-lg leading-relaxed">
          {highlightMentions(content)}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-700/50">
          {showReplyButton && (
            <button
              onClick={onReply}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Reply className="w-4 h-4" />
              Svara {replyCount > 0 && `(${replyCount})`}
            </button>
          )}

          {showResolveButton && status === 'open' && (
            <motion.button
              onClick={onMarkResolved}
              className="flex items-center gap-2 text-sm px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
              animate={animated ? {
                boxShadow: [
                  '0 0 0 0 rgba(34, 197, 94, 0)',
                  '0 0 10px 3px rgba(34, 197, 94, 0.3)',
                  '0 0 0 0 rgba(34, 197, 94, 0)'
                ]
              } : {}}
              transition={animated ? { duration: 2, repeat: Infinity } : {}}
            >
              <CheckCircle2 className="w-4 h-4" />
              Markera löst
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// Mock: Notifikationsklocka
const MockNotificationBell = ({
  count = 0,
  isOpen = false,
  onToggle,
  notifications = [],
  animated = false
}: {
  count?: number
  isOpen?: boolean
  onToggle?: () => void
  notifications?: Array<{
    title: string
    preview: string
    time: string
    isRead: boolean
  }>
  animated?: boolean
}) => (
  <div className="relative">
    <motion.button
      onClick={onToggle}
      className="relative p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
      animate={animated && count > 0 ? {
        scale: [1, 1.1, 1]
      } : {}}
      transition={animated ? { duration: 0.5, repeat: Infinity, repeatDelay: 2 } : {}}
    >
      <Bell className="w-6 h-6 text-slate-300" />
      {count > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
        >
          <span className="text-xs font-bold text-white">{count > 9 ? '9+' : count}</span>
        </motion.div>
      )}
    </motion.button>

    {/* Dropdown */}
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50"
        >
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h4 className="font-semibold text-white">Notifikationer</h4>
            {count > 0 && (
              <span className="text-xs text-amber-400">{count} olästa</span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Inga notifikationer</p>
              </div>
            ) : (
              notifications.map((notif, index) => (
                <button
                  key={index}
                  className={`w-full p-4 text-left border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/50 transition-colors ${
                    !notif.isRead ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-cyan-500 rounded-full mt-2 flex-shrink-0" />
                    )}
                    <div className={!notif.isRead ? '' : 'ml-5'}>
                      <p className="text-sm font-medium text-white">{notif.title}</p>
                      <p className="text-sm text-slate-400 truncate">{notif.preview}</p>
                      <p className="text-xs text-slate-500 mt-1">{notif.time}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)

// Mock: Filter-flikar för Intern Administration
const MockFilterTabs = ({
  tabs,
  activeTab,
  onSelect
}: {
  tabs: Array<{
    id: string
    label: string
    count: number
    color: string
  }>
  activeTab: string
  onSelect: (id: string) => void
}) => (
  <div className="flex flex-wrap gap-2">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onSelect(tab.id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          activeTab === tab.id
            ? `bg-${tab.color}-500/20 text-${tab.color}-400 ring-2 ring-${tab.color}-500/30`
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        }`}
        style={{
          backgroundColor: activeTab === tab.id ? `rgba(var(--${tab.color}), 0.2)` : undefined
        }}
      >
        {tab.label}
        {tab.count > 0 && (
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
            activeTab === tab.id ? 'bg-white/20' : 'bg-slate-700'
          }`}>
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
)

// Animerad pil
const AnimatedArrow = ({ direction = 'down' }: { direction?: 'down' | 'right' | 'up' }) => (
  <motion.div
    className="flex justify-center py-3"
    animate={{
      y: direction === 'down' ? [0, 8, 0] : direction === 'up' ? [0, -8, 0] : 0,
      x: direction === 'right' ? [0, 8, 0] : 0
    }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
  >
    {direction === 'down' ? (
      <ArrowDown className="w-8 h-8 text-cyan-400" />
    ) : direction === 'up' ? (
      <ArrowDown className="w-8 h-8 text-cyan-400 rotate-180" />
    ) : (
      <ChevronRight className="w-8 h-8 text-cyan-400" />
    )}
  </motion.div>
)

// Glödande highlight-ring
const GlowingHighlight = ({ children, color = 'cyan' }: { children: React.ReactNode, color?: 'cyan' | 'green' | 'purple' | 'amber' }) => {
  const colors = {
    cyan: 'rgba(6, 182, 212, 0.4)',
    green: 'rgba(34, 197, 94, 0.4)',
    purple: 'rgba(168, 85, 247, 0.4)',
    amber: 'rgba(245, 158, 11, 0.4)'
  }

  return (
    <motion.div
      className="relative inline-block w-full"
      animate={{
        boxShadow: [
          `0 0 0 0 transparent`,
          `0 0 20px 8px ${colors[color]}`,
          `0 0 0 0 transparent`
        ]
      }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {children}
    </motion.div>
  )
}

// ============================================================================
// GUIDE-STEG - Varje steg i guiden
// ============================================================================

interface GuideStep {
  id: number
  title: string
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  content: React.ReactNode
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    title: 'Vad är kommunikationssystemet?',
    subtitle: 'En snabb introduktion',
    icon: MessageSquareText,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Hero-sektion med stor ikon */}
        <div className="text-center py-6">
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-cyan-500/20 mb-6"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <MessageSquareText className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Chatta direkt i ärenden!
          </h3>
          <p className="text-xl text-slate-300 max-w-md mx-auto leading-relaxed">
            Slipp mejl och telefonsamtal - kommunicera direkt med kollegor inne i ärendet.
          </p>
        </div>

        {/* Scenario-kort */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-800/40 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-3">
            <Lightbulb className="w-6 h-6" />
            Typiskt scenario:
          </h4>
          <div className="space-y-4 text-lg text-slate-300">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">1</span>
              <p>Du jobbar på ett ärende och har en <strong className="text-white">fråga</strong></p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">2</span>
              <p>Du skriver <strong className="text-purple-300">@Koordinator</strong> i chatten</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">3</span>
              <p>Alla koordinatorer får en <strong className="text-amber-300">notifikation</strong> direkt!</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">4</span>
              <p>De svarar och du får <strong className="text-emerald-300">svar direkt i ärendet</strong></p>
            </div>
          </div>
        </div>

        {/* Fördelar */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Allt på ett ställe</h5>
              <p className="text-slate-400">All kommunikation sparas i ärendet - inga mejl att leta efter</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Automatiska notifikationer</h5>
              <p className="text-slate-400">Den du taggar får en notis - de missar aldrig ditt meddelande</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Trådar för diskussioner</h5>
              <p className="text-slate-400">Svara på specifika meddelanden - håll samtalen organiserade</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'Hitta kommunikationen',
    subtitle: 'Var finns chattfunktionen?',
    icon: MessageCircle,
    iconColor: 'text-teal-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-teal-500/10 border-2 border-teal-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-teal-300 mb-3 flex items-center gap-3">
            <MessageCircle className="w-6 h-6" />
            Vad du ska göra:
          </h4>
          <p className="text-lg text-slate-300">
            Öppna ett ärende och scrolla ner till <strong className="text-white">"Aktivitet"</strong>-sektionen. Där finns chattfunktionen!
          </p>
        </div>

        {/* Simulerad ärendevy */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Så här ser det ut i ett ärende:</p>

          <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 overflow-hidden">
            {/* Ärendets rubrik (dimmad) */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/50 opacity-50">
              <h3 className="text-white font-semibold">Familjen Andersson - Råttor</h3>
              <p className="text-sm text-slate-400">Storgatan 15, 123 45 Staden</p>
            </div>

            {/* Ärendeinfo (dimmad) */}
            <div className="p-4 border-b border-slate-700 opacity-30 blur-[1px]">
              <div className="h-20 bg-slate-800 rounded-lg"></div>
            </div>

            {/* AKTIVITET-SEKTIONEN - HIGHLIGHTAD */}
            <motion.div
              className="border-2 border-cyan-500/50 rounded-xl m-2"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(6, 182, 212, 0)',
                  '0 0 15px 5px rgba(6, 182, 212, 0.3)',
                  '0 0 0 0 rgba(6, 182, 212, 0)'
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="p-4 bg-slate-800/30">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquareText className="w-5 h-5 text-cyan-400" />
                  <h4 className="font-semibold text-white">Aktivitet</h4>
                </div>

                {/* Befintligt meddelande */}
                <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20" />
                    <span className="text-sm font-medium text-white">Anna K.</span>
                    <span className="text-xs text-slate-500">igår</span>
                  </div>
                  <p className="text-sm text-slate-300">Kunden har ringt - väntar på offert</p>
                </div>

                {/* Input-fält */}
                <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                  <span className="text-slate-500 text-sm">Skriv ett meddelande...</span>
                  <Send className="w-4 h-4 text-slate-600 ml-auto" />
                </div>
              </div>
            </motion.div>

            {/* Pil som pekar */}
            <div className="p-4 flex items-center justify-center">
              <motion.div
                className="flex items-center gap-2 text-cyan-400"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <AnimatedArrow direction="up" />
                <span className="text-lg font-semibold">CHATTEN FINNS HÄR!</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-blue-300 mb-2">Tips!</h5>
              <p className="text-slate-300">
                På mobil kan du behöva <strong className="text-white">scrolla nedåt</strong> för att se aktivitet-sektionen.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Skriv och skicka',
    subtitle: 'INTERAKTIV DEMO - prova själv!',
    icon: Send,
    iconColor: 'text-cyan-400',
    content: (() => {
      const WriteAndSendDemo = () => {
        const [text, setText] = useState('')
        const [messages, setMessages] = useState<Array<{ author: string; content: string; time: string }>>([
          { author: 'Anna K.', content: 'Kunden har ringt - väntar på offert', time: 'igår' }
        ])
        const [sending, setSending] = useState(false)

        const handleSend = () => {
          if (!text.trim()) return
          setSending(true)

          setTimeout(() => {
            setMessages(prev => [...prev, {
              author: 'Du',
              content: text,
              time: 'Just nu'
            }])
            setText('')
            setSending(false)
          }, 1000)
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-cyan-500/10 border-2 border-cyan-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-cyan-300 mb-3 flex items-center gap-3">
                <Send className="w-6 h-6" />
                Prova att skicka ett meddelande:
              </h4>
              <ol className="text-lg text-slate-300 space-y-2">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Skriv något i textfältet nedan</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span>Klicka på <strong className="text-cyan-300">skicka-knappen</strong></span>
                </li>
              </ol>
            </div>

            {/* Interaktiv demo */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
              {/* Befintliga meddelanden */}
              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={index === messages.length - 1 && msg.author === 'Du' ? { opacity: 0, y: 20 } : {}}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg ${
                      msg.author === 'Du'
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : 'bg-slate-800/50 border border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 rounded-full ${
                        msg.author === 'Du' ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                      }`} />
                      <span className="text-sm font-medium text-white">{msg.author}</span>
                      <span className="text-xs text-slate-500">{msg.time}</span>
                      {msg.author === 'Du' && index === messages.length - 1 && (
                        <span className="text-xs text-cyan-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Nytt!
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-300">{msg.content}</p>
                  </motion.div>
                ))}
              </div>

              {/* Input */}
              <GlowingHighlight color="cyan">
                <MockCommentInput
                  value={text}
                  onChange={setText}
                  onSubmit={handleSend}
                  placeholder="Skriv något här och klicka skicka..."
                  disabled={sending}
                />
              </GlowingHighlight>

              {sending && (
                <div className="flex items-center gap-2 text-cyan-400 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Skickar...</span>
                </div>
              )}
            </div>

            {messages.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3"
              >
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <span className="text-emerald-300 text-lg">Bra jobbat! Du skickade ett meddelande!</span>
              </motion.div>
            )}
          </div>
        )
      }

      return <WriteAndSendDemo />
    })()
  },
  {
    id: 4,
    title: '@Mentions - Tagga en person',
    subtitle: 'INTERAKTIV DEMO - prova själv!',
    icon: AtSign,
    iconColor: 'text-purple-400',
    content: (() => {
      const MentionPersonDemo = () => {
        const [text, setText] = useState('')
        const [showSuggestions, setShowSuggestions] = useState(false)
        const [selectedMention, setSelectedMention] = useState<string | null>(null)

        const suggestions = [
          { type: 'user' as const, name: 'Mathias Carlsson', subtitle: 'Tekniker' },
          { type: 'user' as const, name: 'Anna Svensson', subtitle: 'Koordinator' },
          { type: 'user' as const, name: 'Erik Johansson', subtitle: 'Admin' },
        ]

        useEffect(() => {
          if (text.endsWith('@')) {
            setShowSuggestions(true)
          } else if (!text.includes('@')) {
            setShowSuggestions(false)
          }
        }, [text])

        const handleSelect = (index: number) => {
          const mention = suggestions[index]
          setText(text.slice(0, -1) + `@${mention.name} `)
          setSelectedMention(mention.name)
          setShowSuggestions(false)
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-purple-300 mb-3 flex items-center gap-3">
                <AtSign className="w-6 h-6" />
                Så taggar du en specifik person:
              </h4>
              <ol className="text-lg text-slate-300 space-y-2">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Skriv <strong className="text-purple-300 font-mono">@</strong> i textfältet</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span>En lista med förslag dyker upp</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">3</span>
                  <span>Klicka på personen du vill tagga</span>
                </li>
              </ol>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - skriv @ i fältet:</p>

              <div className="relative bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
                <MockMentionSuggestions
                  suggestions={suggestions}
                  onSelect={handleSelect}
                  visible={showSuggestions}
                />

                <MockCommentInput
                  value={text}
                  onChange={setText}
                  placeholder="Skriv @ för att se förslag..."
                  showSendButton={false}
                  animated={!showSuggestions && !selectedMention}
                />

                {!showSuggestions && !text.includes('@') && (
                  <motion.div
                    className="mt-3 flex items-center gap-2 text-purple-400"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <MousePointer2 className="w-5 h-5" />
                    <span className="font-medium">Skriv @ för att börja!</span>
                  </motion.div>
                )}
              </div>
            </div>

            {selectedMention && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                  <span className="text-emerald-300 text-lg">
                    Du taggade: <strong className="text-purple-300">@{selectedMention}</strong>
                  </span>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center gap-3 text-amber-300">
                    <Bell className="w-6 h-6" />
                    <span className="text-lg">{selectedMention} får nu en notifikation!</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tips */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-blue-300 mb-2">Tips!</h5>
                  <p className="text-slate-300">
                    Börja skriva namnet efter @ för att <strong className="text-white">filtrera listan</strong>.
                    Skriv <strong className="font-mono text-purple-300">@Mat</strong> för att hitta "Mathias" snabbare.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <MentionPersonDemo />
    })()
  },
  {
    id: 5,
    title: '@Mentions - Tagga en roll',
    subtitle: 'Nå alla med en viss roll',
    icon: Users,
    iconColor: 'text-amber-400',
    content: (() => {
      const MentionRoleDemo = () => {
        const [selectedRole, setSelectedRole] = useState<string | null>(null)

        const roles = [
          {
            name: '@Admin',
            description: 'Alla administratörer',
            recipients: '2 personer',
            color: 'red'
          },
          {
            name: '@Koordinator',
            description: 'Alla koordinatorer',
            recipients: '4 personer',
            color: 'amber'
          },
          {
            name: '@Tekniker',
            description: 'Alla tekniker',
            recipients: '12 personer',
            color: 'emerald'
          },
          {
            name: '@alla',
            description: 'ALLA med tillgång till ärendet',
            recipients: '18 personer',
            color: 'cyan'
          }
        ]

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-3">
                <Users className="w-6 h-6" />
                Tagga en hel grupp på en gång:
              </h4>
              <p className="text-lg text-slate-300">
                Istället för att tagga varje person individuellt kan du tagga <strong className="text-white">alla med en viss roll</strong>.
              </p>
            </div>

            {/* Roll-lista */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Klicka på en roll för att se vad som händer:</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roles.map((role) => (
                  <motion.button
                    key={role.name}
                    onClick={() => setSelectedRole(role.name)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedRole === role.name
                        ? `bg-${role.color}-500/20 border-${role.color}-500/50`
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                    style={{
                      backgroundColor: selectedRole === role.name
                        ? role.color === 'red' ? 'rgba(239, 68, 68, 0.2)'
                        : role.color === 'amber' ? 'rgba(245, 158, 11, 0.2)'
                        : role.color === 'emerald' ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(6, 182, 212, 0.2)'
                        : undefined,
                      borderColor: selectedRole === role.name
                        ? role.color === 'red' ? 'rgba(239, 68, 68, 0.5)'
                        : role.color === 'amber' ? 'rgba(245, 158, 11, 0.5)'
                        : role.color === 'emerald' ? 'rgba(16, 185, 129, 0.5)'
                        : 'rgba(6, 182, 212, 0.5)'
                        : undefined
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <Users className={`w-5 h-5 ${
                        role.color === 'red' ? 'text-red-400'
                        : role.color === 'amber' ? 'text-amber-400'
                        : role.color === 'emerald' ? 'text-emerald-400'
                        : 'text-cyan-400'
                      }`} />
                      <span className={`font-mono font-bold text-lg ${
                        role.color === 'red' ? 'text-red-300'
                        : role.color === 'amber' ? 'text-amber-300'
                        : role.color === 'emerald' ? 'text-emerald-300'
                        : 'text-cyan-300'
                      }`}>{role.name}</span>
                    </div>
                    <p className="text-slate-400 text-sm">{role.description}</p>
                    <p className="text-slate-500 text-xs mt-1">{role.recipients}</p>
                  </motion.button>
                ))}
              </div>
            </div>

            {selectedRole && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
              >
                <div className="flex items-center gap-3 text-emerald-300 mb-3">
                  <Bell className="w-6 h-6" />
                  <span className="text-lg font-medium">Notifikationer skickas till:</span>
                </div>
                <p className="text-slate-300 ml-9">
                  {selectedRole === '@Admin' && 'Alla 2 administratörer får en notis!'}
                  {selectedRole === '@Koordinator' && 'Alla 4 koordinatorer får en notis!'}
                  {selectedRole === '@Tekniker' && 'Alla 12 tekniker får en notis!'}
                  {selectedRole === '@alla' && 'Alla 18 personer med tillgång till ärendet får en notis!'}
                </p>
              </motion.div>
            )}

            {/* Varning */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-red-300 mb-2">Var sparsam med @alla!</h5>
                  <p className="text-slate-300">
                    <strong className="text-white">@alla</strong> skickar notis till ALLA med tillgång till ärendet.
                    Använd det bara när det verkligen är viktigt för alla att veta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <MentionRoleDemo />
    })()
  },
  {
    id: 6,
    title: 'Svara på meddelanden',
    subtitle: 'Håll diskussioner organiserade',
    icon: Reply,
    iconColor: 'text-slate-400',
    content: (() => {
      const ReplyDemo = () => {
        const [replyMode, setReplyMode] = useState(false)
        const [replyText, setReplyText] = useState('')
        const [replied, setReplied] = useState(false)

        const handleSendReply = () => {
          if (!replyText.trim()) return
          setReplied(true)
          setReplyMode(false)
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-slate-700/50 border-2 border-slate-600 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-slate-200 mb-3 flex items-center gap-3">
                <Reply className="w-6 h-6" />
                Svara på ett specifikt meddelande:
              </h4>
              <p className="text-lg text-slate-300">
                Klicka på <strong className="text-white">"Svara"</strong> under ett meddelande för att starta en tråd.
                Svaret visas indenterat under originalmeddelandet.
              </p>
            </div>

            {/* Interaktiv demo */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
              {/* Original-meddelande */}
              <MockCommentItem
                author="Anna Svensson"
                authorRole="koordinator"
                content="Har du hunnit kolla på fakturan för det här ärendet? Kunden undrar."
                time="2 timmar sedan"
                onReply={() => setReplyMode(true)}
                showReplyButton={!replied}
                animated={!replyMode && !replied}
              />

              {/* Svars-input */}
              {replyMode && !replied && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="ml-8"
                >
                  <GlowingHighlight color="cyan">
                    <MockCommentInput
                      value={replyText}
                      onChange={setReplyText}
                      onSubmit={handleSendReply}
                      replyingTo="Har du hunnit kolla på fakturan..."
                      placeholder="Skriv ditt svar..."
                    />
                  </GlowingHighlight>
                </motion.div>
              )}

              {/* Svaret (efter skickat) */}
              {replied && (
                <MockCommentItem
                  author="Du"
                  authorRole="technician"
                  content={replyText || "Ja, jag skickade den igår. Borde vara på väg!"}
                  time="Just nu"
                  isReply
                  isNew
                  showReplyButton={false}
                />
              )}
            </div>

            {replied && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3"
              >
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <span className="text-emerald-300 text-lg">
                  Bra! Ditt svar visas nu indenterat under originalmeddelandet.
                </span>
              </motion.div>
            )}

            {/* Tips */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-blue-300 mb-2">Varför använda svar?</h5>
                  <p className="text-slate-300">
                    Trådar håller samtalen <strong className="text-white">organiserade</strong>.
                    Det blir lättare att följa vem som svarade på vad, speciellt när många är inblandade.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <ReplyDemo />
    })()
  },
  {
    id: 7,
    title: 'Markera som löst',
    subtitle: 'När en fråga är besvarad',
    icon: CheckCircle2,
    iconColor: 'text-green-400',
    content: (() => {
      const MarkResolvedDemo = () => {
        const [status, setStatus] = useState<'open' | 'resolved'>('open')

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6" />
                Håll koll på vad som är klart:
              </h4>
              <p className="text-lg text-slate-300">
                Meddelanden med @mentions har en <strong className="text-white">status</strong>.
                Klicka på "Markera löst" när du har hanterat frågan.
              </p>
            </div>

            {/* Status-förklaring */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Circle className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold text-blue-300">Aktiv</span>
                </div>
                <p className="text-sm text-slate-400">Öppen fråga som väntar på svar/åtgärd</p>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-300">Avklarad</span>
                </div>
                <p className="text-sm text-slate-400">Åtgärdat/löst - ingen åtgärd krävs</p>
              </div>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">
                Prova - klicka på "Markera löst":
              </p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
                <MockCommentItem
                  author="Erik Admin"
                  authorRole="admin"
                  content="@Tekniker Kan ni dubbelkolla att materialet är beställt för nästa vecka?"
                  time="3 timmar sedan"
                  status={status}
                  showResolveButton={status === 'open'}
                  onMarkResolved={() => setStatus('resolved')}
                  animated={status === 'open'}
                  showReplyButton={false}
                />
              </div>
            </div>

            {status === 'resolved' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
              >
                <div className="flex items-center gap-3 text-emerald-300">
                  <CheckCircle className="w-6 h-6" />
                  <div>
                    <span className="text-lg font-medium">Markerad som löst!</span>
                    <p className="text-sm text-slate-400 mt-1">
                      Nu vet alla att frågan är hanterad. Du kan återöppna den om det behövs.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tips */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-amber-300 mb-2">Kom ihåg!</h5>
                  <p className="text-slate-300">
                    Markera frågor som lösta när du hanterat dem. Det hjälper <strong className="text-white">alla</strong> att
                    se vad som fortfarande behöver göras.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <MarkResolvedDemo />
    })()
  },
  {
    id: 8,
    title: 'Notifikationer',
    subtitle: 'Missa aldrig ett meddelande',
    icon: Bell,
    iconColor: 'text-amber-400',
    content: (() => {
      const NotificationDemo = () => {
        const [bellOpen, setBellOpen] = useState(false)
        const [notificationCount, setNotificationCount] = useState(3)
        const [hasSeenNotifications, setHasSeenNotifications] = useState(false)

        const notifications = [
          {
            title: 'Anna nämnde dig',
            preview: '@Tekniker Kan ni kolla på detta?',
            time: '5 min sedan',
            isRead: false
          },
          {
            title: 'Nytt svar i Ärende #1234',
            preview: 'Erik: Jag fixar det imorgon',
            time: '1 timme sedan',
            isRead: false
          },
          {
            title: '@Koordinator i Servicebesök AB',
            preview: 'Fakturan är klar att skickas',
            time: '2 timmar sedan',
            isRead: false
          }
        ]

        const handleToggle = () => {
          setBellOpen(!bellOpen)
          if (!hasSeenNotifications) {
            setHasSeenNotifications(true)
          }
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-3">
                <Bell className="w-6 h-6" />
                Så fungerar notifikationer:
              </h4>
              <p className="text-lg text-slate-300">
                När någon taggar dig (eller din roll) får du en <strong className="text-white">notifikation</strong>.
                Klicka på klockan i headern för att se dem.
              </p>
            </div>

            {/* Header-mockup med klocka */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">
                Prova - klicka på klockan:
              </p>

              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  {/* Logo */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">BG</span>
                    </div>
                    <span className="text-white font-semibold">BeGone</span>
                  </div>

                  {/* Navigation (dimmad) */}
                  <div className="hidden sm:flex items-center gap-4 text-slate-500">
                    <span>Dashboard</span>
                    <span>Ärenden</span>
                  </div>

                  {/* Klockan */}
                  <GlowingHighlight color="amber">
                    <MockNotificationBell
                      count={notificationCount}
                      isOpen={bellOpen}
                      onToggle={handleToggle}
                      notifications={notifications}
                      animated={!hasSeenNotifications}
                    />
                  </GlowingHighlight>
                </div>
              </div>
            </div>

            {hasSeenNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
              >
                <div className="flex items-center gap-3 text-emerald-300">
                  <CheckCircle className="w-6 h-6" />
                  <div>
                    <span className="text-lg font-medium">Bra! Du hittade notifikationerna.</span>
                    <p className="text-sm text-slate-400 mt-1">
                      Klicka på en notifikation för att hoppa direkt till ärendet.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Vad ger notis? */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400" />
                Du får notis när:
              </h5>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Någon taggar <strong className="text-purple-300">@DittNamn</strong></span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Någon taggar <strong className="text-amber-300">@DinRoll</strong> (t.ex. @Tekniker)</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Någon taggar <strong className="text-cyan-300">@alla</strong></span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Någon svarar på <strong className="text-white">ditt meddelande</strong></span>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <NotificationDemo />
    })()
  },
  {
    id: 9,
    title: 'Intern Administration',
    subtitle: 'Översikt över all kommunikation',
    icon: Inbox,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-blue-300 mb-3 flex items-center gap-3">
            <Inbox className="w-6 h-6" />
            En sida för alla dina ärenden med kommunikation:
          </h4>
          <p className="text-lg text-slate-300">
            "Intern Administration" visar <strong className="text-white">alla ärenden</strong> där det finns kommunikation.
            Filtrera och sök för att snabbt hitta det du letar efter.
          </p>
        </div>

        {/* Simulerad Intern Administration */}
        <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 bg-slate-800/50">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-blue-400" />
              Intern Administration
            </h3>
            <p className="text-sm text-slate-400">45 aktiva ärenden</p>
          </div>

          {/* Filter-flikar */}
          <div className="p-4 border-b border-slate-700 bg-slate-800/30">
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-blue-500/20 text-blue-300 rounded-full text-sm font-medium ring-2 ring-blue-500/30">
                Alla (45)
              </button>
              <button className="px-4 py-2 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-full text-sm font-medium flex items-center gap-2">
                Väntar på mitt svar
                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">8</span>
              </button>
              <button className="px-4 py-2 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-full text-sm font-medium flex items-center gap-2">
                Väntar på andras svar
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">12</span>
              </button>
              <button className="px-4 py-2 bg-slate-800 text-slate-400 hover:bg-slate-700 rounded-full text-sm font-medium flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Arkiv
              </button>
            </div>

            {/* Sökfält */}
            <div className="mt-3 flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
                <Search className="w-4 h-4 text-slate-500" />
                <span className="text-slate-500 text-sm">Sök nyckelord, fakturanr...</span>
              </div>
            </div>
          </div>

          {/* Ärende-lista */}
          <div className="p-4 space-y-3">
            {/* Ärende 1 - Väntar på ditt svar */}
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-white font-medium">Familjen Andersson - Råttor</h4>
                  <p className="text-sm text-slate-400">Privatperson</p>
                </div>
                <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                  Väntar på dig
                </span>
              </div>
              <p className="text-sm text-slate-300 mb-2">"@Tekniker Behöver ni mer material?"</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>Anna, 2 timmar sedan</span>
              </div>
            </div>

            {/* Ärende 2 - Väntar på andra */}
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-white font-medium">Restaurang Smak AB</h4>
                  <p className="text-sm text-slate-400">Företag</p>
                </div>
                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                  Väntar på svar
                </span>
              </div>
              <p className="text-sm text-slate-300 mb-2">"@Admin Kan ni godkänna offerten?"</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>Du, igår</span>
              </div>
            </div>

            {/* Ärende 3 - Avklarad */}
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl opacity-75">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-white font-medium">Servicebesök - IKEA</h4>
                  <p className="text-sm text-slate-400">Avtal</p>
                </div>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Avklarad
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-2">"Fakturan är skickad"</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>Erik, förra veckan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-blue-300 mb-2">Tips!</h5>
              <p className="text-slate-300">
                Använd <strong className="text-white">filtren</strong> för att se bara det som väntar på dig.
                Sök på <strong className="text-white">fakturanummer</strong> eller <strong className="text-white">nyckelord</strong> för att snabbt hitta rätt ärende.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 10,
    title: 'Vanliga frågor (FAQ)',
    subtitle: 'Svar på det du undrar',
    icon: HelpCircle,
    iconColor: 'text-pink-400',
    content: (
      <div className="space-y-6">
        {/* FAQ-kort */}
        {[
          {
            question: 'Vem kan se mina meddelanden?',
            answer: 'Alla som har tillgång till ärendet kan se alla meddelanden. Intern kommunikation är INTE synlig för kunder.',
            icon: Users
          },
          {
            question: 'Kan jag redigera eller ta bort ett meddelande?',
            answer: 'Ja, klicka på "..." bredvid ditt eget meddelande för att redigera eller ta bort det.',
            icon: MessageCircle
          },
          {
            question: 'Varför får jag inga notifikationer?',
            answer: 'Du får bara notis när någon taggar DIG eller din ROLL. Kontrollera att du är inloggad och att klockan har rätt antal.',
            icon: Bell
          },
          {
            question: 'Vad är skillnaden på @person och @roll?',
            answer: '@person taggar EN specifik person. @roll (t.ex. @Koordinator) taggar ALLA med den rollen.',
            icon: AtSign
          },
          {
            question: 'Vad betyder färgerna i Intern Administration?',
            answer: 'Röd = Väntar på DITT svar. Gul = Frågor DU ställt som väntar. Grön = Avklarade ärenden.',
            icon: Filter
          },
          {
            question: 'Hur söker jag efter gamla meddelanden?',
            answer: 'Gå till Intern Administration och använd sökfältet. Du kan söka på nyckelord, fakturanummer, eller personnamn.',
            icon: Search
          },
          {
            question: 'Kan jag bifoga filer?',
            answer: 'Ja! I vissa ärenden kan du ladda upp bilder. Klicka på bild-ikonen i chattfältet.',
            icon: MessageSquareText
          },
          {
            question: 'Vad händer när jag markerar något som löst?',
            answer: 'Ärendet flyttas till "Arkiv"-fliken i Intern Administration. Du kan alltid återöppna det om det behövs.',
            icon: CheckCircle2
          }
        ].map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-pink-500/20 rounded-lg flex-shrink-0">
                  <faq.icon className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">{faq.question}</h4>
                  <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    )
  },
  {
    id: 11,
    title: 'Sammanfattning',
    subtitle: 'Allt du behöver komma ihåg',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    content: (
      <div className="space-y-8">
        {/* Stora steg */}
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-white text-center mb-6">
            5 saker att komma ihåg!
          </h4>

          {[
            { step: 1, text: 'Skriv i "Aktivitet"-sektionen i ärendet', color: 'cyan', icon: MessageSquareText },
            { step: 2, text: 'Använd @namn för att tagga en person', color: 'purple', icon: AtSign },
            { step: 3, text: 'Använd @Roll för att nå en hel grupp', color: 'amber', icon: Users },
            { step: 4, text: 'Klicka "Svara" för att svara på ett meddelande', color: 'slate', icon: Reply },
            { step: 5, text: 'Klicka på klockan för att se dina notifikationer', color: 'yellow', icon: Bell },
          ].map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15 }}
                className="flex items-center gap-4 p-5 rounded-xl"
                style={{
                  background: `rgba(${
                    item.color === 'cyan' ? '6, 182, 212' :
                    item.color === 'purple' ? '168, 85, 247' :
                    item.color === 'amber' ? '245, 158, 11' :
                    item.color === 'slate' ? '100, 116, 139' :
                    '234, 179, 8'
                  }, 0.1)`,
                  border: `2px solid rgba(${
                    item.color === 'cyan' ? '6, 182, 212' :
                    item.color === 'purple' ? '168, 85, 247' :
                    item.color === 'amber' ? '245, 158, 11' :
                    item.color === 'slate' ? '100, 116, 139' :
                    '234, 179, 8'
                  }, 0.3)`
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                  style={{
                    background: item.color === 'cyan' ? '#06b6d4' :
                                item.color === 'purple' ? '#a855f7' :
                                item.color === 'amber' ? '#f59e0b' :
                                item.color === 'slate' ? '#64748b' :
                                '#eab308'
                  }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-lg text-white font-medium">{item.text}</span>
              </motion.div>
            )
          })}
        </div>

        {/* @mention-förklaring */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AtSign className="w-5 h-5 text-purple-400" />
            @Mentions på en blick:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
              <User className="w-8 h-8 text-purple-400 mx-auto mb-2" />
              <p className="font-mono text-purple-300 text-lg">@Anna</p>
              <p className="text-sm text-slate-400 mt-1">En person</p>
            </div>
            <div className="text-center p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
              <Users className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="font-mono text-amber-300 text-lg">@Koordinator</p>
              <p className="text-sm text-slate-400 mt-1">En hel roll</p>
            </div>
            <div className="text-center p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
              <Users2 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="font-mono text-cyan-300 text-lg">@alla</p>
              <p className="text-sm text-slate-400 mt-1">Alla i ärendet</p>
            </div>
          </div>
        </div>

        {/* Uppmuntran */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-teal-500/20 rounded-2xl p-6 border border-cyan-500/30 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block mb-4"
          >
            <ThumbsUp className="w-16 h-16 text-cyan-400" />
          </motion.div>
          <h4 className="text-2xl font-bold text-cyan-300 mb-2">Du klarar detta!</h4>
          <p className="text-lg text-slate-300">
            Nästa gång du har en fråga i ett ärende - skriv den direkt i chatten och tagga den som kan hjälpa dig!
          </p>
        </div>
      </div>
    )
  }
]

// ============================================================================
// HUVUDKOMPONENT
// ============================================================================

export default function CommunicationSystemGuide() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const handleStepComplete = (stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]))
  }

  const goToStep = (stepIndex: number) => {
    if (stepIndex > currentStep) {
      handleStepComplete(currentStep)
    }
    setCurrentStep(stepIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToNextStep = () => {
    if (currentStep < guideSteps.length - 1) {
      handleStepComplete(currentStep)
      setCurrentStep(currentStep + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const currentStepData = guideSteps[currentStep]
  const progress = ((currentStep + 1) / guideSteps.length) * 100

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white">Guide: Kommunikationssystemet</h1>
              <p className="text-sm text-slate-400">Steg {currentStep + 1} av {guideSteps.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <MessageSquareText className="w-6 h-6 text-cyan-400" />
            </div>
          </div>

          {/* Progress bar - STOR och tydlig */}
          <div className="mt-4">
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Start</span>
              <span>{Math.round(progress)}% klart</span>
              <span>Mål</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar med steg-navigering (desktop) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-40">
              <Card className="p-4">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                  Innehåll
                </h3>
                <nav className="space-y-1">
                  {guideSteps.map((step, index) => {
                    const isActive = index === currentStep
                    const isCompleted = completedSteps.has(index)

                    return (
                      <button
                        key={step.id}
                        onClick={() => goToStep(index)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : isCompleted
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-cyan-500 text-white'
                            : isCompleted
                              ? 'bg-cyan-500/30 text-cyan-400'
                              : 'bg-slate-700 text-slate-400'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{step.title}</span>
                      </button>
                    )
                  })}
                </nav>
              </Card>
            </div>
          </div>

          {/* Huvudinnehåll */}
          <div className="lg:col-span-8">
            {/* Mobil steg-indikator - STOR */}
            <div className="lg:hidden mb-6 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-2">
                {guideSteps.map((step, index) => {
                  const isActive = index === currentStep
                  const isCompleted = completedSteps.has(index)

                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(index)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-cyan-500 text-white ring-4 ring-cyan-500/30'
                          : isCompleted
                            ? 'bg-cyan-500/30 text-cyan-400'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">{index + 1}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Steginnehåll */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-6 lg:p-8">
                  {/* Steghuvud - STOR */}
                  <div className="flex items-center gap-4 lg:gap-6 mb-8 pb-6 border-b border-slate-700">
                    <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-slate-800 flex items-center justify-center`}>
                      <currentStepData.icon className={`w-8 h-8 lg:w-10 lg:h-10 ${currentStepData.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm lg:text-base text-slate-400 mb-1">Steg {currentStep + 1} av {guideSteps.length}</p>
                      <h2 className="text-xl lg:text-2xl font-bold text-white">{currentStepData.title}</h2>
                      {currentStepData.subtitle && (
                        <p className="text-slate-400 mt-1">{currentStepData.subtitle}</p>
                      )}
                    </div>
                  </div>

                  {/* Steginnehåll */}
                  <div className="min-h-[400px]">
                    {currentStepData.content}
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigeringsknappar - STORA och tydliga */}
            <div className="flex items-center justify-between mt-8 gap-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2 py-4 px-6 text-lg"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Föregående</span>
                <span className="sm:hidden">Bakåt</span>
              </Button>

              {currentStep === guideSteps.length - 1 ? (
                <Button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-cyan-500 hover:bg-cyan-400 text-white"
                >
                  <CheckCircle className="w-5 h-5" />
                  Klar!
                </Button>
              ) : (
                <Button
                  onClick={goToNextStep}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-cyan-500 hover:bg-cyan-400 text-white"
                >
                  <span>Nästa steg</span>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Snabbhjälp längst ner */}
            <div className="mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 text-slate-400">
                <HelpCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">
                  Behöver du mer hjälp? Kontakta kontoret på{' '}
                  <a href="tel:010-2051600" className="text-cyan-400 hover:text-cyan-300">
                    010-205 16 00
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
