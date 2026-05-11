'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, Minimize2, Plus, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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
  'Apa testcase yang paling perlu saya prioritaskan?',
  'Ringkas status project ini.',
  'Bug apa yang masih perlu retest?',
  'Cari celah negative case yang belum terlihat.',
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
const TESTCASE_ID_PATTERN = /\b[A-Z]{1,4}-\d{2,4}\b/g;

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
  };
}

function createAssistantMessage(content: string, drafts?: TestCaseDraft[]): ChatMessage {
  return {
    ...createMessage('assistant', content),
    drafts,
  };
}

function isMarkdownTable(lines: string[], index: number) {
  const header = lines[index]?.trim();
  const separator = lines[index + 1]?.trim();
  return Boolean(
    header?.startsWith('|')
    && header.endsWith('|')
    && separator?.startsWith('|')
    && separator.endsWith('|')
    && /^\|[\s:-]+\|[\s|:-]*$/.test(separator)
  );
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function linkifyTestCaseIds(value: string) {
  return value.replace(TESTCASE_ID_PATTERN, (match) => `[${match}](tc:${match})`);
}

function LinkedText({
  value,
  compact,
  onOpenTestCaseId,
}: {
  value: string;
  compact?: boolean;
  onOpenTestCaseId?: (testCaseId: string) => void;
}) {
  const parts = value.split(TESTCASE_ID_PATTERN);
  const matches = value.match(TESTCASE_ID_PATTERN) || [];

  return (
    <>
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {part}
          {matches[index] && (
            <button
              type="button"
              onClick={() => onOpenTestCaseId?.(matches[index])}
              className={`font-semibold underline underline-offset-2 ${compact ? 'text-cyan-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
            >
              {matches[index]}
            </button>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function MessageContent({
  content,
  compact = false,
  onOpenTestCaseId,
}: {
  content: string;
  compact?: boolean;
  onOpenTestCaseId?: (testCaseId: string) => void;
}) {
  const blocks: Array<{ type: 'markdown'; value: string } | { type: 'table'; rows: string[][] }> = [];
  const lines = content.split('\n');
  let buffer: string[] = [];

  const flushMarkdown = () => {
    const value = buffer.join('\n').trim();
    if (value) blocks.push({ type: 'markdown', value });
    buffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (!isMarkdownTable(lines, index)) {
      buffer.push(lines[index]);
      continue;
    }

    flushMarkdown();
    const tableLines = [lines[index]];
    index += 2;
    while (index < lines.length && lines[index].trim().startsWith('|') && lines[index].trim().endsWith('|')) {
      tableLines.push(lines[index]);
      index += 1;
    }
    index -= 1;
    blocks.push({ type: 'table', rows: tableLines.map(splitTableRow) });
  }

  flushMarkdown();

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          const [header, ...rows] = block.rows;
          return (
            <div key={`table-${index}`} className="overflow-x-auto rounded-xl border border-border/50 bg-secondary/30 my-3">
              <table className="min-w-full table-auto border-collapse text-left text-[11px]">
                <thead className="bg-secondary/50 font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {header.map((cell, cellIndex) => (
                      <th key={`${cell}-${cellIndex}`} className="min-w-[90px] border-b border-border/50 px-3 py-2.5 font-semibold leading-snug">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-foreground/80">
                  {rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="border-t border-border/30 hover:bg-secondary/30 transition-colors">
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`} className="max-w-[220px] align-top px-3 py-2.5 leading-relaxed">
                          <LinkedText value={cell} onOpenTestCaseId={onOpenTestCaseId} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <ReactMarkdown
            key={`markdown-${index}`}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0 marker:text-primary/50">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0 marker:text-primary/50">{children}</ol>,
              li: ({ children }) => <li className="pl-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              code: ({ children }) => (
                <code className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-primary">
                  {children}
                </code>
              ),
              a: ({ href, children }) => {
                const target = typeof href === 'string' && href.startsWith('tc:') ? decodeURIComponent(href.slice(3)) : null;
                if (!target) {
                  return <span className="text-primary font-semibold hover:underline cursor-pointer">{children}</span>;
                }

                return (
                  <button
                    type="button"
                    onClick={() => onOpenTestCaseId?.(target)}
                    className="font-bold text-primary underline underline-offset-4 decoration-primary/30 transition-colors hover:decoration-primary"
                  >
                    {children}
                  </button>
                );
              },
            }}
          >
            {linkifyTestCaseIds(block.value)}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

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
      const response = await fetch('/api/ai/chat', {
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
      setMessages(prev => [...prev, createAssistantMessage(data.answer || 'AI tidak menghasilkan jawaban.', drafts)]);
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
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground elevation-3 focus:outline-none focus:ring-4 focus:ring-primary/30"
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
            className="fixed z-50 flex overflow-hidden rounded-2xl border border-border/60 bg-card/95 elevation-4 backdrop-blur-2xl overscroll-contain"
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
                className="flex cursor-move touch-none select-none items-start justify-between border-b border-border/50 bg-secondary/30 px-4 py-3.5 pl-8"
                onPointerDown={startMove}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold tracking-tight text-foreground">QA Copilot</p>
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
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent px-4 py-4">
                      <div className="space-y-4">
                        {messages.map(message => (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground elevation-1'
                                  : 'border border-border/50 bg-secondary/50 text-foreground'
                              }`}
                            >
                              <MessageContent
                                content={message.content}
                                compact={true}
                                onOpenTestCaseId={onOpenTestCaseId}
                              />
                              {message.role === 'assistant' && message.drafts && message.drafts.length > 0 && (
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
                                          Add
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
                            <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/50 px-4 py-2.5 text-sm text-muted-foreground italic">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              Thinking...
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {messages.length <= 1 && (
                      <div className="border-t border-border/30 bg-transparent px-4 py-4">
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
                              className="group flex items-center gap-3 rounded-xl border border-border/50 bg-secondary/30 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                              {suggestion}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-border/30 bg-secondary/20 p-4">
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
                          className="max-h-32 min-h-[44px] resize-none text-sm bg-card border-border/60 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 rounded-xl"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={loading ? stopRequest : () => askAI()}
                          disabled={!loading && (!input.trim() || !projectId)}
                          className={`h-11 w-11 rounded-xl elevation-1 transition-all ${loading ? 'bg-muted text-muted-foreground hover:bg-muted/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
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
