"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAiStore } from '@/features/chat/store/use-ai-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Send, 
  Plus, 
  Trash2, 
  MessageSquare, 
  StopCircle, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { Spinner, Typography } from '@heroui/react';
import { useRovingTabindex } from '@/hooks/use-roving-tabindex';
import { parseAndSanitizeMarkdown } from '@/lib/markdown';

export function ChatView() {
  const {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    isLoadingConversations,
    isLoadingMessages,
    error,
    fetchConversations,
    setActiveConversationId,
    deleteConversation,
    sendMessage,
    cancelStreaming,
    clearError
  } = useAiStore();

  const [input, setInput] = useState('');
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    listRef,
    setFocusedIndex,
    handleKeyDown: handleRovingKeyDown,
    getTabindex,
  } = useRovingTabindex({
    itemCount: conversations.length,
    orientation: 'vertical',
  });

  // Initialize conversations list on mount and clean up streaming on unmount
  useEffect(() => {
    fetchConversations();
    return () => {
      cancelStreaming();
    };
  }, [fetchConversations, cancelStreaming]);

  // Smooth scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    const promptToSend = input;
    setInput('');
    await sendMessage(promptToSend);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isStreaming) return;
    await sendMessage(suggestion);
  };

  const startNewChat = () => {
    if (isStreaming) return;
    setActiveConversationId(null);
  };

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMap((prev) => ({ ...prev, [msgId]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => ({ ...prev, [msgId]: false }));
    }, 2000);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] w-full rounded-2xl overflow-hidden border border-border bg-background/50 backdrop-blur-xl shadow-xl select-none font-outfit">
      
      {/* LEFT COLUMN: Sidebar Chat List */}
      <aside className="w-80 border-r border-border flex flex-col bg-background/70 backdrop-blur-md shrink-0">
        <div className="p-4 border-b border-separator flex flex-col gap-3">
          <Button 
            onClick={startNewChat}
            variant="solid" 
            className="w-full flex items-center justify-center gap-2 cursor-pointer"
            disabled={isStreaming}
          >
            <Plus size={16} />
            New Chat
          </Button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {isLoadingConversations ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 select-none">
              <Spinner size="sm" color="accent" />
              <Typography type="body-xs" className="text-muted font-semibold">Loading...</Typography>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-muted text-xs select-none">
              No conversations yet.
            </div>
          ) : (
            <ul
              ref={listRef}
              onKeyDown={handleRovingKeyDown}
              className="space-y-1.5 list-none p-0 m-0"
              aria-label="Chat conversations"
            >
              {conversations.map((c, index) => {
                const isActive = activeConversationId === c.id;
                return (
                  <li
                    key={c.id}
                    className="group relative flex items-center rounded-xl"
                  >
                    <button
                      type="button"
                      onClick={() => !isStreaming && setActiveConversationId(c.id)}
                      tabIndex={getTabindex(index)}
                      data-roving-item
                      onFocus={() => setFocusedIndex(index)}
                      className={[
                        "flex-1 flex items-center gap-2.5 px-3 py-2.5 text-left rounded-xl transition-all duration-200 select-none focus-ring cursor-pointer",
                        isActive
                           ? "bg-surface-secondary text-foreground border border-border/30"
                           : "text-muted hover:bg-surface-secondary/40 hover:text-foreground"
                      ].join(' ')}
                      aria-label={`Select conversation: ${c.title}`}
                    >
                      <MessageSquare size={16} className={isActive ? "text-foreground" : "text-muted"} />
                      <span className="text-xs font-semibold truncate max-w-[150px]">
                        {c.title}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isStreaming) {
                          deleteConversation(c.id);
                        }
                      }}
                      disabled={isStreaming}
                      tabIndex={isActive ? 0 : -1}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:text-danger p-1 rounded transition-opacity duration-200 cursor-pointer text-muted focus-ring"
                      aria-label={`Delete conversation: ${c.title}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* RIGHT COLUMN: Chat Workspace */}
      <section className="flex-1 flex flex-col bg-background/20">
        
        {/* Error Bar */}
        {error && (
          <div className="bg-danger/10 border-b border-danger/20 px-6 py-2 flex items-center justify-between text-xs text-danger select-none">
            <span className="flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </span>
            <button onClick={clearError} className="font-bold hover:underline cursor-pointer">Close</button>
          </div>
        )}

        {/* Dynamic Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-thin select-text">
          {isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Spinner size="lg" color="accent" />
              <Typography type="body-sm" className="text-muted font-medium">Loading...</Typography>
            </div>
          ) : messages.length === 0 ? (
            // EMBED EMPTY STATE SUGGESTIONS
            <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto space-y-8 select-none">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-lg border border-border/20">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
                <Typography type="h2" className="text-xl font-bold tracking-tight text-foreground font-outfit mt-2">
                  CVerify AI Copilot
                </Typography>
                <Typography type="body-xs" className="text-muted max-w-sm leading-normal">
                  Ask anything to optimize your verified CV profile, analyze connected code repositories, or get recommendations to elevate your Developer Trust Score.
                </Typography>
              </div>

              {/* Grid of suggest prompt cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <Card 
                  as="button"
                  type="button"
                  onClick={() => handleSuggestionClick("How can I optimize my CV profile to boost my verified skill score?")}
                  className="p-4 cursor-pointer hover:scale-[1.02] border border-border/60 bg-surface-secondary/40 hover:bg-surface-secondary/80 transition-all duration-200 text-left space-y-1.5 focus-ring"
                  glow={false}
                  aria-label="Suggestion: Optimize Profile"
                >
                  <span className="text-[10px] font-extrabold tracking-wider text-accent uppercase">Optimize Profile</span>
                  <p className="text-[11px] font-semibold text-foreground/90 leading-normal">
                    &quot;How can I optimize my CV profile to boost my verified skill score?&quot;
                  </p>
                </Card>
                
                <Card 
                  as="button"
                  type="button"
                  onClick={() => handleSuggestionClick("Explain why some of my skills are showing as unverified in my skill tree.")}
                  className="p-4 cursor-pointer hover:scale-[1.02] border border-border/60 bg-surface-secondary/40 hover:bg-surface-secondary/80 transition-all duration-200 text-left space-y-1.5 focus-ring"
                  glow={false}
                  aria-label="Suggestion: Verify Gaps"
                >
                  <span className="text-[10px] font-extrabold tracking-wider text-success uppercase">Verify Gaps</span>
                  <p className="text-[11px] font-semibold text-foreground/90 leading-normal">
                    &quot;Explain why some of my skills are showing as unverified in my skill tree.&quot;
                  </p>
                </Card>

                <Card 
                  as="button"
                  type="button"
                  onClick={() => handleSuggestionClick("What architectural patterns should I implement to elevate my system score?")}
                  className="p-4 cursor-pointer hover:scale-[1.02] border border-border/60 bg-surface-secondary/40 hover:bg-surface-secondary/80 transition-all duration-200 text-left space-y-1.5 focus-ring"
                  glow={false}
                  aria-label="Suggestion: Elevate Architecture"
                >
                  <span className="text-[10px] font-extrabold tracking-wider text-warning uppercase">Elevate Architecture</span>
                  <p className="text-[11px] font-semibold text-foreground/90 leading-normal">
                    &quot;What architectural patterns should I implement to elevate my system score?&quot;
                  </p>
                </Card>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div 
                  key={m.id}
                  className={[
                    "flex flex-col max-w-[80%]",
                    isUser ? "ml-auto items-end" : "mr-auto items-start"
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 mb-1.5 select-none text-[10px] uppercase font-bold tracking-widest text-muted font-mono">
                    <span>{isUser ? 'You' : 'CVerify AI'}</span>
                  </div>

                  <div 
                    className={[
                      "px-4 py-3 rounded-2xl text-sm relative group",
                      isUser
                        ? "bg-foreground text-background shadow-md rounded-tr-none"
                        : "bg-surface border border-border/40 backdrop-blur-sm rounded-tl-none text-foreground shadow-sm"
                    ].join(' ')}
                  >
                    {isUser ? (
                      <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <div>
                        {/* Copy Code button for assistant messages */}
                        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-200 select-none">
                          <button
                            onClick={() => handleCopy(m.content, m.id)}
                            className="p-1 rounded bg-surface hover:bg-surface-secondary text-muted transition-colors cursor-pointer focus-ring"
                            title="Copy"
                          >
                            {copiedMap[m.id] ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                          </button>
                        </div>
                        
                        {m.streamingState === 'Pending' ? (
                          <div className="flex items-center gap-2.5 py-1 text-muted select-none">
                            <Spinner size="sm" color="accent" />
                            <span className="text-xs font-semibold animate-pulse">AI is typing...</span>
                          </div>
                        ) : (
                          <div 
                            className="prose dark:prose-invert prose-xs leading-relaxed max-w-none text-foreground/90"
                            dangerouslySetInnerHTML={{ __html: parseAndSanitizeMarkdown(m.content) }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Input Form */}
        <div className="p-4 border-t border-border bg-background/70 backdrop-blur-md">
          <form onSubmit={handleSend} className="flex gap-3 relative items-center max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              placeholder="Ask our CVerify AI assistant..."
              className="flex-1 px-4 py-3 rounded-xl border border-border bg-surface-secondary/50 backdrop-blur-sm text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-focus transition-all select-text pr-24"
            />
            
            <div className="absolute right-2 flex items-center gap-2 select-none">
              {isStreaming ? (
                <Button
                  type="button"
                  onClick={cancelStreaming}
                  className="bg-danger hover:bg-danger/90 text-danger-foreground p-2.5 rounded-lg flex items-center justify-center shadow-lg border-0 hover:scale-[1.02] shrink-0 cursor-pointer"
                >
                  <StopCircle size={16} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!input.trim()}
                  className={[
                    "p-2.5 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 cursor-pointer",
                    input.trim() ? "hover:scale-[1.02]" : "opacity-50 cursor-not-allowed"
                  ].join(' ')}
                >
                  <Send size={16} />
                </Button>
              )}
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
