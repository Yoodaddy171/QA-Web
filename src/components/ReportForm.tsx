'use client';

import { useEffect, useState, useId } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker, DateRangePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { saveReport } from '@/lib/client/api/reports-client';
import type { ReportData, ReportSections, ReportType } from '@/lib/services/report-types';

interface ReportFormProps {
  projectId: string;
  report?: ReportData;
  onReportSaved: (report: ReportData) => void;
  onCancel: () => void;
}

const today = format(new Date(), 'yyyy-MM-dd');
const dateInput = (value?: Date) => value ? new Date(value).toISOString().slice(0, 10) : '';

export function ReportForm({ projectId, report, onReportSaved, onCancel }: ReportFormProps) {
  const { toast } = useToast();
  const prefix = useId();
  const fieldId = (field: string) => `${prefix}-${field}`;
  const [reportType, setReportType] = useState<ReportType>(report?.reportType || 'TEST_STATUS_REPORT');
  const [documentId, setDocumentId] = useState(report?.documentId || '');
  const [testRunId, setTestRunId] = useState(report?.testRunId || '');
  const [testRuns, setTestRuns] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [version, setVersion] = useState(report?.version || '1.0');
  const [author, setAuthor] = useState(report?.author || '');
  const [approvedBy, setApprovedBy] = useState(report?.approvedBy || '');
  const [documentStatus, setDocumentStatus] = useState(report?.documentStatus || 'Assigned for review');
  const [dateOfIssue, setDateOfIssue] = useState(dateInput(report?.dateOfIssue) || today);
  const [startDate, setStartDate] = useState(dateInput(report?.reportingPeriodStart));
  const [endDate, setEndDate] = useState(dateInput(report?.reportingPeriodEnd));
  const [documentInformation, setDocumentInformation] = useState(report?.metadata.documentInformation || '');
  const [references, setReferences] = useState((report?.metadata.references || []).map(r => `${r.type}: ${r.title}`).join('\n'));
  const [revisionLog, setRevisionLog] = useState((report?.metadata.revisionLog || []).map(r => `${r.date} | ${r.version} | ${r.changes} | ${r.author || ''}`).join('\n'));
  const [sections, setSections] = useState<ReportSections>(report?.sections || {});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/test-runs?projectId=${encodeURIComponent(projectId)}&limit=100`, { signal: controller.signal })
      .then(async response => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || 'Test Cycle gagal dimuat.');
        const runs = Array.isArray(data.testRuns) ? data.testRuns : [];
        setTestRuns(runs);
        setTestRunId(current => current || runs[0]?.id || '');
      })
      .catch(error => { if (error instanceof Error && error.name !== 'AbortError') toast({ title: 'Test Cycle gagal dimuat', description: error.message, variant: 'destructive' }); });
    return () => controller.abort();
  }, [projectId, toast]);

  const setSection = (key: keyof ReportSections, value: string) => setSections(current => ({ ...current, [key]: value }));
  const textarea = (key: keyof ReportSections, label: string, placeholder = '') => (
    <div>
      <Label htmlFor={fieldId(key)}>{label}</Label>
      <Textarea id={fieldId(key)} value={sections[key] || ''} onChange={(e) => setSection(key, e.target.value)} placeholder={placeholder} rows={4} />
    </div>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (reportType === 'TEST_STATUS_REPORT' && !testRunId) throw new Error('Pilih Source Test Cycle untuk Test Status Report.');
      const payload = {
        projectId,
        reportType,
        documentId,
        testRunId: reportType === 'TEST_STATUS_REPORT' ? testRunId : undefined,
        version,
        author,
        approvedBy,
        documentStatus,
        dateOfIssue: new Date(dateOfIssue).toISOString(),
        reportingPeriodStart: new Date(startDate).toISOString(),
        reportingPeriodEnd: new Date(endDate).toISOString(),
        metadata: {
          documentInformation,
          references: references.split('\n').filter(Boolean).map(line => {
            const [type, ...title] = line.split(':');
            return { type: type.trim() === 'External' ? 'External' : 'Internal', title: title.join(':').trim() || line.trim() };
          }),
          revisionLog: revisionLog.split('\n').filter(Boolean).map(line => {
            const [date, version, changes, author] = line.split('|').map(part => part.trim());
            return { date, version, changes, author };
          }),
          approval: [{ approvedBy: approvedBy || 'Project Manager', signature: '', date: '' }],
        },
        sections,
      };
      const saved = await saveReport(payload, report?.id);
      toast({ variant: 'success', title: 'Berhasil', description: report ? 'Report berhasil diperbarui.' : 'Report berhasil dibuat.' });
      onReportSaved(saved);
    } catch (error) {
      toast({ title: 'Gagal menyimpan report', description: error instanceof Error ? error.message : 'Terjadi kesalahan.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isPlanning = reportType === 'TEST_PLANNING_DOCUMENT';

  return (
    <form onSubmit={handleSubmit} className="qa-module-form flex min-w-0 max-w-5xl flex-col gap-5">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{report ? 'Edit Report' : 'Create Report'}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Isi metadata dan section dokumen. Snapshot metrics akan dihitung dari database.</p>
      </div>

      <Accordion type="multiple" defaultValue={['doc', 'sections']} className="rounded-xl border border-border bg-card px-4 sm:px-5">
        <AccordionItem value="doc">
          <AccordionTrigger>Document Info</AccordionTrigger>
          <AccordionContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor={fieldId("reportType")} >Template</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)} disabled={Boolean(report)}>
                <SelectTrigger id={fieldId("reportType")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEST_STATUS_REPORT">Test Status Report FDS</SelectItem>
                  <SelectItem value="TEST_PLANNING_DOCUMENT">Test Planning FDS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={fieldId("documentId")} >Document ID</Label><Input id={fieldId("documentId")} value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="01 / 02 / TSR-001" /></div>
            {!isPlanning ? <div><Label htmlFor={fieldId("testRunId")} >Source Test Cycle</Label><Select value={testRunId || 'none'} onValueChange={value => setTestRunId(value === 'none' ? '' : value)} disabled={Boolean(report)}><SelectTrigger id={fieldId("testRunId")} aria-required="true"><SelectValue placeholder="Pilih Test Cycle" /></SelectTrigger><SelectContent><SelectItem value="none">Pilih Test Cycle</SelectItem>{testRuns.map(run => <SelectItem key={run.id} value={run.id}>{run.name} · {run.status}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Headline report memakai execution terbaru pada cycle ini, bukan status inventory atau verifikasi Bug.</p></div> : null}
            <div><Label htmlFor={fieldId("version")} >Version</Label><Input id={fieldId("version")} value={version} onChange={(e) => setVersion(e.target.value)} required /></div>
            <div><Label htmlFor={fieldId("documentStatus")} >Document Status</Label><Input id={fieldId("documentStatus")} value={documentStatus} onChange={(e) => setDocumentStatus(e.target.value)} /></div>
            <div><Label htmlFor={fieldId("author")} >Author</Label><Input id={fieldId("author")} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tim Pengujian" /></div>
            <div><Label htmlFor={fieldId("approvedBy")} >Approved By</Label><Input id={fieldId("approvedBy")} value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Project Manager" /></div>
            <div className="flex flex-col gap-2"><Label id={fieldId("issue-label")} htmlFor={fieldId("issue")} >Tanggal penerbitan</Label><DatePicker id={fieldId("issue")} labelledBy={fieldId("issue-label")} value={dateOfIssue} onChange={setDateOfIssue} label="Pilih tanggal penerbitan" required /></div>
            <div className="flex flex-col gap-2"><Label id={fieldId("period-label")} htmlFor={fieldId("period")} >Periode report</Label><DateRangePicker id={fieldId("period")} labelledBy={fieldId("period-label")} from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} label="Pilih periode report" required /></div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="approval">
          <AccordionTrigger>Approval, Revision Log, References</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div><Label htmlFor={fieldId("documentInformation")} >Document Information</Label><Textarea id={fieldId("documentInformation")} value={documentInformation} onChange={(e) => setDocumentInformation(e.target.value)} rows={3} /></div>
            <div><Label htmlFor={fieldId("revisionLog")} >Revision Log</Label><Textarea id={fieldId("revisionLog")} value={revisionLog} onChange={(e) => setRevisionLog(e.target.value)} placeholder="27/07/2023 | 1.0 | Initial document | QA Team" rows={4} /></div>
            <div><Label htmlFor={fieldId("references")} >References</Label><Textarea id={fieldId("references")} value={references} onChange={(e) => setReferences(e.target.value)} placeholder="External: ISO/IEC/IEEE 29119&#10;Internal: SRS Project" rows={5} /></div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="sections">
          <AccordionTrigger>{isPlanning ? 'Planning Sections' : 'Status Report Sections'}</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {textarea('scope', 'Scope / Introduction')}
            {isPlanning ? (
              <>
                {textarea('testItems', 'Test Items / Functions')}
                {textarea('softwareRiskIssues', 'Software Risk Issues')}
                {textarea('featuresToBeTested', 'Features To Be Tested')}
                {textarea('approachStrategy', 'Approach / Strategy')}
                {textarea('passFailCriteria', 'Pass/Fail Criteria')}
                {textarea('suspensionCriteria', 'Suspension Criteria')}
                {textarea('testDeliverables', 'Test Deliverables')}
                {textarea('remainingTestTasks', 'Remaining Test Tasks')}
                {textarea('environmentalNeeds', 'Environmental Needs')}
                {textarea('responsibilities', 'Responsibilities')}
                {textarea('schedule', 'Schedule')}
                {textarea('planningRisks', 'Planning Risks and Contingencies')}
              </>
            ) : (
              <>
                {textarea('progressNarrative', 'Progress Against Test Plan')}
                {textarea('blockingFactors', 'Blocking Factors')}
                {textarea('newRisks', 'New and Changed Risks')}
                {textarea('plannedTesting', 'Planned Testing')}
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="sticky bottom-4 flex flex-wrap justify-end gap-2 rounded-xl border border-border bg-card p-4 pr-20">
        <Button type="submit" className="min-h-10" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Draft'}</Button>
        <Button type="button" className="min-h-10" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
