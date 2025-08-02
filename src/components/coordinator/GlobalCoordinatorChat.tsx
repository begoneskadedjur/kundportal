// src/components/coordinator/GlobalCoordinatorChat.tsx
// Global AI-assistent för koordinatorer med tillgång till alla ärenden och funktioner

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  Send, 
  X, 
  Bot, 
  User,
  Loader,
  Minimize2,
  Maximize2,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  Map,
  Clock,
  Target
} from 'lucide-react';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { getCoordinatorChatData, CoordinatorChatData } from '../../services/coordinatorChatService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: string; // För att visa vilket område frågan handlar om
}

interface GlobalCoordinatorChatProps {
  currentPage?: string; // Vilken sida användaren är på
  contextData?: any; // Extra kontext från aktuell sida
}

export default function GlobalCoordinatorChat({ currentPage = 'dashboard', contextData }: GlobalCoordinatorChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [coordinatorData, setCoordinatorData] = useState<CoordinatorChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hej! Jag är din AI-assistent för koordinering. Jag har tillgång till alla dina ärenden, tekniker och schema-data. 

Jag kan hjälpa dig med:
🗓️ **Schema & Luckor** - Hitta lediga tider och optimera scheman
👥 **Tekniker-matchning** - Vilken tekniker är bäst för ett specifikt jobb
💰 **Prissättning** - Föreslå priser baserat på liknande ärenden
📊 **Analytics** - Analysera prestanda och trender
🎯 **Optimering** - Förbättringsförslag för effektivitet

Vad kan jag hjälpa dig med idag?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && !coordinatorData) {
      loadCoordinatorData();
    }
  }, [isOpen, isMinimized]);

  const loadCoordinatorData = async () => {
    setIsLoadingData(true);
    try {
      const data = await getCoordinatorChatData();
      setCoordinatorData(data);
    } catch (error) {
      console.error('Failed to load coordinator data:', error);
      toast.error('Kunde inte ladda koordinatordata');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/global-coordinator-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          coordinatorData,
          currentPage,
          contextData,
          conversationHistory: messages.slice(-10) // Senaste 10 meddelanden
        })
      });

      if (!response.ok) {
        throw new Error('Kunde inte skicka meddelande');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        context: data.context
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Kunde inte få svar från AI-assistenten');
      
      // Fallback-svar
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Tyvärr kunde jag inte bearbeta din förfrågan just nu. Försök igen om en stund.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Kontext-specifika frågeförslag baserat på aktuell sida
  const getContextualSuggestions = () => {
    const baseSuggestions = [
      'Vilka tekniker har lediga tider imorgon?',
      'Visa mig ärenden utan schemalagd tid',
      'Vilket pris ska jag sätta för en råttbekämpning?',
      'Vilken tekniker är bäst på myrbekämpning?'
    ];

    const pageSuggestions: Record<string, string[]> = {
      schedule: [
        'Hitta luckor i schemat för nästa vecka',
        'Vilka tekniker är överbelastade?',
        'Optimera rutten för Stockholm imorgon'
      ],
      analytics: [
        'Analysera prestandan för senaste månaden',
        'Vilka är våra mest lönsamma ärendetyper?',
        'Hur kan vi minska schemaläggningstiden?'
      ],
      dashboard: [
        'Sammanfatta dagens viktiga uppgifter',
        'Visa akuta ärenden som behöver åtgärd',
        'Vad är veckans prioriteringar?'
      ]
    };

    return [...baseSuggestions, ...(pageSuggestions[currentPage] || [])];
  };

  const suggestions = getContextualSuggestions();

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-105 group"
          aria-label="Öppna koordinator AI-assistent"
        >
          <div className="relative">
            <Bot className="w-6 h-6" />
            <Sparkles className="w-3 h-3 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
        </button>
        
        {/* Tooltip */}
        <div className="absolute bottom-16 right-0 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          Koordinator AI-Assistent
          <div className="absolute top-full right-4 w-2 h-2 bg-slate-800 rotate-45 transform -translate-y-1"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl transition-all duration-300 z-50 ${
        isMinimized ? 'w-80 h-16' : 'w-[28rem] max-w-[calc(100vw-3rem)] h-[700px] max-h-[calc(100vh-3rem)]'
      }`}
      role="dialog"
      aria-labelledby="chat-title"
      aria-describedby="chat-description"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/80 to-blue-900/80 p-4 rounded-t-lg border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="w-6 h-6 text-purple-300" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <div>
            <h3 id="chat-title" className="font-semibold text-white flex items-center gap-2">
              Koordinator AI
              {isLoadingData && <Loader className="w-4 h-4 animate-spin" />}
            </h3>
            {!isMinimized && (
              <p id="chat-description" className="text-xs text-slate-300">
                Schema • Tekniker • Prissättning • Analytics
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded"
            aria-label={isMinimized ? 'Maximera' : 'Minimera'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Stäng chatt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(100%-12rem)]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' ? 'bg-teal-600' : 'bg-purple-600'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={`rounded-lg px-4 py-3 ${
                    message.role === 'user' 
                      ? 'bg-teal-600/20 border border-teal-600/30 text-white' 
                      : 'bg-slate-800/50 border border-slate-600 text-slate-100'
                  }`}>
                    {message.context && (
                      <div className="text-xs text-purple-300 mb-2 flex items-center gap-1">
                        {message.context === 'schedule' && <Calendar className="w-3 h-3" />}
                        {message.context === 'technician' && <Users className="w-3 h-3" />}
                        {message.context === 'pricing' && <DollarSign className="w-3 h-3" />}
                        {message.context === 'analytics' && <Target className="w-3 h-3" />}
                        {message.context}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {message.timestamp.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[85%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                    <Loader className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-300 text-sm">
                      <Loader className="w-4 h-4 animate-spin" />
                      Analyserar...
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length === 1 && (
            <div className="px-4 pb-3 border-t border-slate-700/50">
              <p className="text-xs text-slate-400 mb-3">Snabbkommandon:</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.slice(0, 4).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(suggestion)}
                    className="text-xs bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600/50 text-slate-300 px-3 py-2 rounded-md transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Fråga om schema, tekniker, priser..."
                className="flex-1 bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <Button
                variant="primary"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-3"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Context indicator */}
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              Ansluten till {currentPage} • {coordinatorData ? 'Data laddad' : 'Laddar data...'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}