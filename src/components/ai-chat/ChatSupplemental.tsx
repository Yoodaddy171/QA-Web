'use client';

import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TestCaseDraft } from '@/components/FloatingAIChat';

interface Citation {
  id: string;
  type: 'project' | 'module' | 'testcase' | 'bugfix' | 'knowledge' | 'automation' | 'devlog';
  label: string;
  description?: string;
  testCaseId?: string;
}

interface ActionDraft {
  id: string;
  type: 'CREATE_TESTCASE_DRAFT' | 'REFINE_TESTCASE_DRAFT' | 'BULK_STATUS_DRAFT' | 'BUGFIX_RETEST_SUGGESTION';
  title: string;
  description: string;
  testCaseDraft?: TestCaseDraft;
}

export function CitationChips({ citations = [], onOpenTestCaseId }: { citations?: Citation[]; onOpenTestCaseId?: (testCaseId: string) => void }) {
  if (!citations.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {citations.slice(0, 12).map(citation => {
        const clickableId = citation.testCaseId || (citation.type === 'testcase' || citation.type === 'bugfix' ? citation.label : '');
        return (
          <button key={`${citation.type}-${citation.id}`} type="button" disabled={!clickableId} onClick={() => clickableId && onOpenTestCaseId?.(clickableId)} title={citation.description || citation.type} className={cn('rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition', clickableId ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15' : 'border-border/60 bg-secondary/50 text-muted-foreground')}>
            {citation.type}: {citation.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToolTrace({ usedTools = [], provider }: { usedTools?: string[]; provider?: { provider?: string; model?: string; error?: string } }) {
  if (!usedTools.length && !provider?.provider && !provider?.error) return null;
  return (
    <div className="mt-3 rounded-xl border border-border/50 bg-card/40 p-2 text-[10px] text-muted-foreground">
      {usedTools.length > 0 && <p className="font-semibold">AI membaca: {usedTools.join(', ')}</p>}
      {provider?.provider && <p className="mt-1">Provider: {provider.provider}{provider.model ? ` · ${provider.model}` : ''}</p>}
      {provider?.error && <p className="mt-1 text-amber-600 dark:text-amber-300">Provider fallback: {provider.error}</p>}
    </div>
  );
}

export function ActionDraftCards({ actionDrafts = [], onCreateTestCaseDraft }: { actionDrafts?: ActionDraft[]; onCreateTestCaseDraft?: (draft: TestCaseDraft) => void }) {
  if (!actionDrafts.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {actionDrafts.map(action => (
        <div key={action.id} className="rounded-xl border border-border/50 bg-card/50 p-3 transition-colors hover:bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge variant="outline" className="mb-2 border-primary/30 bg-primary/10 text-[9px] font-semibold uppercase tracking-wider text-primary">{action.type.replace(/_/g, ' ')}</Badge>
              <p className="text-sm font-semibold text-foreground">{action.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.description}</p>
            </div>
            {action.testCaseDraft && <Button type="button" size="sm" onClick={() => onCreateTestCaseDraft?.(action.testCaseDraft!)} className="h-8 shrink-0 gap-1 bg-primary text-[11px] font-semibold uppercase text-primary-foreground hover:bg-primary/90"><Plus className="h-3 w-3" />Review</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}
