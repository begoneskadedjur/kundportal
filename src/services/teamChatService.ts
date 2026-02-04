// src/services/teamChatService.ts
// Service för Team AI Chat - hanterar konversationer, meddelanden och användningsstatistik

import { supabase } from '../lib/supabase';

export interface TeamChatMessage {
  id?: string;
  conversation_id?: string;
  role: 'user' | 'assistant';
  content: string;
  user_id?: string;
  image_urls?: string[];
  file_type?: string;
  created_at?: string;
  generated_image?: {
    data: string;
    mimeType: string;
  };
}

export interface TeamChatConversation {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  messages?: TeamChatMessage[];
  creator_name?: string;
}

export interface UsageStats {
  total_messages: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_images_analyzed: number;
  total_images_generated: number;
  total_cost_usd: number;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  image?: {
    data: string;
    mimeType: string;
  };
  usage?: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    images_analyzed?: number;
    images_generated?: number;
    estimated_cost_usd: number;
  };
  error?: string;
}

// Skicka meddelande till AI
export async function sendTeamChatMessage(
  message: string,
  conversationHistory: TeamChatMessage[] = [],
  imageBase64?: string,
  imageMimeType?: string
): Promise<ChatResponse> {
  try {
    const response = await fetch('/api/team-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory.map(m => ({
          role: m.role,
          content: m.content
        })),
        imageBase64,
        imageMimeType
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Fel vid kommunikation med AI');
    }

    return data;
  } catch (error) {
    console.error('sendTeamChatMessage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel'
    };
  }
}

// Generera bild
export async function generateImage(prompt: string): Promise<ChatResponse> {
  try {
    const response = await fetch('/api/team-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generateImage: true,
        imagePrompt: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Fel vid bildgenerering');
    }

    return data;
  } catch (error) {
    console.error('generateImage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel'
    };
  }
}

// Skapa ny konversation
export async function createConversation(title: string, userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ai_team_conversations')
      .insert({
        title,
        created_by: userId
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('createConversation error:', error);
    return null;
  }
}

// Hämta alla konversationer
export async function getConversations(): Promise<TeamChatConversation[]> {
  try {
    const { data, error } = await supabase
      .from('ai_team_conversations')
      .select(`
        *,
        profiles:created_by (
          display_name
        )
      `)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map(conv => ({
      ...conv,
      creator_name: conv.profiles?.display_name || 'Okänd'
    }));
  } catch (error) {
    console.error('getConversations error:', error);
    return [];
  }
}

// Hämta konversation med meddelanden
export async function getConversationWithMessages(conversationId: string): Promise<TeamChatConversation | null> {
  try {
    const { data: conv, error: convError } = await supabase
      .from('ai_team_conversations')
      .select(`
        *,
        profiles:created_by (
          display_name
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError) throw convError;

    const { data: messages, error: msgError } = await supabase
      .from('ai_team_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    return {
      ...conv,
      creator_name: conv.profiles?.display_name || 'Okänd',
      messages: messages || []
    };
  } catch (error) {
    console.error('getConversationWithMessages error:', error);
    return null;
  }
}

// Spara meddelande
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  userId?: string,
  imageUrls?: string[]
): Promise<TeamChatMessage | null> {
  try {
    const { data, error } = await supabase
      .from('ai_team_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        user_id: userId,
        image_urls: imageUrls
      })
      .select()
      .single();

    if (error) throw error;

    // Uppdatera konversationens updated_at
    await supabase
      .from('ai_team_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  } catch (error) {
    console.error('saveMessage error:', error);
    return null;
  }
}

// Logga användning
export async function logUsage(
  userId: string,
  conversationId: string | null,
  model: string,
  inputTokens: number,
  outputTokens: number,
  imagesAnalyzed: number,
  imagesGenerated: number,
  estimatedCostUsd: number
): Promise<void> {
  try {
    await supabase
      .from('ai_usage_log')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        images_analyzed: imagesAnalyzed,
        images_generated: imagesGenerated,
        estimated_cost_usd: estimatedCostUsd
      });
  } catch (error) {
    console.error('logUsage error:', error);
  }
}

// Hämta användningsstatistik för en användare
export async function getUserUsageStats(userId: string, startDate?: Date): Promise<UsageStats> {
  try {
    let query = supabase
      .from('ai_usage_log')
      .select('input_tokens, output_tokens, images_analyzed, images_generated, estimated_cost_usd')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      total_messages: data?.length || 0,
      total_input_tokens: data?.reduce((sum, row) => sum + (row.input_tokens || 0), 0) || 0,
      total_output_tokens: data?.reduce((sum, row) => sum + (row.output_tokens || 0), 0) || 0,
      total_images_analyzed: data?.reduce((sum, row) => sum + (row.images_analyzed || 0), 0) || 0,
      total_images_generated: data?.reduce((sum, row) => sum + (row.images_generated || 0), 0) || 0,
      total_cost_usd: data?.reduce((sum, row) => sum + parseFloat(row.estimated_cost_usd || '0'), 0) || 0
    };
  } catch (error) {
    console.error('getUserUsageStats error:', error);
    return {
      total_messages: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_images_analyzed: 0,
      total_images_generated: 0,
      total_cost_usd: 0
    };
  }
}

// Hämta total användningsstatistik (för admin)
export async function getTotalUsageStats(startDate?: Date): Promise<UsageStats> {
  try {
    let query = supabase
      .from('ai_usage_log')
      .select('input_tokens, output_tokens, images_analyzed, images_generated, estimated_cost_usd');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      total_messages: data?.length || 0,
      total_input_tokens: data?.reduce((sum, row) => sum + (row.input_tokens || 0), 0) || 0,
      total_output_tokens: data?.reduce((sum, row) => sum + (row.output_tokens || 0), 0) || 0,
      total_images_analyzed: data?.reduce((sum, row) => sum + (row.images_analyzed || 0), 0) || 0,
      total_images_generated: data?.reduce((sum, row) => sum + (row.images_generated || 0), 0) || 0,
      total_cost_usd: data?.reduce((sum, row) => sum + parseFloat(row.estimated_cost_usd || '0'), 0) || 0
    };
  } catch (error) {
    console.error('getTotalUsageStats error:', error);
    return {
      total_messages: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_images_analyzed: 0,
      total_images_generated: 0,
      total_cost_usd: 0
    };
  }
}

// Uppdatera konversationstitel
export async function updateConversationTitle(conversationId: string, title: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_team_conversations')
      .update({ title })
      .eq('id', conversationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('updateConversationTitle error:', error);
    return false;
  }
}

// Ta bort konversation
export async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_team_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('deleteConversation error:', error);
    return false;
  }
}
