import { describe, expect, it } from 'vitest';
import { activityActorLabel, activityDetail, activityEntityLabel, activityFieldLabel, activityTitle, summarizeActivities, type DashboardActivity } from './activity-summary';

const event = (overrides: Partial<DashboardActivity> = {}): DashboardActivity => ({
  id: 'a', entityType: 'TestCase', entityId: 'uuid-a', action: 'UPDATED',
  field: 'status', afterValue: 'DONE', actor: 'Tester A', createdAt: '2026-10-20T01:00:00.500Z', ...overrides,
});

describe('dashboard activity presentation', () => {
  it('combines adjacent distinct fields without modifying or dropping audit events', () => {
    const items = [event(), event({ id: 'b', field: 'actualResult', createdAt: '2026-10-20T01:00:00.400Z' }), event({ id: 'c', field: 'remarks', createdAt: '2026-10-20T01:00:00.300Z' })];
    const snapshot = structuredClone(items);
    const groups = summarizeActivities(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(items).toEqual(snapshot);
  });
  it.each([
    { actor: 'Tester B' }, { entityId: 'uuid-b' }, { entityType: 'BugFix' },
    { action: 'CREATED' }, { field: 'status' }, { field: null },
    { createdAt: '2026-10-20T00:59:59.000Z' }, { createdAt: 'invalid' },
    { createdAt: '2026-10-20T01:00:01.000Z' },
  ])('keeps unrelated/repeated/invalid updates separate: %j', overrides => {
    expect(summarizeActivities([event(), event({ id: 'b', field: 'remarks', ...overrides })])).toHaveLength(2);
  });
  it('does not group an unbounded chain of adjacent timestamps', () => {
    const groups = summarizeActivities([event(), event({ id: 'b', field: 'remarks', createdAt: '2026-10-20T01:00:00.000Z' }), event({ id: 'c', field: 'priority', createdAt: '2026-10-20T00:59:59.400Z' })]);
    expect(groups.map(group => group.events.length)).toEqual([2, 1]);
  });
  it('prefers current server identity and never mistakes a status for a name', () => {
    expect(activityEntityLabel(event({ entityLabel: 'AUTH-001' }))).toBe('AUTH-001');
    expect(activityEntityLabel(event({ afterValue: { testCaseId: 'OLD-001' } }))).toBe('OLD-001');
    expect(activityEntityLabel(event({ afterValue: { status: 'DONE' } }))).toBe('Nama tidak tersedia pada riwayat ini');
  });
  it.each([
    ['GuestAccessGrant', 'CREATED', 'Akses tamu dibuat'],
    ['GuestAccessGrant', 'REDEEMED', 'Akses tamu digunakan untuk masuk'],
    ['GuestAccessGrant', 'REVOKED', 'Akses tamu dicabut'],
    ['TestExecution', 'EVIDENCE_ADDED', 'Evidence ditambahkan ke eksekusi'],
    ['TestExecution', 'EVIDENCE_REMOVED', 'Evidence dihapus dari eksekusi'],
    ['TestExecution', 'CREATED', 'Eksekusi testcase dibuat'],
    ['TestExecution', 'UPDATED', 'Eksekusi testcase diperbarui'],
    ['TestCase', 'CREATED', 'Testcase dibuat'],
    ['TestCase', 'UPDATED', 'Testcase diperbarui'],
    ['TestCase', 'DELETED', 'Testcase dihapus'],
    ['TestCase', 'IMPORTED', 'Testcase diimpor'],
    ['TestCase', 'COMMENTED', 'Testcase mendapat komentar baru'],
    ['TestRun', 'CASES_ADDED', 'Testcase ditambahkan ke Test Run'],
    ['TestRun', 'CASE_REMOVED', 'Testcase dikeluarkan dari Test Run'],
    ['BugFix', 'CREATED_FROM_EXECUTION', 'Bug dibuat dari hasil eksekusi'],
    ['WorkspaceMembership', 'REMOVED', 'Akun workspace dikeluarkan dari workspace'],
    ['Requirement', 'UPDATED', 'Requirement diperbarui'],
    ['TestPlan', 'CREATED', 'Test Plan dibuat'],
  ])('translates %s/%s without internal codes', (entityType, action, expected) => {
    expect(activityTitle(event({ entityType, action }))).toBe(expected);
  });
  it('uses neutral wording for unknown events instead of exposing code or implying success', () => {
    expect(activityTitle(event({ entityType: 'InternalSecretThing', action: 'FAILED_MYSTERY' }))).toBe('Aktivitas data qa dicatat');
    expect(activityDetail(event({ afterValue: { password: 'secret', token: 'secret' }, field: null }))).toBeNull();
    expect(activityDetail(event({ afterValue: 'INTERNAL_UNKNOWN_STATUS' }))).toBeNull();
  });
  it('reads safe identities from deleted snapshots, guest labels, and resolved execution names', () => {
    expect(activityEntityLabel(event({ action: 'DELETED', afterValue: null, beforeValue: { testCaseId: 'AUTH-009' } }))).toBe('AUTH-009');
    expect(activityEntityLabel(event({ entityType: 'GuestAccessGrant', afterValue: { label: 'Review di HP' } }))).toBe('Review di HP');
    expect(activityEntityLabel(event({ entityType: 'TestExecution', afterValue: { testCaseId: 'internal-fk' } }))).not.toContain('internal-fk');
    expect(activityEntityLabel(event({ action: 'IMPORTED', afterValue: { testCaseId: 'internal-fk' } }))).not.toContain('internal-fk');
    expect(activityEntityLabel(event({ entityLabel: 'AUTH-001 · Smoke Test' }))).toBe('AUTH-001 · Smoke Test');
  });
  it.each([
    ['NOT RUN', 'Belum dijalankan'], ['IN PROGRESS', 'Sedang dikerjakan'], ['PASSED', 'Lulus'],
    ['FAILED', 'Gagal'], ['BLOCKED', 'Terhambat'], ['RETEST', 'Perlu diuji ulang'],
    ['VERIFIED', 'Terverifikasi'], ['DONE', 'Selesai'], ['NOT DONE', 'Belum selesai'],
    ['TBA', 'Belum ditentukan'], ['READY TO RETEST', 'Siap diuji ulang'],
    ['DRAFT', 'Draf'], ['READY', 'Siap dijalankan'], ['COMPLETED', 'Selesai'],
    ['ARCHIVED', 'Diarsipkan'], ['REPORTED', 'Dilaporkan'], ['FIXING', 'Sedang diperbaiki'],
    ['VERIFIED & FIXED', 'Perbaikan terverifikasi'],
  ])('explains status %s', (status, label) => {
    expect(activityDetail(event({ afterValue: status }))).toBe(`Status: ${label}`);
    expect(activityDetail(event({ field: null, afterValue: { status } }))).toBe(`Status: ${label}`);
  });
  it('describes status transitions, evidence replacement, filenames and bulk additions', () => {
    expect(activityDetail(event({ beforeValue: 'FAILED', afterValue: 'READY TO RETEST' }))).toBe('Status: Gagal → Siap diuji ulang');
    expect(activityTitle(event({ action: 'EVIDENCE_REMOVED', afterValue: { replacedBy: 'new-id' } }))).toBe('Evidence lama diganti');
    expect(activityDetail(event({ action: 'EVIDENCE_REMOVED', field: null, beforeValue: { fileName: 'checkout.png' } }))).toBe('File: checkout.png');
    expect(activityDetail(event({ action: 'EVIDENCE_ADDED', field: null, afterValue: { fileName: 'test.png' } }))).toBe('File: test.png');
    expect(activityDetail(event({ action: 'CASES_ADDED', afterValue: ['a', 'b'] }))).toBe('2 testcase ditambahkan');
    expect(activityDetail(event({ entityType: 'WorkspaceMembership', afterValue: { fieldsChanged: ['role', 'password'] } }))).toBe('Perubahan: Peran, Password');
  });
  it('uses readable system and guest actor labels', () => {
    for (const actor of [null, '', ' ', 'system', 'local-user']) expect(activityActorLabel(actor)).toBe('Sistem');
    expect(activityActorLabel('Guest: Review di HP [d6d0997d]')).toBe('Tamu: Review di HP');
    expect(activityActorLabel('Sammy Raimee')).toBe('Sammy Raimee');
  });
  it('translates internal field names and accepts an empty feed', () => {
    expect(activityFieldLabel('actualResult')).toBe('Hasil aktual');
    expect(activityFieldLabel('remarks')).toBe('Catatan');
    expect(activityFieldLabel('customField')).toBe('custom Field');
    expect(summarizeActivities([])).toEqual([]);
  });
});
