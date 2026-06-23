import { create } from 'zustand';
import { axiosClient, getCookie } from '../../../services/axios-client';
import { AUTH_KEYS } from '../../../lib/constants/auth.constants';

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streamingState: 'Pending' | 'Streaming' | 'Completed' | 'Failed' | 'Cancelled';
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface AIState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  abortController: AbortController | null;
  currentGenerationId: string | null; // Stream session identifier
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  setActiveConversationId: (id: string | null) => void;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (prompt: string) => Promise<void>;
  cancelStreaming: () => void;
  clearError: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5247/api';

export const useAiStore = create<AIState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  isLoadingConversations: false,
  isLoadingMessages: false,
  abortController: null,
  currentGenerationId: null,
  error: null,

  fetchConversations: async () => {
    set({ isLoadingConversations: true, error: null });
    try {
      const response = await axiosClient.get<Conversation[]>('/ai/chat/conversations');
      set({ conversations: response.data, isLoadingConversations: false });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching conversations:', error);
      set({ error: error.message || 'Failed to load conversations', isLoadingConversations: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const response = await axiosClient.get<Message[]>(`/ai/chat/conversations/${conversationId}/messages`);
      set({ messages: response.data, isLoadingMessages: false });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error fetching messages:', error);
      set({ error: error.message || 'Failed to load messages', isLoadingMessages: false });
    }
  },

  setActiveConversationId: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().fetchMessages(id);
    } else {
      set({ messages: [] });
    }
  },

  deleteConversation: async (id) => {
    set({ error: null });
    try {
      await axiosClient.delete(`/ai/chat/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        messages: state.activeConversationId === id ? [] : state.messages
      }));
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error deleting conversation:', error);
      set({ error: error.message || 'Failed to delete conversation' });
    }
  },

  sendMessage: async (prompt: string) => {
    const { activeConversationId, isStreaming } = get();
    if (isStreaming || !prompt.trim()) return;

    // Create a new AbortController and generate a unique Stream Session ID
    const controller = new AbortController();
    const generationId = Math.random().toString(36).substring(7);
    set({ isStreaming: true, error: null, abortController: controller, currentGenerationId: generationId });

    // 1. Optimistically add User Message
    const tempUserMsgId = `temp-user-${Date.now()}`;
    const optimUserMsg: Message = {
      id: tempUserMsgId,
      conversationId: activeConversationId || '',
      role: 'user',
      content: prompt,
      streamingState: 'Completed',
      createdAt: new Date().toISOString()
    };

    // Optimistically add Pending Assistant Message shell
    const tempAssistantMsgId = `temp-assistant-${Date.now()}`;
    const optimAssistantMsg: Message = {
      id: tempAssistantMsgId,
      conversationId: activeConversationId || '',
      role: 'assistant',
      content: '',
      streamingState: 'Pending',
      createdAt: new Date().toISOString()
    };

    set((state) => ({
      messages: [...state.messages, optimUserMsg, optimAssistantMsg]
    }));

    // Get CSRF Token dynamically
    const csrfToken = getCookie(AUTH_KEYS.CSRF_COOKIE);

    try {
      // 2. Fetch chunk stream using native fetch to support ReadableStream
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-Requested-With': 'XMLHttpRequest'
      };

      if (csrfToken) {
        headers[AUTH_KEYS.CSRF_HEADER] = csrfToken;
      }

      const response = await fetch(`${API_URL}/ai/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          conversationId: activeConversationId || undefined,
          prompt
        }),
        credentials: 'include',
        signal: controller.signal
      });

      // Strict Stream Session Check - abort if session replaced
      if (get().currentGenerationId !== generationId) {
        return;
      }

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error(
            "AI Planner service is temporarily unavailable. Please try again shortly."
          );
        }
        let errMsg = 'Failed to connect to streaming proxy.';
        try {
          const errData = await response.json();
          errMsg = errData.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error('Response body is not readable.');
      }

      let buffer = '';
      let finalContent = '';

      // Update Assistant Message to Streaming state
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempAssistantMsgId ? { ...m, streamingState: 'Streaming' } : m
        )
      }));

      while (true) {
        // Stream session check before read
        if (get().currentGenerationId !== generationId) {
          break;
        }

        const { value, done } = await reader.read();
        if (done) break;

        // Stream session check after async read
        if (get().currentGenerationId !== generationId) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Retain the last unfinished line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine) continue;

          // Parse SSE frame "data: {...}"
          if (cleanedLine.startsWith('data: ')) {
            const dataStr = cleanedLine.slice(6).trim();
            if (dataStr === '[DONE]') {
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.status === "FAILED") {
                throw new Error(data.error || "Chat generation failed.");
              }
              if (data.status === "ABORTED" || data.event === "AI_STREAM_ABORTED") {
                throw new Error("AI_STREAM_ABORTED");
              }
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.token !== undefined) {
                finalContent += data.token;
                
                // Real-time UI updates
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === tempAssistantMsgId ? { ...m, content: finalContent } : m
                  )
                }));
              }
            } catch (e: unknown) {
              const error = e as Error;
              if (error.message === "AI_STREAM_ABORTED" || error.message?.includes("failed") || error.message?.includes("stream error") || error.message?.includes("FastAPI")) {
                throw error;
              }
              // Ignore standard parse warnings on raw metadata
            }
          }
        }
      }

      // Check session before completing
      if (get().currentGenerationId !== generationId) {
        return;
      }

      // 3. Mark Assistant Message as completed
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempAssistantMsgId ? { ...m, streamingState: 'Completed' } : m
        ),
        isStreaming: false,
        abortController: null,
        currentGenerationId: null
      }));

      // Refresh conversation list & sync states
      await get().fetchConversations();
      
      // If this was a new conversation, set active to the latest created conversation
      if (!activeConversationId) {
        const latestConv = get().conversations[0];
        if (latestConv) {
          set({ activeConversationId: latestConv.id });
          await get().fetchMessages(latestConv.id);
        }
      }
    } catch (err: unknown) {
      // Ignore errors if the stream session has changed
      if (get().currentGenerationId !== generationId) {
        return;
      }

      const error = err as Error;
      if (error.name === 'AbortError' || error.message === 'AI_STREAM_ABORTED') {
        console.log('Stream cancelled by user');
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === tempAssistantMsgId
              ? { ...m, content: m.content + '\n\n[Generation cancelled]', streamingState: 'Cancelled' }
              : m
          )
        }));
      } else {
        console.error('Stream processing error:', error);
        set((state) => ({
          error: error.message || 'Stream connection error.',
          messages: state.messages.map((m) =>
            m.id === tempAssistantMsgId
              ? { ...m, content: m.content + `\n\n[Error: ${error.message || 'Connection failure'}]`, streamingState: 'Failed' }
              : m
          )
        }));
      }
      set({ isStreaming: false, abortController: null, currentGenerationId: null });
    }
  },

  cancelStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ currentGenerationId: null });
  },

  clearError: () => set({ error: null })
}));
