'use client';

import { useState } from 'react';
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
  const [reportType, setReportType] = useState<ReportType>(report?.reportType || 'TEST_STATUS_REPORT');
  const [documentId, setDocumentId] = useState(report?.documentId || '');
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

  const setSection = (key: keyof ReportSections, value: string) => setSections(current => ({ ...current, [key]: value }));
  const textarea = (key: keyof ReportSections, label: string, placeholder = '') => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Textarea id={key} value={sections[key] || ''} onChange={(e) => setSection(key, e.target.value)} placeholder={placeholder} rows={4} />
    </div>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        projectId,
        reportType,
        documentId,
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
    <form onSubmit={handleSubmit} className="max-w-5xl space-y-5">
      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground">{report ? 'Edit Report' : 'Create Report'}</h2>
        <p className="text-sm text-muted-foreground">Isi metadata dan section dokumen. Snapshot metrics akan dihitung dari database.</p>
      </div>

      <Accordion type="multiple" defaultValue={['doc', 'sections']} className="rounded-lg border border-border/60 bg-card px-4">
        <AccordionItem value="doc">
          <AccordionTrigger>Document Info</AccordionTrigger>
          <AccordionContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Template</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)} disabled={Boolean(report)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEST_STATUS_REPORT">Test Status Report FDS</SelectItem>
                  <SelectItem value="TEST_PLANNING_DOCUMENT">Test Planning FDS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Document ID</Label><Input value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="01 / 02 / TSR-001" /></div>
            <div><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} required /></div>
            <div><Label>Document Status</Label><Input value={documentStatus} onChange={(e) => setDocumentStatus(e.target.value)} /></div>
            <div><Label>Author</Label><Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Tim Pengujian" /></div>
            <div><Label>Approved By</Label><Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="Project Manager" /></div>
            <div className="flex flex-col gap-2"><Label>Tanggal penerbitan</Label><DatePicker value={dateOfIssue} onChange={setDateOfIssue} label="Pilih tanggal penerbitan" required /></div>
            <div className="flex flex-col gap-2"><Label>Periode report</Label><DateRangePicker from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} label="Pilih periode report" required /></div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="approval">
          <AccordionTrigger>Approval, Revision Log, References</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div><Label>Document Information</Label><Textarea value={documentInformation} onChange={(e) => setDocumentInformation(e.target.value)} rows={3} /></div>
            <div><Label>Revision Log</Label><Textarea value={revisionLog} onChange={(e) => setRevisionLog(e.target.value)} placeholder="27/07/2023 | 1.0 | Initial document | QA Team" rows={4} /></div>
            <div><Label>References</Label><Textarea value={references} onChange={(e) => setReferences(e.target.value)} placeholder="External: ISO/IEC/IEEE 29119&#10;Internal: SRS Project" rows={5} /></div>
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

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Draft'}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
