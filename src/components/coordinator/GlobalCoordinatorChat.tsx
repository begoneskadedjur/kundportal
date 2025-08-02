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
  Target,
  CheckCircle,
  AlertTriangle
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
  const [isBooking, setIsBooking] = useState(false);
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      
      // Handle booking if present
      if (data.booking) {
        setIsBooking(false);
        if (data.booking.success) {
          toast.success(`✅ Bokning skapad! Ärendenummer: ${data.booking.case_number}`, {
            duration: 5000
          });
          
          // Add a system message about the successful booking
          const bookingConfirmMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: `🎉 **Bokning bekräftad!**\n\n✅ Ärendenummer: **${data.booking.case_number}**\n✅ Case ID: ${data.booking.case_id}\n\nÄrendet har skapats i systemet och synkroniserats med ClickUp.`,
            timestamp: new Date(),
            context: 'booking'
          };
          setMessages(prev => [...prev, bookingConfirmMessage]);
        } else {
          const errorDetails = data.booking.validationErrors 
            ? `\n\nFel: ${data.booking.validationErrors.join(', ')}`
            : '';
          
          toast.error(`❌ Bokning misslyckades: ${data.booking.error || 'Okänt fel'}${errorDetails}`, {
            duration: 8000
          });
          
          // Add error message to chat
          const errorMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: `❌ **Bokning misslyckades**\n\nFel: ${data.booking.error || 'Okänt fel'}\n\n${data.booking.message || 'Försök igen eller kontakta administratör.'}${errorDetails}`,
            timestamp: new Date(),
            context: 'error'
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else if (data.response && data.response.includes('shouldCreateBooking')) {
        // AI tried to create booking but it's still in the response
        setIsBooking(true);
        toast.loading('Skapar bokning...', { duration: 2000 });
      }
      
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
      className={`fixed bottom-6 right-6 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl transition-all duration-300 z-50 flex flex-col ${
        isMinimized 
          ? 'w-80 h-16' 
          : 'w-[28rem] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-4rem)] sm:max-w-[calc(100vw-3rem)] sm:max-h-[calc(100vh-6rem)]'
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
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 sm:gap-3 max-w-[90%] sm:max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
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
                        {message.context === 'booking' && <CheckCircle className="w-3 h-3 text-green-400" />}
                        {message.context === 'error' && <AlertTriangle className="w-3 h-3 text-red-400" />}
                        {message.context}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    <p className="text-xs text-slate-400 mt-1 sm:mt-2">
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
                      {isBooking ? 'Skapar bokning...' : 'Analyserar...'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>


          {/* Input */}
          <div className="flex-shrink-0 p-3 sm:p-4 border-t border-slate-700 bg-slate-900">
            <div className="flex gap-2 mb-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Fråga om schema, tekniker, priser, eller boka nya ärenden..."
                className="flex-1 bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm min-w-0 resize-none min-h-[40px] max-h-[120px]"
                disabled={isLoading}
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '40px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
              <Button
                variant="primary"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 flex-shrink-0 self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Context indicator */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
              <span className="truncate">Ansluten till {currentPage} • {coordinatorData ? 'Data laddad' : 'Laddar data...'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}