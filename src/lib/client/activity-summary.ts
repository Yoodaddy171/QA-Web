export type DashboardActivity = {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  action: string;
  field: string | null;
  afterValue: unknown;
  beforeValue?: unknown;
  actor: string | null;
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  remarks: 'Catatan', notes: 'Catatan eksekusi', actualResult: 'Hasil aktual', status: 'Status', steps: 'Langkah pengujian',
  testAction: 'Skenario pengujian', expectedResult: 'Hasil yang diharapkan', priority: 'Prioritas',
  assignee: 'Penanggung jawab', assignedTo: 'Penanggung jawab', moduleId: 'Modul',
  testCaseId: 'ID testcase', page: 'Halaman', subMenu: 'Submenu', name: 'Nama', progress: 'Progres',
  description: 'Deskripsi', tester: 'Tester', duration: 'Durasi', startedAt: 'Waktu mulai',
  completedAt: 'Waktu selesai', role: 'Peran', email: 'Email', password: 'Password',
  dueDate: 'Tenggat', title: 'Judul', tags: 'Tag', testType: 'Jenis pengujian',
  weight: 'Bobot', requirementId: 'Requirement', testPlanId: 'Test Plan',
  disabledAt: 'Status akun', membership: 'Keanggotaan workspace',
};

const ENTITY_LABELS: Record<string, string> = {
  TestCase: 'Testcase', TestRun: 'Test Run', TestExecution: 'Eksekusi testcase',
  BugFix: 'Bug', Requirement: 'Requirement', TestPlan: 'Test Plan',
  GuestAccessGrant: 'Akses tamu', WorkspaceMembership: 'Akun workspace', ImportBatch: 'Impor Excel',
  Project: 'Project', Module: 'Modul', Evidence: 'Evidence',
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'dibuat', UPDATED: 'diperbarui', DELETED: 'dihapus', IMPORTED: 'diimpor',
  COMMENTED: 'mendapat komentar baru', REVOKED: 'dicabut', REDEEMED: 'digunakan untuk masuk',
  REMOVED: 'dikeluarkan dari workspace', ARCHIVED: 'diarsipkan', RESTORED: 'dipulihkan',
  STARTED: 'dimulai', COMPLETED: 'diselesaikan', CANCELLED: 'dibatalkan',
  LINKED: 'ditautkan', UNLINKED: 'dilepas dari relasi',
};

const STATUS_LABELS: Record<string, string> = {
  'NOT RUN': 'Belum dijalankan', 'IN PROGRESS': 'Sedang dikerjakan', PASSED: 'Lulus',
  FAILED: 'Gagal', BLOCKED: 'Terhambat', RETEST: 'Perlu diuji ulang', VERIFIED: 'Terverifikasi',
  DONE: 'Selesai', TODO: 'Belum dikerjakan', 'TO DO': 'Belum dikerjakan',
  DRAFT: 'Draf', READY: 'Siap dijalankan', COMPLETED: 'Selesai', ARCHIVED: 'Diarsipkan',
  REPORTED: 'Dilaporkan', FIXING: 'Sedang diperbaiki', 'READY TO RETEST': 'Siap diuji ulang',
  'VERIFIED & FIXED': 'Perbaikan terverifikasi', 'NOT APPLICABLE': 'Tidak berlaku',
  'NOT DONE': 'Belum selesai', TBA: 'Belum ditentukan', CANCELLED: 'Dibatalkan',
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function activityEntityTypeLabel(entityType: string) {
  return ENTITY_LABELS[entityType] || 'Data QA';
}

export function activityTitle(item: DashboardActivity) {
  const entity = activityEntityTypeLabel(item.entityType);
  switch (item.action) {
    case 'EVIDENCE_ADDED': return 'Evidence ditambahkan ke eksekusi';
    case 'EVIDENCE_REMOVED': return record(item.afterValue).replacedBy ? 'Evidence lama diganti' : 'Evidence dihapus dari eksekusi';
    case 'CREATED_FROM_EXECUTION': return 'Bug dibuat dari hasil eksekusi';
    case 'CASES_ADDED': return 'Testcase ditambahkan ke Test Run';
    case 'CASE_REMOVED': return 'Testcase dikeluarkan dari Test Run';
    default: return ACTION_LABELS[item.action] ? `${entity} ${ACTION_LABELS[item.action]}` : `Aktivitas ${entity.toLowerCase()} dicatat`;
  }
}

function statusLabel(value: unknown) {
  return typeof value === 'string' ? STATUS_LABELS[value] : undefined;
}

/** Only display approved metadata, never arbitrary audit payloads or secrets. */
export function activityDetail(item: DashboardActivity) {
  const after = record(item.afterValue);
  const status = statusLabel(item.field === 'status' && typeof item.afterValue === 'string' ? item.afterValue : after.status);
  if (status) {
    const before = statusLabel(typeof item.beforeValue === 'string' ? item.beforeValue : record(item.beforeValue).status);
    return before && before !== status ? `Status: ${before} → ${status}` : `Status: ${status}`;
  }
  if (item.field === 'actualResult') {
    if (item.afterValue === 'As Expected') return 'Hasil aktual: Sesuai harapan';
    if (item.afterValue === 'Not As Expected') return 'Hasil aktual: Tidak sesuai harapan';
    if (item.afterValue === null || item.afterValue === '') return 'Hasil aktual dikosongkan';
  }
  if ((item.action === 'EVIDENCE_ADDED' || item.action === 'EVIDENCE_REMOVED')) {
    const file = (item.action === 'EVIDENCE_REMOVED' ? record(item.beforeValue) : after).fileName;
    return typeof file === 'string' && file.trim() ? `File: ${file}` : null;
  }
  if (item.action === 'CASES_ADDED' && Array.isArray(item.afterValue)) return `${item.afterValue.length} testcase ditambahkan`;
  if (item.entityType === 'WorkspaceMembership' && Array.isArray(after.fieldsChanged)) {
    return `Perubahan: ${after.fieldsChanged.filter((field): field is string => typeof field === 'string').map(activityFieldLabel).join(', ')}`;
  }
  return null;
}

export function activityActorLabel(actor: string | null) {
  if (!actor?.trim() || actor === 'system' || actor === 'local-user') return 'Sistem';
  return actor.replace(/^Guest: (.*) \[[a-f0-9-]{8}\]$/, 'Tamu: $1');
}

export function activityFieldLabel(field: string) {
  return FIELD_LABELS[field] || field.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
}

export function activityEntityLabel(item: DashboardActivity) {
  if (item.entityLabel) return item.entityLabel;
  for (const source of [item.afterValue, item.beforeValue]) {
    const value = record(source);
    // testCaseId in execution/import snapshots is an internal foreign key.
    const keys = item.entityType === 'TestCase' && item.action !== 'IMPORTED'
      ? ['testCaseId', 'name', 'title', 'label'] : ['name', 'title', 'label'];
    for (const key of keys) {
      if (typeof value[key] === 'string' && value[key].trim()) return value[key];
    }
  }
  // Deleted entities and older servers may have no human-readable identity.
  return 'Nama tidak tersedia pada riwayat ini';
}

/** Presentation only: retain every original event; never rewrite audit history.
 * Group adjacent, distinct-field updates within one second, not arbitrary events
 * in the same minute. Repeated writes to one field stay separate.
 */
export function summarizeActivities(items: DashboardActivity[]) {
  const groups: Array<{ item: DashboardActivity; events: DashboardActivity[] }> = [];
  for (const item of items) {
    const previous = groups.at(-1);
    const elapsed = previous ? Date.parse(previous.item.createdAt) - Date.parse(item.createdAt) : NaN;
    if (previous && item.action === 'UPDATED' && previous.item.action === item.action
      && previous.item.entityType === item.entityType && previous.item.entityId === item.entityId
      && previous.item.actor === item.actor && item.field && previous.events.every(event => event.field && event.field !== item.field)
      && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 1000) {
      previous.events.push(item);
    } else {
      groups.push({ item, events: [item] });
    }
  }
  return groups;
}
