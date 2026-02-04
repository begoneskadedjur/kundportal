// src/pages/admin/TeamChat.tsx
// Team AI Chat - Centraliserad AI-lösning för hela teamet

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  sendTeamChatMessage,
  generateImage,
  createConversation,
  getConversations,
  getConversationWithMessages,
  saveMessage,
  logUsage,
  getUserUsageStats,
  getTotalUsageStats,
  updateConversationTitle,
  deleteConversation,
  TeamChatMessage,
  TeamChatConversation,
  UsageStats
} from '../../services/teamChatService';
import toast from 'react-hot-toast';
import {
  Send,
  Image,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  MessageSquare,
  BarChart3,
  X,
  Loader2
} from 'lucide-react';

export default function TeamChat() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<TeamChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<TeamChatConversation | null>(null);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [userStats, setUserStats] = useState<UsageStats | null>(null);
  const [totalStats, setTotalStats] = useState<UsageStats | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ladda konversationer vid mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Scrolla till botten när meddelanden ändras
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    const convs = await getConversations();
    setConversations(convs);
  };

  const loadConversation = async (conversationId: string) => {
    const conv = await getConversationWithMessages(conversationId);
    if (conv) {
      setCurrentConversation(conv);
      setMessages(conv.messages || []);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;

    const userStatsData = await getUserUsageStats(user.id, getMonthStart());
    setUserStats(userStatsData);

    if (profile?.role === 'admin') {
      const totalStatsData = await getTotalUsageStats(getMonthStart());
      setTotalStats(totalStatsData);
    }
  };

  const getMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const handleNewConversation = async () => {
    if (!user?.id) return;

    const title = `Ny konversation ${new Date().toLocaleDateString('sv-SE')}`;
    const conversationId = await createConversation(title, user.id);

    if (conversationId) {
      await loadConversations();
      await loadConversation(conversationId);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !selectedImage) || isLoading) return;

    // Skapa konversation om det inte finns en
    let convId = currentConversation?.id;
    if (!convId && user?.id) {
      const title = inputMessage.slice(0, 50) || 'Bildanalys';
      convId = await createConversation(title, user.id);
      if (convId) {
        await loadConversations();
        setCurrentConversation({
          id: convId,
          title,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    if (!convId) {
      toast.error('Kunde inte skapa konversation');
      return;
    }

    // Lägg till användarens meddelande
    const userMessage: TeamChatMessage = {
      role: 'user',
      content: inputMessage || 'Analysera bilden',
      image_urls: selectedImage ? ['uploaded_image'] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Spara användarens meddelande
      await saveMessage(convId, 'user', userMessage.content, user?.id);

      // Skicka till AI
      const response = await sendTeamChatMessage(
        inputMessage,
        messages,
        selectedImage?.base64,
        selectedImage?.mimeType
      );

      setSelectedImage(null);

      if (response.success && response.response) {
        // Lägg till AI:s svar
        const aiMessage: TeamChatMessage = {
          role: 'assistant',
          content: response.response
        };
        setMessages(prev => [...prev, aiMessage]);

        // Spara AI:s svar
        await saveMessage(convId, 'assistant', response.response);

        // Logga användning
        if (user?.id && response.usage) {
          await logUsage(
            user.id,
            convId,
            response.usage.model,
            response.usage.input_tokens,
            response.usage.output_tokens,
            response.usage.images_analyzed || 0,
            response.usage.images_generated || 0,
            response.usage.estimated_cost_usd
          );
        }
      } else {
        toast.error(response.error || 'Kunde inte få svar från AI');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Bilden får max vara 10 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string)?.split(',')[1];
      if (base64) {
        setSelectedImage({
          base64,
          mimeType: file.type
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteConversation = async (convId: string) => {
    if (!confirm('Vill du ta bort denna konversation?')) return;

    const success = await deleteConversation(convId);
    if (success) {
      await loadConversations();
      if (currentConversation?.id === convId) {
        setCurrentConversation(null);
        setMessages([]);
      }
      toast.success('Konversation borttagen');
    }
  };

  const handleUpdateTitle = async (convId: string) => {
    if (!newTitle.trim()) return;

    const success = await updateConversationTitle(convId, newTitle);
    if (success) {
      await loadConversations();
      if (currentConversation?.id === convId) {
        setCurrentConversation(prev => prev ? { ...prev, title: newTitle } : null);
      }
      setEditingTitle(null);
      setNewTitle('');
    }
  };

  const formatCost = (costUsd: number) => {
    const costSek = costUsd * 10; // Ungefärlig växelkurs
    return `${costSek.toFixed(2)} kr`;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-slate-700">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Ny konversation
          </button>
        </div>

        {/* Konversationslista */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                currentConversation?.id === conv.id
                  ? 'bg-slate-700'
                  : 'hover:bg-slate-700/50'
              }`}
              onClick={() => loadConversation(conv.id)}
            >
              {editingTitle === conv.id ? (
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-600 rounded text-sm"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleUpdateTitle(conv.id)}
                  />
                  <button
                    onClick={() => handleUpdateTitle(conv.id)}
                    className="text-emerald-500 hover:text-emerald-400"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium truncate flex-1">
                      {conv.title}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingTitle(conv.id);
                          setNewTitle(conv.title);
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteConversation(conv.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {conv.creator_name} • {new Date(conv.updated_at).toLocaleDateString('sv-SE')}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Statistik-knapp */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={() => {
              setShowStats(true);
              loadStats();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            Användningsstatistik
          </button>
        </div>
      </div>

      {/* Huvudinnehåll */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <h1 className="text-white font-medium">
              {currentConversation?.title || 'Team AI Chat'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
              Gemini 2.5 Flash
            </span>
          </div>
        </div>

        {/* Meddelandeområde */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Sparkles className="w-16 h-16 mb-4 text-emerald-500" />
              <h2 className="text-xl font-medium text-white mb-2">Team AI Chat</h2>
              <p className="text-center max-w-md">
                Ställ frågor, analysera bilder, eller få hjälp med texter.
                All konversationshistorik sparas för teamet.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-100'
                  }`}
                >
                  {msg.image_urls && msg.image_urls.length > 0 && (
                    <div className="mb-2 text-sm opacity-75">
                      [Bild bifogad]
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-700 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                  <span className="text-slate-300">Tänker...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Vald bild-preview */}
        {selectedImage && (
          <div className="px-4 py-2 bg-slate-800 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <div className="relative">
                <img
                  src={`data:${selectedImage.mimeType};base64,${selectedImage.base64}`}
                  alt="Vald bild"
                  className="h-16 w-16 object-cover rounded-lg"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <span className="text-sm text-slate-400">Bild kommer att analyseras</span>
            </div>
          </div>
        )}

        {/* Inputfält */}
        <div className="p-4 bg-slate-800 border-t border-slate-700">
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Ladda upp bild"
            >
              <Image className="w-6 h-6" />
            </button>
            <textarea
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Skriv ett meddelande... (Enter för att skicka)"
              className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || (!inputMessage.trim() && !selectedImage)}
              className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Send className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Statistik-modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Användningsstatistik</h2>
              <button
                onClick={() => setShowStats(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Din användning */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Din användning denna månad</h3>
                {userStats ? (
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Meddelanden" value={userStats.total_messages} />
                    <StatCard label="Kostnad" value={formatCost(userStats.total_cost_usd)} />
                    <StatCard label="Bilder analyserade" value={userStats.total_images_analyzed} />
                    <StatCard label="Bilder genererade" value={userStats.total_images_generated} />
                  </div>
                ) : (
                  <p className="text-slate-400">Laddar...</p>
                )}
              </div>

              {/* Total användning (endast admin) */}
              {profile?.role === 'admin' && totalStats && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Total användning (hela teamet)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Meddelanden" value={totalStats.total_messages} />
                    <StatCard label="Total kostnad" value={formatCost(totalStats.total_cost_usd)} highlight />
                    <StatCard label="Bilder analyserade" value={totalStats.total_images_analyzed} />
                    <StatCard label="Bilder genererade" value={totalStats.total_images_generated} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-slate-700'}`}>
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`text-xl font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
