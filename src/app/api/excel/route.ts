import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { buildImportPreview as buildImportPreviewService, importWorkbook, undoImportBatch } from '@/lib/services/excel-import-service';
import {
  formatExportRow,
  HEADERS,
  setStandardColumnWidths,
  splitExportCases,
  writeHeaderRow,
  writeTestCaseRows as writeExportTestCaseRows,
} from '@/lib/services/excel-export-service';
import { calculatedWeightFor, getCalculatedWeightMap } from '@/lib/services/weight-service';
import { createNotification } from '@/lib/services/notification-service';

// ============== IMPORT (POST) ==============
export async function POST(req: NextRequest) {
  let notificationProjectId = '';
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;
    notificationProjectId = projectId;
    const createModules = formData.get('createModules') === 'true';
    const mode = String(formData.get('mode') || 'import');
    const mappingRaw = String(formData.get('mapping') || '');
    let mappings: Record<string, Record<string, string>> | undefined;
    if (mappingRaw) {
      try {
        mappings = JSON.parse(mappingRaw);
      } catch {
        return NextResponse.json({ error: 'Mapping kolom tidak valid.' }, { status: 400 });
      }
    }

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch {
      return NextResponse.json({ error: 'File Excel tidak dapat dibaca.' }, { status: 400 });
    }

    if (!workbook.SheetNames.length) {
      return NextResponse.json({ error: 'Workbook tidak memiliki sheet.' }, { status: 400 });
    }

    if (mode === 'preview') {
      const preview = await buildImportPreviewService(workbook, projectId, createModules, mappings);
      return NextResponse.json(preview);
    }
    if (mode !== 'import') {
      return NextResponse.json({ error: 'Mode import tidak valid.' }, { status: 400 });
    }

    const preview = await buildImportPreviewService(workbook, projectId, createModules, mappings);
    if (!preview.canImport) {
      return NextResponse.json({
        error: 'File belum aman untuk diimport. Periksa preview import terlebih dahulu.',
        preview,
      }, { status: 400 });
    }

    const importResult = await importWorkbook(workbook, projectId, createModules, undefined, mappings);

    await createNotification({
      projectId,
      type: 'IMPORT_COMPLETED',
      severity: 'success',
      title: 'Import Excel selesai',
      message: `${importResult.imported} testcase berhasil diimport dari ${importResult.totalSheets} sheet.`,
      entityType: 'ImportBatch',
      entityId: importResult.batchId,
      metadata: { tab: 'testcases', imported: importResult.imported },
      dedupeKey: `import-completed:${importResult.batchId}`,
    });

    return NextResponse.json({
      imported: importResult.imported,
      sheets: importResult.sheets,
      totalSheets: importResult.totalSheets,
      batchId: importResult.batchId,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/excel/import error:', error);
    if (notificationProjectId) {
      await createNotification({
        projectId: notificationProjectId,
        type: 'IMPORT_FAILED',
        severity: 'critical',
        title: 'Import Excel gagal',
        message: 'Workbook tidak berhasil diimport. Periksa file dan validasi baris lalu coba lagi.',
        entityType: 'ImportBatch',
        metadata: { tab: 'testcases' },
        dedupeKey: `import-failed:${Date.now()}`,
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: 'Failed to import Excel file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  const batchId = req.nextUrl.searchParams.get('batchId')?.trim();
  if (!projectId || !batchId) return NextResponse.json({ error: 'projectId dan batchId wajib diisi.' }, { status: 400 });
  try {
    return NextResponse.json(await undoImportBatch(projectId, batchId));
  } catch (error) {
    console.error('DELETE /api/excel/import error:', error);
    return NextResponse.json({ error: 'Undo import gagal.' }, { status: 500 });
  }
}

// ============== EXPORT (GET) - Matching user's Excel format exactly ==============

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const format = url.searchParams.get('format') || 'xlsx';
    const multiSheet = url.searchParams.get('multiSheet') === 'true';
    const selectedIds = (url.searchParams.get('ids') || '').split(',').map(id => id.trim()).filter(Boolean);

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });

    const rawTestCases = await db.testCase.findMany({
      where: { projectId, ...(selectedIds.length ? { id: { in: selectedIds } } : {}) },
      include: { module: true },
      orderBy: { testCaseId: 'asc' },
    });
    const weightMap = await getCalculatedWeightMap(projectId);
    const testCases = rawTestCases.map(testCase => ({
      ...testCase,
      calculatedWeight: calculatedWeightFor(weightMap, testCase),
    }));

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // ============== ExcelJS styled export matching user's Excel format ==============
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Test Case Manager';
    workbook.created = new Date();

    if (multiSheet) {
      // Group by module (sheet per module, matching user's format)
      const moduleGroups = new Map<string, typeof testCases>();
      const ungrouped: typeof testCases = [];

      for (const tc of testCases) {
        const modName = tc.module?.name;
        if (modName) {
          if (!moduleGroups.has(modName)) moduleGroups.set(modName, []);
          moduleGroups.get(modName)!.push(tc);
        } else {
          ungrouped.push(tc);
        }
      }

      // Create a sheet per module
      for (const [modName, cases] of moduleGroups) {
        const sheetName = modName.substring(0, 31);
        const ws = workbook.addWorksheet(sheetName);

        // Set column widths matching user's Excel
        setStandardColumnWidths(ws);

        // Row 1: Header row (no legend for module sheets)
        writeHeaderRow(ws, 1);

        // Data rows start at row 2
        writeExportTestCaseRows(ws, cases, 2);
      }

      // Ungrouped test cases
      if (ungrouped.length > 0) {
        const ws = workbook.addWorksheet('Ungrouped');
        setStandardColumnWidths(ws);
        writeHeaderRow(ws, 1);
        writeExportTestCaseRows(ws, ungrouped, 2);
      }

      // If no data at all, add empty sheet
      if (testCases.length === 0) {
        const ws = workbook.addWorksheet('Test Cases');
        setStandardColumnWidths(ws);
        writeHeaderRow(ws, 1);
      }
    } else {
      // Single sheet with all test cases, matching user's original Excel format
      const ws = workbook.addWorksheet(project?.name || 'Test Cases');

      // Set column widths matching user's Excel
      setStandardColumnWidths(ws);

      // Separate whitebox (regular) and blackbox (negative test type) test cases
      const { whiteboxCases, blackboxCases } = splitExportCases(testCases);

      let currentRow = 1;

      // Row 1: Title/Link row (like user's Kiosk sheet row 1)
      const titleRow = ws.getRow(currentRow);
      const projectTitle = project?.name || 'Test Cases';
      titleRow.getCell(1).value = `Test Case ${projectTitle}`;
      titleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF0000FF' } };
      titleRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00FF00' },
      };
      // Merge A1:M1 for title - clear other cells first to avoid overlap
      for (let c = 2; c <= HEADERS.length; c++) {
        titleRow.getCell(c).value = '';
      }
      ws.mergeCells(currentRow, 1, currentRow, HEADERS.length);
      currentRow++;

      // Row 2: Header row
      writeHeaderRow(ws, currentRow);
      currentRow++;

      // Write whitebox test cases
      if (whiteboxCases.length > 0) {
        currentRow = writeExportTestCaseRows(ws, whiteboxCases, currentRow);
      }

      // If there are blackbox test cases, add a section divider (like user's "B. Testcase Blackbox")
      if (blackboxCases.length > 0) {
        // 2 empty rows (spacing like user's Excel)
        currentRow++;
        currentRow++;

        // Section header (merged, bold, like "B. Testcase Blackbox")
        const sectionRow = ws.getRow(currentRow);
        sectionRow.getCell(1).value = 'B. Testcase Blackbox';
        sectionRow.getCell(1).font = { bold: true, size: 12 };
        // Clear other cells in the merged range before merging
        for (let c = 2; c <= HEADERS.length; c++) {
          sectionRow.getCell(c).value = '';
        }
        ws.mergeCells(currentRow, 1, currentRow, HEADERS.length);
        currentRow++;

        // Repeated header row after section divider
        writeHeaderRow(ws, currentRow);
        currentRow++;

        // Write blackbox test cases
        currentRow = writeExportTestCaseRows(ws, blackboxCases, currentRow);
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    if (format === 'csv') {
      // For CSV, fall back to simple XLSX-based CSV generation
      const simpleWb = XLSX.utils.book_new();
      const exportData = testCases.map(formatExportRow);
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(simpleWb, ws, 'Test Cases');
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="testcases.csv"`,
        },
      });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="testcases.xlsx"`,
      },
    });
  } catch (error) {
    console.error('GET /api/excel/export error:', error);
    return NextResponse.json({ error: 'Failed to export Excel file' }, { status: 500 });
  }
}
