// src/pages/technician/guides/CaseCommunicationGuide.tsx
// PEDAGOGISK GUIDE: Hur du kommunicerar i ärenden
// Version 2.0 - Fokuserad på ärendekommunikation (8 steg)
// Bygger på samma struktur som andra guider

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
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Sparkles,
  X,
  Loader2,
  Clock,
  ArrowDown,
  MousePointer2,
  User,
  Users2,
  Shield,
  Image,
  Paperclip,
  FileText,
  History,
  ScrollText
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
  replyingTo,
  showAttachmentButton = false
}: {
  value?: string
  onChange?: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  showSendButton?: boolean
  animated?: boolean
  disabled?: boolean
  replyingTo?: string
  showAttachmentButton?: boolean
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
      {showAttachmentButton && (
        <button className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 rounded-lg transition-colors">
          <Image className="w-5 h-5" />
        </button>
      )}
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
  isReply = false,
  replyCount = 0,
  onReply,
  isNew = false,
  showReplyButton = true,
  animated = false,
  hasImage = false
}: {
  author: string
  authorRole: 'admin' | 'koordinator' | 'technician'
  content: string
  time: string
  isReply?: boolean
  replyCount?: number
  onReply?: () => void
  isNew?: boolean
  showReplyButton?: boolean
  animated?: boolean
  hasImage?: boolean
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
        </div>

        {/* Content */}
        <p className="text-slate-200 text-lg leading-relaxed">
          {highlightMentions(content)}
        </p>

        {/* Image if present */}
        {hasImage && (
          <div className="mt-3 rounded-lg overflow-hidden border border-slate-700">
            <div className="bg-slate-800 h-32 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Image className="w-8 h-8 mx-auto mb-2" />
                <span className="text-sm">skadebild.jpg</span>
              </div>
            </div>
          </div>
        )}

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
        </div>
      </motion.div>
    </motion.div>
  )
}

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
// GUIDE-STEG - 8 steg fokuserade på ärendekommunikation
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
  // STEG 1: Hitta chatten
  {
    id: 1,
    title: 'Hitta chatten',
    subtitle: 'Var finns chattfunktionen i ärendevyn?',
    icon: MessageCircle,
    iconColor: 'text-teal-400',
    content: (
      <div className="space-y-8">
        {/* Introduktion */}
        <div className="text-center py-4">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/20 mb-4"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <MessageCircle className="w-10 h-10 text-teal-400" />
          </motion.div>
          <h3 className="text-xl font-bold text-white mb-2">
            Kommunicera direkt i ärendet!
          </h3>
          <p className="text-lg text-slate-300 max-w-md mx-auto">
            All kommunikation sker inne i ärendet - slipp mejl och telefonsamtal.
          </p>
        </div>

        {/* Instruktion */}
        <div className="bg-teal-500/10 border-2 border-teal-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-teal-300 mb-3 flex items-center gap-3">
            <MessageCircle className="w-6 h-6" />
            Så här hittar du chatten:
          </h4>
          <p className="text-lg text-slate-300">
            Öppna ett ärende och titta på <strong className="text-white">modalens övre högra horn</strong>. Där finns en <strong className="text-purple-300">pratbubbla-ikon</strong> till vänster om stängknappen (X).
          </p>
        </div>

        {/* Simulerad modal-header */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Så här ser det ut när du öppnar ett ärende:</p>

          <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 overflow-hidden">
            {/* MODAL HEADER - HIGHLIGHTAD */}
            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <div className="flex items-center justify-between">
                {/* Titel */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-semibold truncate">Redigera ärende: Familjen Andersson</h3>
                </div>

                {/* Knappär- HIGHLIGHTAD SEKTION */}
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  {/* CHATT-KNAPPEN */}
                  <motion.button
                    className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/20 rounded-lg transition-all duration-200 border-2 border-cyan-500/50"
                    animate={{
                      boxShadow: [
                        '0 0 0 0 rgba(6, 182, 212, 0)',
                        '0 0 15px 5px rgba(6, 182, 212, 0.4)',
                        '0 0 0 0 rgba(6, 182, 212, 0)'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    title="Öppna kommunikation"
                  >
                    <MessageSquareText className="w-5 h-5 text-purple-400" />
                  </motion.button>

                  {/* STANG-KNAPPEN (X) */}
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors opacity-50">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal-innehall (dimmad för att fokusera på headern) */}
            <div className="p-4 opacity-30 blur-[1px]">
              <div className="h-24 bg-slate-800 rounded-lg"></div>
            </div>

            {/* Pil som pekar uppåt mot chattknappen */}
            <div className="p-4 flex items-center justify-end pr-20">
              <motion.div
                className="flex flex-col items-center gap-2 text-cyan-400"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <AnimatedArrow direction="up" />
                <span className="text-lg font-semibold whitespace-nowrap">KLICKA HAR FOR CHATT!</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Förklaring */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <MessageSquareText className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-purple-300 mb-2">När du klickar på pratbubblan:</h5>
              <p className="text-slate-300">
                En <strong className="text-white">kommunikationspanel</strong> glider in från höger sida. Där kan du läsa och skriva meddelanden, tagga kollegor och se hela konversationshistoriken.
              </p>
            </div>
          </div>
        </div>

        {/* Sakerhetsinformation */}
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <Shield className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-amber-300 mb-2">Viktigt att veta:</h5>
              <p className="text-slate-300">
                Kunder kan <strong className="text-white">ALDRIG</strong> se den interna kommunikationen -
                detta gäller även avtalskunder som loggar in i kundportalen.
                Allt ni skriver här är<strong className="text-emerald-400">100% internt</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  // STEG 2: Skriv ett meddelande
  {
    id: 2,
    title: 'Skriv ett meddelande',
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
                  <span>Klicka på <strong className="text-cyan-300">skicka-knappen</strong> (pilen)</span>
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

            {/* Tips */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-blue-300 mb-2">Tips!</h5>
                  <p className="text-slate-300">
                    Du kan äventrycka <strong className="text-white">Enter</strong> för att skicka meddelandet snabbt.
                    Anvand <strong className="text-white">Shift+Enter</strong> för ny rad utan att skicka.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <WriteAndSendDemo />
    })()
  },
  // STEG 3: @Mentions
  {
    id: 3,
    title: '@Mentions',
    subtitle: 'INTERAKTIV DEMO - prova själv!',
    icon: AtSign,
    iconColor: 'text-purple-400',
    content: (() => {
      const MentionDemo = () => {
        const [text, setText] = useState('')
        const [showSuggestions, setShowSuggestions] = useState(false)
        const [selectedMention, setSelectedMention] = useState<string | null>(null)
        const [mentionType, setMentionType] = useState<'person' | 'role' | null>(null)

        const personSuggestions = [
          { type: 'user' as const, name: 'Mathias Carlsson', subtitle: 'Tekniker' },
          { type: 'user' as const, name: 'Anna Svensson', subtitle: 'Koordinator' },
          { type: 'user' as const, name: 'Erik Johansson', subtitle: 'Admin' },
        ]

        const roleSuggestions = [
          { type: 'role' as const, name: 'Koordinator', subtitle: 'Alla koordinatorer (4 pers)' },
          { type: 'role' as const, name: 'Tekniker', subtitle: 'Alla tekniker (12 pers)' },
          { type: 'role' as const, name: 'Admin', subtitle: 'Alla administratorer (2 pers)' },
          { type: 'all' as const, name: 'alla', subtitle: 'Alla i ärendet (18 pers)' },
        ]

        useEffect(() => {
          if (text.endsWith('@')) {
            setShowSuggestions(true)
          } else if (!text.includes('@')) {
            setShowSuggestions(false)
          }
        }, [text])

        const handleSelectPerson = (index: number) => {
          const mention = personSuggestions[index]
          setText(text.slice(0, -1) + `@${mention.name} `)
          setSelectedMention(mention.name)
          setMentionType('person')
          setShowSuggestions(false)
        }

        const handleSelectRole = (index: number) => {
          const mention = roleSuggestions[index]
          setText(text.slice(0, -1) + `@${mention.name} `)
          setSelectedMention(mention.name)
          setMentionType('role')
          setShowSuggestions(false)
        }

        return (
          <div className="space-y-8">
            {/* Introduktion */}
            <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-purple-300 mb-3 flex items-center gap-3">
                <AtSign className="w-6 h-6" />
                Tagga kollegor med @mentions:
              </h4>
              <p className="text-lg text-slate-300">
                Skriv <strong className="font-mono text-purple-300">@</strong> för att se förslag på personer och roller.
                Den du taggar får en <strong className="text-amber-300">notifikation</strong> direkt!
              </p>
            </div>

            {/* Tvåtyper av mentions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tagga en person */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-purple-300">@Person</h5>
                    <p className="text-sm text-slate-400">TaggåEN specifik person</p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-3">
                  Exempel: <span className="font-mono text-purple-300">@Anna Svensson</span>
                </p>
                <div className="space-y-2">
                  {personSuggestions.slice(0, 2).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectPerson(i)}
                      className="w-full p-2 bg-slate-900/50 rounded-lg text-left hover:bg-purple-500/10 transition-colors flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <User className="w-3 h-3 text-purple-400" />
                      </div>
                      <span className="text-sm text-white">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tagga en roll */}
              <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-amber-300">@Roll</h5>
                    <p className="text-sm text-slate-400">TaggåALLA med en viss roll</p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-3">
                  Exempel: <span className="font-mono text-amber-300">@Koordinator</span>
                </p>
                <div className="space-y-2">
                  {roleSuggestions.slice(0, 2).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectRole(i)}
                      className="w-full p-2 bg-slate-900/50 rounded-lg text-left hover:bg-amber-500/10 transition-colors flex items-center gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Users className="w-3 h-3 text-amber-400" />
                      </div>
                      <span className="text-sm text-white">@{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova själv - skriv @ i fältet:</p>

              <div className="relative bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
                <MockMentionSuggestions
                  suggestions={[...personSuggestions.slice(0, 2), ...roleSuggestions.slice(0, 2)]}
                  onSelect={(index) => {
                    if (index < 2) handleSelectPerson(index)
                    else handleSelectRole(index - 2)
                  }}
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
                    Du taggade: <strong className={mentionType === 'person' ? 'text-purple-300' : 'text-amber-300'}>@{selectedMention}</strong>
                  </span>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center gap-3 text-amber-300">
                    <Sparkles className="w-6 h-6" />
                    <span className="text-lg">
                      {mentionType === 'person'
                        ? `${selectedMention} får nu en notifikation!`
                        : `Alla ${selectedMention.toLowerCase()}er får nu en notifikation!`
                      }
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Varning om @alla */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-red-300 mb-2">Var sparsam med @alla!</h5>
                  <p className="text-slate-300">
                    <strong className="text-cyan-300">@alla</strong> skickar notis till ALLA med tillgång till ärendet.
                    Använd det bara när det verkligen är viktigt för alla att veta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <MentionDemo />
    })()
  },
  // STEG 4: Svara i tråd
  {
    id: 4,
    title: 'Svara i tråd',
    subtitle: 'INTERAKTIV DEMO - prova själv!',
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
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - klicka på"Svara":</p>

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

            {/* Fördelar med trådar*/}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-blue-300 mb-2">Varför använda svar?</h5>
                  <ul className="text-slate-300 space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
                      <span>Håller samtalen <strong className="text-white">organiserade</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
                      <span>Lättare att följa vem som svarade på vad</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-1" />
                      <span>Särskilt viktigt när många är inblandade</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <ReplyDemo />
    })()
  },
  // STEG 5: Konversationshistorik
  {
    id: 5,
    title: 'Konversationshistorik',
    subtitle: 'Se tidigare meddelanden',
    icon: History,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-blue-300 mb-3 flex items-center gap-3">
            <History className="w-6 h-6" />
            All kommunikation sparas i ärendet:
          </h4>
          <p className="text-lg text-slate-300">
            Alla meddelanden från <strong className="text-white">alla kollegor</strong> sparas permanent i ärendet.
            Du kan alltid gå tillbaka och se vad som skrivits tidigare.
          </p>
        </div>

        {/* Simulerad chatthistorik */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Exempel på konversationshistorik:</p>

          <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
            {/* Tidsstampel */}
            <div className="text-center">
              <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">14 januari 2025</span>
            </div>

            <MockCommentItem
              author="Erik Admin"
              authorRole="admin"
              content="Nytt ärende inkommit. @Koordinator kan ni boka in ett besök?"
              time="09:15"
              showReplyButton={false}
            />

            <MockCommentItem
              author="Anna Svensson"
              authorRole="koordinator"
              content="Absolut! Jag bokar in @Mathias Carlsson på torsdag."
              time="09:45"
              showReplyButton={false}
            />

            {/* Tidsstampel */}
            <div className="text-center">
              <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">16 januari 2025</span>
            </div>

            <MockCommentItem
              author="Mathias Carlsson"
              authorRole="technician"
              content="Besoket klart! Hittade mögelskador i källaren. Bifogar bilder."
              time="14:30"
              showReplyButton={false}
              hasImage
            />

            <MockCommentItem
              author="Anna Svensson"
              authorRole="koordinator"
              content="Tack! Jag kontaktar kunden med offert."
              time="15:00"
              isReply
              showReplyButton={false}
            />
          </div>
        </div>

        {/* Fördelär*/}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <ScrollText className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-emerald-300">Spårbarhet</span>
            </div>
            <p className="text-sm text-slate-400">Allt dokumenteras automatiskt - inga mejl att leta efter</p>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-emerald-300">Samarbete</span>
            </div>
            <p className="text-sm text-slate-400">Alla kollegor ser samma information</p>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-amber-300 mb-2">Tips!</h5>
              <p className="text-slate-300">
                När du tar över ett ärende från en kollega - <strong className="text-white">läs alltid igenom historiken först</strong>.
                Då får du en bild av vad som redan gjorts.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  // STEG 6: Bilder och bilagor
  {
    id: 6,
    title: 'Bilder och bilagor',
    subtitle: 'Bifogafoton och filer',
    icon: Image,
    iconColor: 'text-emerald-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-emerald-300 mb-3 flex items-center gap-3">
            <Image className="w-6 h-6" />
            Dela bilder med kollegor:
          </h4>
          <p className="text-lg text-slate-300">
            Du kan bifogå<strong className="text-white">bilder och filer</strong> till dina meddelanden.
            Perfekt för att visa skador, dokument eller annat relevant material.
          </p>
        </div>

        {/* Hur man bifogär*/}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Så här bifogar du en bild:</p>

          <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
            <div className="space-y-4">
              {/* Steg 1 */}
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">1</span>
                <div className="flex-1">
                  <p className="text-white font-medium mb-2">Klicka på bild-ikonen</p>
                  <div className="p-3 bg-slate-800/50 rounded-lg inline-flex items-center gap-2 border border-slate-700">
                    <motion.button
                      className="p-2 bg-slate-700 rounded-lg text-emerald-400"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Image className="w-5 h-5" />
                    </motion.button>
                    <span className="text-slate-400 text-sm">i chattfältet</span>
                  </div>
                </div>
              </div>

              {/* Steg 2 */}
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">2</span>
                <div className="flex-1">
                  <p className="text-white font-medium mb-2">Välj en bild från din enhet</p>
                  <div className="p-4 bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-600">
                    <div className="text-center text-slate-400">
                      <Paperclip className="w-6 h-6 mx-auto mb-2" />
                      <p className="text-sm">Välj fil eller dra och släpp här</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Steg 3 */}
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">3</span>
                <div className="flex-1">
                  <p className="text-white font-medium mb-2">Lägg till en kommentar och skicka</p>
                  <MockCommentInput
                    value="Här är bild på skadan i källaren"
                    showAttachmentButton
                    placeholder=""
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Exempel på meddelande med bild */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Så här ser ett meddelande med bild ut:</p>

          <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5">
            <MockCommentItem
              author="Du"
              authorRole="technician"
              content="Hittade omfattande skador i källaren. @Koordinator vi behöver ta in en fuktexpert."
              time="Just nu"
              showReplyButton={false}
              hasImage
            />
          </div>
        </div>

        {/* Filtyper */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Tillåtna filtyper:
          </h5>
          <div className="flex flex-wrap gap-2">
            {['JPG', 'PNG', 'PDF', 'HEIC'].map(type => (
              <span key={type} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-mono">
                .{type.toLowerCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Mobiltips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-blue-300 mb-2">Påmobilen?</h5>
              <p className="text-slate-300">
                Påmobilen kan du <strong className="text-white">ta en bild direkt</strong> med kameran
                och bifoga den till meddelandet. Perfekt för att dokumentera i fält!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  // STEG 7: Kommunikationstips
  {
    id: 7,
    title: 'Kommunikationstips',
    subtitle: 'Best practices för tydlig kommunikation',
    icon: ThumbsUp,
    iconColor: 'text-amber-400',
    content: (
      <div className="space-y-8">
        {/* Introduktion */}
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-3">
            <ThumbsUp className="w-6 h-6" />
            Kommunicera effektivt:
          </h4>
          <p className="text-lg text-slate-300">
            Bra kommunikation sparar tid för alla. Här är några tips för att göra dig förstådd!
          </p>
        </div>

        {/* Gör så här */}
        <div className="space-y-4">
          <h5 className="text-lg font-semibold text-green-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Gör så här:
          </h5>

          <div className="space-y-3">
            {[
              {
                title: 'Vartydlig med vad du behöver',
                bad: '@Koordinator kolla på detta',
                good: '@Koordinator kan ni ringa kunden och bestämma tid för återbesök?'
              },
              {
                title: 'Tagga rätt person/roll',
                bad: 'Kan någon hjälpa mig?',
                good: '@Admin behöver hjälp med fakturering'
              },
              {
                title: 'Ge kontext',
                bad: 'Det är klart nu',
                good: 'Besoket hos Andersson är klart. Hittade ingen aktivitet - återkom om 2 veckor.'
              }
            ].map((tip, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <h6 className="font-medium text-white mb-3">{tip.title}</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1 text-red-400 text-sm font-medium">
                      <X className="w-4 h-4" />
                      Undvik
                    </div>
                    <p className="text-slate-400 text-sm italic">"{tip.bad}"</p>
                  </div>
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1 text-green-400 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" />
                      Bättre
                    </div>
                    <p className="text-slate-300 text-sm">"{tip.good}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Snabbtips */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400" />
            Snabbtips:
          </h5>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-slate-300">Svara på meddelanden <strong className="text-white">inom rimlig tid</strong> - kollegor väntar</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-slate-300">Anvand <strong className="text-white">svara-funktionen</strong> för att hålla samtal organiserade</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-slate-300">Bifoga <strong className="text-white">bilder</strong> när det hjälper till att förklara</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-slate-300">Skriv <strong className="text-white">kort och koncist</strong> - ingen roman</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  // STEG 8: Vanliga frågor (FAQ)
  {
    id: 8,
    title: 'Vanliga frågor',
    subtitle: 'Svärpådet du undrar',
    icon: HelpCircle,
    iconColor: 'text-pink-400',
    content: (
      <div className="space-y-6">
        {/* FAQ-kort */}
        {[
          {
            question: 'Vem kan se mina meddelanden?',
            answer: 'Alla BeGone-anställda med tillgång till ärendet kan se meddelandena. Kunder kan ALDRIG se den interna kommunikationen - detta gäller privatpersoner, företag OCH avtalskunder.',
            icon: Users
          },
          {
            question: 'Kan jag redigera eller ta bort ett meddelande?',
            answer: 'Ja, klicka på"..." bredvid ditt eget meddelande för att redigera eller ta bort det.',
            icon: MessageCircle
          },
          {
            question: 'Vad ärskillnaden på@person och @roll?',
            answer: '@person taggärEN specifik person. @roll (t.ex. @Koordinator) taggärALLA med den rollen.',
            icon: AtSign
          },
          {
            question: 'Hur bifogärjag bilder?',
            answer: 'Klicka på bild-ikonen i chattfältet. Påmobilen kan du ta en bild direkt med kameran.',
            icon: Image
          },
          {
            question: 'Kan jag se gamla meddelanden?',
            answer: 'Ja! All kommunikation sparas permanent i ärendet. Scrolla uppåt i chatten för att se äldre meddelanden.',
            icon: History
          },
          {
            question: 'Hur vet jag om någon svarat?',
            answer: 'Du får en notifikation när någon taggar dig eller svarar på ditt meddelande. Se Ticket-guiden för mer om notifikationer.',
            icon: Sparkles
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

        {/* Sammanfattning */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-teal-500/20 rounded-2xl p-6 border border-cyan-500/30 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block mb-4"
          >
            <ThumbsUp className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <h4 className="text-xl font-bold text-cyan-300 mb-2">Du klarärdetta!</h4>
          <p className="text-lg text-slate-300">
            Nästa gång du hären fragåi ett ärende - skriv den direkt i chatten och taggåden som kan hjälpådig!
          </p>
        </div>

        {/* @mention-sammanfattning */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AtSign className="w-5 h-5 text-purple-400" />
            @Mentions påen blick:
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
      </div>
    )
  }
]

// ============================================================================
// HUVUDKOMPONENT
// ============================================================================

export default function CaseCommunicationGuide() {
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
              <h1 className="text-lg font-semibold text-white">Guide: Arendekommunikation</h1>
              <p className="text-sm text-slate-400">Steg {currentStep + 1} av {guideSteps.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <MessageSquareText className="w-6 h-6 text-cyan-400" />
            </div>
          </div>

          {/* Progress bär*/}
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
          {/* Sidebärmed steg-navigering (desktop) */}
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

          {/* Huvudinnehall */}
          <div className="lg:col-span-8">
            {/* Mobil steg-indikator */}
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

            {/* Steginnehall */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-6 lg:p-8">
                  {/* Steghuvud */}
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

                  {/* Steginnehall */}
                  <div className="min-h-[400px]">
                    {currentStepData.content}
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigeringsknappär*/}
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

            {/* Snabbhjälp langst ner */}
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
