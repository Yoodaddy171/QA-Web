import type { ReportData } from './report-types';

/**
 * Format date to readable string
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

/**
 * Generate HTML report
 */
export function generateHTMLReport(report: ReportData): string {
  const { metrics } = report;
  const { sections } = report;
  const periodStart = formatDate(report.reportingPeriodStart);
  const periodEnd = formatDate(report.reportingPeriodEnd);
  const projectName = escapeHtml(report.projectName);
  const version = escapeHtml(report.version);

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Status Report - ${projectName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border: 1px solid #ddd; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { padding: 20px; border-radius: 8px; background: #f5f5f5; }
    .metric-value { font-size: 32px; font-weight: bold; color: #4CAF50; }
    .metric-label { color: #666; font-size: 14px; }
    .narrative { background: #f9f9f9; padding: 15px; border-left: 4px solid #4CAF50; margin: 15px 0; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${report.reportType === 'TEST_PLANNING_DOCUMENT' ? 'Software Test Plan' : 'Software Test Status Report'}</h1>
  <p><strong>Project:</strong> ${projectName}</p>
  <p><strong>Report Type:</strong> ${escapeHtml(report.reportType)}</p>
  <p><strong>Version:</strong> ${version}</p>
  <p><strong>Reporting Period:</strong> ${periodStart} - ${periodEnd}</p>
  <p><strong>Generated:</strong> ${formatDate(report.generatedAt)}</p>

  <h2>Test Execution Summary</h2>
  <div class="metrics">
    <div class="metric-card">
      <div class="metric-value">${metrics.totalPlanned}</div>
      <div class="metric-label">Total Test Cases</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.totalExecuted}</div>
      <div class="metric-label">Executed (${metrics.executionRate.toFixed(2)}%)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.totalPassed}</div>
      <div class="metric-label">Passed (${metrics.passRate.toFixed(2)}%)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.totalFailed}</div>
      <div class="metric-label">Failed (${metrics.failRate.toFixed(2)}%)</div>
    </div>
  </div>

  <h2>Test Metrics by Module</h2>
  <table>
    <thead>
      <tr>
        <th>Module</th>
        <th>Planned</th>
        <th>Executed</th>
        <th>Passed</th>
        <th>Failed</th>
        <th>Pass Rate</th>
      </tr>
    </thead>
    <tbody>
      ${metrics.byModule.map(m => `
        <tr>
          <td>${escapeHtml(m.moduleName)}</td>
          <td>${m.totalPlanned}</td>
          <td>${m.totalExecuted}</td>
          <td>${m.totalPassed}</td>
          <td>${m.totalFailed}</td>
          <td>${m.passRate.toFixed(2)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>Test Metrics by Priority</h2>
  <table>
    <thead>
      <tr>
        <th>Priority</th>
        <th>Planned</th>
        <th>Executed</th>
        <th>Passed</th>
        <th>Failed</th>
        <th>Pass Rate</th>
      </tr>
    </thead>
    <tbody>
      ${metrics.byPriority.map(p => `
        <tr>
          <td>${escapeHtml(p.priority)}</td>
          <td>${p.totalPlanned}</td>
          <td>${p.totalExecuted}</td>
          <td>${p.totalPassed}</td>
          <td>${p.totalFailed}</td>
          <td>${p.passRate.toFixed(2)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${sections.scope ? `
    <h2>Scope</h2>
    <div class="narrative">${escapeHtml(sections.scope)}</div>
  ` : ''}

  ${sections.progressNarrative ? `
    <h2>Progress Against Test Plan</h2>
    <div class="narrative">${escapeHtml(sections.progressNarrative)}</div>
  ` : ''}

  ${sections.blockingFactors ? `
    <h2>Blocking Factors</h2>
    <div class="narrative">${escapeHtml(sections.blockingFactors)}</div>
  ` : ''}

  ${sections.newRisks ? `
    <h2>New and Changed Risks</h2>
    <div class="narrative">${escapeHtml(sections.newRisks)}</div>
  ` : ''}

  ${sections.plannedTesting ? `
    <h2>Planned Testing</h2>
    <div class="narrative">${escapeHtml(sections.plannedTesting)}</div>
  ` : ''}

  <p style="margin-top: 50px; color: #999; font-size: 12px;">
    Generated by QA-Web Testing Platform on ${formatDate(new Date())}
  </p>
</body>
</html>
  `.trim();
}
