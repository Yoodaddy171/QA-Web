# Reports Feature Implementation

Date: July 9, 2026

## What Exists

- Sidebar menu `Reports`.
- Report history per project.
- Create Test Status / Test Planning report.
- Metrics snapshot saved to database so older reports do not change.
- HTML export from the saved report data.

## Files Added

- `src/app/api/reports/route.ts`
- `src/components/ReportsPanel.tsx`
- `src/components/ReportForm.tsx`
- `src/components/ReportHistory.tsx`
- `src/components/ReportViewer.tsx`
- `src/lib/services/report-types.ts`
- `src/lib/services/report-generator.ts`
- `src/lib/services/report-export.ts`

## Schema

`Report` was added to both Prisma schemas:

- `prisma/schema.prisma`
- `prisma/sqlite.prisma`

Local SQLite was synced with:

```bash
npx prisma db push --schema prisma/sqlite.prisma
```

## Current Behavior

Metrics are calculated from testcase rows updated inside the selected reporting period:

- planned
- executed
- passed
- failed
- pending
- pass/fail/execution rate
- breakdown by module
- breakdown by priority
- breakdown by status

Manual sections:

- Progress Against Test Plan
- Blocking Factors
- New and Changed Risks
- Planned Testing

## Verification

```bash
npm run db:generate
npx prisma db push --schema prisma/sqlite.prisma
npx tsc --noEmit --pretty false
```

All commands above passed locally.

## Deferred

- PDF export: use browser print / Save as PDF when needed.
- DOCX export: not implemented and no dependency installed.
- Approval/signature workflow: add only after QA team confirms the exact process.
