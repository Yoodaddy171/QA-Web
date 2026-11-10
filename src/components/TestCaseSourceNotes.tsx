'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchSourceTestCaseNotes } from '@/lib/client/api/testcase-source-notes';

export function TestCaseSourceNotes({ projectId, testCaseId }: { projectId: string; testCaseId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ notes: string | null; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void fetchSourceTestCaseNotes(projectId, testCaseId, controller.signal).then(
      notes => { if (active) setResult({ notes }); },
      cause => { if (active) setResult({ notes: null, error: cause instanceof Error ? cause.message : 'Catatan testcase asal gagal dimuat.' }); },
    );
    return () => { active = false; controller.abort(); };
  }, [projectId, testCaseId, attempt]);
  if (!result) return <p role="status" className="text-sm text-muted-foreground">Memuat catatan testcase asal...</p>;
  if (result.error) return (
    <div className="flex flex-col items-start gap-2">
      <p role="alert" className="text-sm text-destructive">{result.error}</p>
      <Button variant="outline" size="sm" onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Coba lagi</Button>
    </div>
  );
  return <p className="break-words whitespace-pre-wrap text-base leading-7 sm:text-sm">{result.notes?.trim() || 'Belum ada catatan.'}</p>;
}
