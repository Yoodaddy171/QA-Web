import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ReportData } from './report-types';

const fmt = (date?: Date) => date ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date)) : '';
const text = (value: unknown) => String(value ?? '');

function p(value = '', opts: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bold?: boolean; center?: boolean } = {}) {
  return new Paragraph({
    text: opts.bold ? undefined : value,
    heading: opts.heading,
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    spacing: { after: 160 },
    children: opts.bold ? [new TextRun({ text: value, bold: true })] : undefined,
  });
}

function cell(value: unknown, bold = false) {
  return new TableCell({
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: text(value), bold })] })],
  });
}

function table(rows: unknown[][], header = true) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' },
    },
    rows: rows.map((row, index) => new TableRow({ children: row.map(value => cell(value, header && index === 0)) })),
  });
}

function sectionParagraphs(report: ReportData) {
  const s = report.sections;
  if (report.reportType === 'TEST_PLANNING_DOCUMENT') {
    return [
      ['INTRODUCTION', s.scope],
      ['TEST ITEMS (FUNCTIONS)', s.testItems],
      ['SOFTWARE RISK ISSUES', s.softwareRiskIssues],
      ['FEATURES TO BE TESTED', s.featuresToBeTested],
      ['APPROACH (STRATEGY)', s.approachStrategy],
      ['ITEM PASS/FAIL CRITERIA', s.passFailCriteria],
      ['SUSPENSION CRITERIA AND RESUMPTION REQUIREMENTS', s.suspensionCriteria],
      ['TEST DELIVERABLES', s.testDeliverables],
      ['REMAINING TEST TASKS', s.remainingTestTasks],
      ['ENVIRONMENTAL NEEDS', s.environmentalNeeds],
      ['RESPONSIBILITIES', s.responsibilities],
      ['SCHEDULE', s.schedule],
      ['PLANNING RISKS AND CONTINGENCIES', s.planningRisks],
    ];
  }

  return [
    ['INTRODUCTION', s.scope],
    ['Reporting period', `${fmt(report.reportingPeriodStart)} - ${fmt(report.reportingPeriodEnd)}`],
    ['Progress against test plan', s.progressNarrative],
    ['Blocking factors', s.blockingFactors],
    ['New and changed risks', s.newRisks],
    ['Planned testing', s.plannedTesting],
  ];
}

export async function generateReportDocx(report: ReportData) {
  const m = report.metrics;
  const meta = report.metadata;
  const title = report.reportType === 'TEST_PLANNING_DOCUMENT' ? 'Software Test Plan' : 'Software Test Status Report';

  const children = [
    p(report.projectName, { center: true, bold: true }),
    p(title, { center: true, bold: true }),
    p('Ganesha Tujuh Sembilan', { center: true }),
    p(`Version ${report.version}`, { center: true }),
    p('DOCUMENT SPECIFIC INFORMATION', { heading: HeadingLevel.HEADING_1 }),
    table([
      ['ID:', report.documentId || report.id],
      ['Version:', report.version],
      ['Date:', fmt(report.dateOfIssue || report.createdAt)],
      ['Author:', report.author || 'Tim Pengujian'],
      ['Approved by:', report.approvedBy || 'Project Manager'],
    ], false),
    p('Document Information', { heading: HeadingLevel.HEADING_2 }),
    p(meta.documentInformation || `Dokumen ini dibuat untuk project ${report.projectName}.`),
    p('Approval', { heading: HeadingLevel.HEADING_2 }),
    table([['Approved by', 'Signature', 'Date'], ...(meta.approval || []).map(a => [a.approvedBy, a.signature || '', a.date || ''])]),
    p('Revision Log', { heading: HeadingLevel.HEADING_2 }),
    table([['Date', 'Version', 'Changes', 'Author'], ...(meta.revisionLog || []).map(r => [r.date, r.version, r.changes, r.author || ''])]),
    p('DAFTAR ISI', { heading: HeadingLevel.HEADING_1 }),
    p('Daftar isi dapat diperbarui otomatis melalui Microsoft Word setelah dokumen dibuka.'),
    ...sectionParagraphs(report).flatMap(([heading, body]) => [p(text(heading), { heading: HeadingLevel.HEADING_1 }), p(text(body || '-'))]),
    p('TEST MEASURES', { heading: HeadingLevel.HEADING_1 }),
    table([
      ['Description', '#', '%'],
      ['Total Number of Test Cases Planned', m.totalPlanned, '100%'],
      ['Total Number of Test Cases Executed To Date', m.totalExecuted, `${m.executionRate}%`],
      ['Total Number of Test Cases Passed out of executed ones', m.totalPassed, `${m.passRate}%`],
      ['Total Number of Test Cases Failed out of executed ones', m.totalFailed, `${m.failRate}%`],
      ['Total Number of Test Cases Pending', m.totalPending, `${m.totalPlanned ? Math.round((m.totalPending / m.totalPlanned) * 10000) / 100 : 0}%`],
    ]),
    p('Defect Summary', { heading: HeadingLevel.HEADING_2 }),
    table([
      ['Status', '#'],
      ['Reported', m.bugSummary.reported],
      ['Sedang di Fix', m.bugSummary.fixing],
      ['Ready to Retest', m.bugSummary.readyToRetest],
      ['Verified & Fixed', m.bugSummary.fixed],
    ]),
    p('References', { heading: HeadingLevel.HEADING_1 }),
    table([['Type', 'Title'], ...(meta.references || []).map(r => [r.type, r.title])]),
    p('GLOSSARY', { heading: HeadingLevel.HEADING_1 }),
    table([['Term', 'Definition'], ...(meta.glossary || []).map(g => [g.term, g.definition])]),
    p('LAMPIRAN', { heading: HeadingLevel.HEADING_1 }),
    table([['Document Name', 'Description', 'Location'], ...((meta.appendix || m.appendix).map(a => [a.documentName, a.description, a.location]))]),
  ];

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}
