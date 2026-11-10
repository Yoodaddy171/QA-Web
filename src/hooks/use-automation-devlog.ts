import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAutomationLogs } from '@/hooks/useAutomationLogs';
import { fetchAutomationHistory, type AutomationHistoryResponse } from '@/lib/client/api/automation-client';
import { LatestRequest } from '@/lib/client/latest-request';
import type { TestCase } from '@/lib/client/api/types';

const EMPTY: AutomationHistoryResponse = { items: [], total: 0, page: 1, limit: 25, totalPages: 1,
  summary: { total: 0, manual: 0, lastRunAt: null }, moduleIds: [], records: {} };
export function useAutomationDevlog(input: {
  projectId: string; enabled?: boolean; historyVisible?: boolean; viewTestCase: TestCase | null; setViewTestCase: Dispatch<SetStateAction<TestCase | null>>;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState({ projectId: input.projectId, search: '', moduleId: 'all', page: 1 });
  const currentQuery = query.projectId === input.projectId ? query : { projectId: input.projectId, search: '', moduleId: 'all', page: 1 };
  const key = JSON.stringify([currentQuery, input.historyVisible !== false]);
  const [result, setResult] = useState<{ projectId: string; key: string; data: AutomationHistoryResponse } | null>(null);
  const [automatedLoading, setAutomatedLoading] = useState(false);
  const [automatedError, setAutomatedError] = useState('');
  const [recordResult, setRecordResult] = useState<{ projectId: string; records: AutomationHistoryResponse['records'] } | null>(null);
  const requests = useRef(new LatestRequest());
  const active = useRef({ projectId: input.projectId, key });
  useEffect(() => { active.current = { projectId: input.projectId, key }; requests.current.cancel(); }, [input.projectId, key]);
  useEffect(() => () => requests.current.cancel(), []);
  const devlog = useAutomationLogs(input);
  const data = result?.projectId === input.projectId ? result.data : EMPTY;
  const automatedItems = result?.key === key ? data.items : EMPTY.items;
  const loadAutomated = async (projectId: string) => {
    if (!projectId || projectId !== input.projectId || input.enabled === false) return;
    const request = requests.current.begin();
    const requestedKey = key;
    setAutomatedLoading(true); setAutomatedError('');
    try {
      const next = await fetchAutomationHistory(projectId, { ...currentQuery, signal: request.signal, view: input.historyVisible === false ? 'records' : undefined });
      if (request.current() && active.current.projectId === projectId && active.current.key === requestedKey) {
        setResult({ projectId, key: requestedKey, data: next });
        setRecordResult(previous => ({ projectId, records: input.historyVisible === false || previous?.projectId !== projectId ? next.records : { ...previous.records, ...next.records } }));
        if (next.page !== currentQuery.page) setQuery({ ...currentQuery, page: next.page });
      }
    } catch (cause) {
      if (request.current()) {
        const message = cause instanceof Error ? cause.message : 'Gagal memuat automation log. Coba sinkronkan kembali.';
        setAutomatedError(message); toast({ title: 'Automation Log belum dimuat', description: message, variant: 'destructive' });
      }
    } finally { if (request.current()) setAutomatedLoading(false); }
  };
  return { ...devlog, automatedItems, visibleAutomatedItems: automatedItems,
    automatedSearch: currentQuery.search, automatedFilterModule: currentQuery.moduleId, automatedPage: currentQuery.page,
    automatedTotal: result?.key === key ? data.total : 0, automatedTotalPages: data.totalPages,
    automatedSummary: data.summary, automatedModuleIds: data.moduleIds, testRecordById: recordResult?.projectId === input.projectId ? recordResult.records : EMPTY.records,
    automatedLoading, automatedError,
    setAutomatedSearch: (search: string) => setQuery({ ...currentQuery, search, page: 1 }),
    setAutomatedFilterModule: (moduleId: string) => setQuery({ ...currentQuery, moduleId, page: 1 }),
    setAutomatedPage: (page: number) => setQuery({ ...currentQuery, page }), loadAutomated };
}
