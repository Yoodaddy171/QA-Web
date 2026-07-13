'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, Minimize2, Plus, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  drafts?: TestCaseDraft[];
  actionDrafts?: CopilotActionDraft[];
  citations?: CopilotCitation[];
  usedTools?: string[];
  provider?: {
    provider?: string;
    model?: string;
    error?: string;
  };
}

interface FloatingAIChatProps {
  projectId: string | null;
  projectName?: string;
  onOpenTestCaseId?: (testCaseId: string) => void;
  onCreateTestCaseDraft?: (draft: TestCaseDraft) => void;
  selectedTestCase?: {
    id: string;
    testCaseId: string;
    page: string;
    subMenu?: string | null;
    status: string;
  } | null;
}

export interface TestCaseDraft {
  testCaseId: string;
  page: string;
  subMenu: string;
  weight: string;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  priority: string;
  moduleId: string | null;
}

interface CopilotCitation {
  id: string;
  type: 'project' | 'module' | 'testcase' | 'bugfix' | 'knowledge' | 'automation' | 'devlog';
  label: string;
  description?: string;
  testCaseId?: string;
}

interface CopilotActionDraft {
  id: string;
  type: 'CREATE_TESTCASE_DRAFT' | 'REFINE_TESTCASE_DRAFT' | 'BULK_STATUS_DRAFT' | 'BUGFIX_RETEST_SUGGESTION';
  title: string;
  description: string;
  testCaseDraft?: TestCaseDraft;
  payload?: Record<string, unknown>;
}

type ChatFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DragState = {
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  startFrame: ChatFrame;
};

const SUGGESTIONS = [
  'Analisis risiko module ini',
  'Cari testcase duplikat',
  'Buat missing negative cases',
  'Ringkas bug yang perlu retest',
];

const WELCOME_MESSAGE = 'Halo, saya bisa bantu baca konteks project, testcase, bugfix, dan status QA yang terlihat di database lokal ini.';
const DEFAULT_CHAT_WIDTH = 520;
const DEFAULT_CHAT_HEIGHT = 640;
const MIN_CHAT_WIDTH = 360;
const MIN_CHAT_HEIGHT = 420;
const CHAT_MARGIN = 20;
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content: WELCOME_MESSAGE,
  },
];
function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
  };
}

function createAssistantMessage(
  content: string,
  options?: {
    drafts?: TestCaseDraft[];
    actionDrafts?: CopilotActionDraft[];
    citations?: CopilotCitation[];
    usedTools?: string[];
    provider?: ChatMessage['provider'];
  }
): ChatMessage {
  return {
    ...createMessage('assistant', content),
    drafts: options?.drafts,
    actionDrafts: options?.actionDrafts,
    citations: options?.citations,
    usedTools: options?.usedTools,
    provider: options?.provider,
  };
}

import { MessageContent } from '@/components/ai-chat/MessageContent';



import { ActionDraftCards, CitationChips, ToolTrace } from '@/components/ai-chat/ChatSupplemental';

export function FloatingAIChat({
  projectId,
  projectName,
  selectedTestCase,
  onOpenTestCaseId,
  onCreateTestCaseDraft,
}: FloatingAIChatProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [chatFrame, setChatFrame] = useState<ChatFrame | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const contextLabel = useMemo(() => {
    if (selectedTestCase) return `${selectedTestCase.testCaseId} - ${selectedTestCase.page}`;
    if (projectName) return projectName;
    return 'No project selected';
  }, [projectName, selectedTestCase]);

  useEffect(() => {
    abortRef.current?.abort();
    setInput('');
    setMessages(INITIAL_MESSAGES);
    setLoading(false);
  }, [projectId]);

  const getDefaultFrame = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(DEFAULT_CHAT_WIDTH, viewportWidth - 24);
    const height = Math.min(DEFAULT_CHAT_HEIGHT, viewportHeight - 40);

    return {
      width: Math.max(MIN_CHAT_WIDTH, width),
      height: Math.max(MIN_CHAT_HEIGHT, height),
      left: Math.max(12, viewportWidth - width - CHAT_MARGIN),
      top: Math.max(12, viewportHeight - height - CHAT_MARGIN),
    };
  };

  const clampFrame = (frame: ChatFrame): ChatFrame => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.max(MIN_CHAT_WIDTH, viewportWidth - 24);
    const maxHeight = Math.max(MIN_CHAT_HEIGHT, viewportHeight - 40);
    const width = Math.min(Math.max(frame.width, MIN_CHAT_WIDTH), maxWidth);
    const height = Math.min(Math.max(frame.height, MIN_CHAT_HEIGHT), maxHeight);

    return {
      width,
      height,
      left: Math.min(Math.max(12, frame.left), Math.max(12, viewportWidth - width - 12)),
      top: Math.min(Math.max(12, frame.top), Math.max(12, viewportHeight - height - 12)),
    };
  };

  useEffect(() => {
    if (!open) return;

    setChatFrame((current) => current ? clampFrame(current) : getDefaultFrame());

    const handleResize = () => {
      setChatFrame((current) => current ? clampFrame(current) : current);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  const startMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, textarea, input, a')) return;
    const frame = chatFrame || getDefaultFrame();
    dragRef.current = {
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      startFrame: frame,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = chatFrame || getDefaultFrame();
    dragRef.current = {
      mode: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startFrame: frame,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveChatFrame = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (drag.mode === 'move') {
      setChatFrame(clampFrame({
        ...drag.startFrame,
        left: drag.startFrame.left + deltaX,
        top: drag.startFrame.top + deltaY,
      }));
      return;
    }

    const nextWidth = drag.startFrame.width - deltaX;
    const nextHeight = drag.startFrame.height - deltaY;
    const clampedWidth = Math.min(Math.max(nextWidth, MIN_CHAT_WIDTH), Math.max(MIN_CHAT_WIDTH, window.innerWidth - 24));
    const clampedHeight = Math.min(Math.max(nextHeight, MIN_CHAT_HEIGHT), Math.max(MIN_CHAT_HEIGHT, window.innerHeight - 40));

    setChatFrame(clampFrame({
      width: clampedWidth,
      height: clampedHeight,
      left: drag.startFrame.left + (drag.startFrame.width - clampedWidth),
      top: drag.startFrame.top + (drag.startFrame.height - clampedHeight),
    }));
  };

  const stopChatFrameDrag = () => {
    dragRef.current = null;
  };

  const askAI = async (questionOverride?: string) => {
    const question = String(questionOverride ?? input).trim();
    if (!question || loading) return;
    if (!projectId) {
      toast({
        title: 'Project belum dipilih',
        description: 'Pilih project terlebih dahulu agar AI punya konteks.',
        variant: 'destructive',
      });
      return;
    }

    const userMessage = createMessage('user', question);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          projectId,
          question,
          selectedTestCaseId: selectedTestCase?.id,
          messages: messages
            .filter(message => message.role === 'user' || message.role === 'assistant')
            .slice(-6)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || 'AI chat gagal diproses.';
        if (/model does not support image|vision|multimodal|image input/i.test(String(msg))) {
          throw new Error('Model AI saat ini tidak mendukung input gambar. Gunakan format teks untuk chatting, atau gunakan fitur screenshot analysis untuk analisis gambar.');
        }
        throw new Error(msg);
      }

      const drafts = Array.isArray(data.drafts) ? data.drafts as TestCaseDraft[] : undefined;
      const actionDrafts = Array.isArray(data.actionDrafts) ? data.actionDrafts as CopilotActionDraft[] : undefined;
      const citations = Array.isArray(data.citations) ? data.citations as CopilotCitation[] : undefined;
      const usedTools = Array.isArray(data.usedTools) ? data.usedTools.map(String) : undefined;
      setMessages(prev => [...prev, createAssistantMessage(data.answer || 'AI tidak menghasilkan jawaban.', {
        drafts,
        actionDrafts,
        citations,
        usedTools,
        provider: data.provider,
      })]);
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      setMessages(prev => [
        ...prev,
        createAssistantMessage(isAbort
          ? 'Request terlalu lama dan dihentikan. Coba pertanyaan yang lebih spesifik.'
          : `Maaf, chat AI gagal: ${error instanceof Error ? error.message : 'Unknown error'}`),
      ]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stopRequest = () => {
    abortRef.current?.abort();
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setInput('');
    setMessages(INITIAL_MESSAGES);
  };

  const frame = chatFrame || {
    left: 0,
    top: 0,
    width: DEFAULT_CHAT_WIDTH,
    height: DEFAULT_CHAT_HEIGHT,
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="chat-trigger"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => {
              setOpen(true);
              setMinimized(false);
              setChatFrame((current) => current || getDefaultFrame());
            }}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition duration-300 elevation-3 focus:outline-none focus:ring-4 focus:ring-primary/30"
            aria-label="Open QA AI chat"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: minimized ? 66 : frame.height,
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 1 }}
            className="fixed z-50 flex overflow-hidden rounded-2xl border border-border/60 bg-card elevation-3 overscroll-contain"
            onPointerMove={moveChatFrame}
            onPointerUp={stopChatFrameDrag}
            onPointerCancel={stopChatFrameDrag}
            onWheel={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Resize QA Copilot"
              title="Resize"
              onPointerDown={startResize}
              className="absolute left-0 top-0 z-10 h-6 w-6 cursor-nwse-resize rounded-br-xl border-b border-r border-border/30 bg-secondary/50 text-muted-foreground/40 transition hover:bg-secondary hover:text-foreground"
            >
              <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-current" />
            </button>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                className="flex cursor-move touch-none select-none items-start justify-between border-b border-border/40 bg-secondary/60 px-4 py-3.5 pl-8"
                onPointerDown={startMove}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">QA Copilot</p>
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[9px] font-semibold text-primary uppercase">Active</Badge>
                      </div>
                      <p className="truncate text-[10px] font-medium text-muted-foreground">{contextLabel}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={clearChat}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Clear chat"
                    title="Clear chat"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setMinimized(value => !value)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
                  >
                    <Minimize2 className={cn("h-4 w-4 transition-transform", minimized && "rotate-180")} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                    aria-label="Close chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {!minimized && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent px-4 py-4 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                      <div className="space-y-4">
                        {messages.map(message => (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[90%] px-4 py-3 text-sm leading-relaxed ${
                                message.role === 'user'
                                  ? 'rounded-xl bg-primary/20 border border-primary/30 text-foreground'
                                  : 'rounded-xl bg-secondary/40 border border-border/40 text-foreground'
                              }`}
                            >
                              <MessageContent
                                content={message.content}
                                compact={true}
                                onOpenTestCaseId={onOpenTestCaseId}
                              />
                              {message.role === 'assistant' && (
                                <>
                                  <CitationChips citations={message.citations} onOpenTestCaseId={onOpenTestCaseId} />
                                  <ToolTrace usedTools={message.usedTools} provider={message.provider} />
                                  <ActionDraftCards actionDrafts={message.actionDrafts} onCreateTestCaseDraft={onCreateTestCaseDraft} />
                                </>
                              )}
                              {message.role === 'assistant' && message.drafts && message.drafts.length > 0 && !message.actionDrafts?.some(action => action.testCaseDraft) && (
                                <div className="mt-4 space-y-3">
                                  {message.drafts.map((draft, draftIndex) => (
                                    <div key={`${draft.testCaseId}-${draftIndex}`} className="rounded-xl border border-border/50 bg-card/50 p-3 hover:bg-card transition-colors group/draft">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-primary">{draft.testCaseId}</span>
                                            <Badge variant="outline" className="border-border/60 bg-secondary/50 text-[9px] font-medium uppercase">{draft.testType}</Badge>
                                            <Badge variant="outline" className="border-border/60 bg-secondary/50 text-[9px] font-medium uppercase">{draft.priority}</Badge>
                                          </div>
                                          <p className="mt-1.5 text-sm font-semibold text-foreground">{draft.page}{draft.subMenu ? ` > ${draft.subMenu}` : ''}</p>
                                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground group-hover/draft:text-foreground transition-colors">{draft.testAction}</p>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => onCreateTestCaseDraft?.(draft)}
                                          className="shrink-0 gap-1 bg-primary text-primary-foreground hover:bg-primary/90 elevation-1 h-8 font-semibold text-[11px] uppercase"
                                        >
                                          <Plus className="h-3 w-3" />
                                          Review
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                        {loading && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start"
                          >
                            <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground italic">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              Thinking...
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {messages.length <= 1 && (
                      <div className="border-t border-border/40 bg-transparent px-4 py-4">
                        <div className="grid grid-cols-1 gap-2">
                          {SUGGESTIONS.map((suggestion, idx) => (
                            <motion.button
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              key={suggestion}
                              type="button"
                              onClick={() => askAI(suggestion)}
                              disabled={loading || !projectId}
                              className="group flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground transition duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                              {suggestion}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border/40 bg-secondary/20 p-4">
                      <div className="flex gap-2">
                        <Textarea
                          value={input}
                          onChange={(event) => setInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              askAI();
                            }
                          }}
                          placeholder={projectId ? 'Ask about your test cases...' : 'Select a project first...'}
                          disabled={loading || !projectId}
                          className="max-h-32 min-h-[44px] resize-none text-sm rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition duration-200"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={loading ? stopRequest : () => askAI()}
                          disabled={!loading && (!input.trim() || !projectId)}
                          className={`h-11 w-11 rounded-xl elevation-1 transition duration-200 ${loading ? 'bg-muted text-muted-foreground hover:bg-muted/80' : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'}`}
                          aria-label={loading ? 'Stop AI response' : 'Send message'}
                        >
                          {loading ? <X className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
