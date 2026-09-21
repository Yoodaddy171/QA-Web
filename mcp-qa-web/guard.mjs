import crypto from 'node:crypto';

export class DeletionGuard {
  pending = new Map();
  check(operation, args) {
    if (operation.method !== 'DELETE') return null;
    const { confirmation, userConfirmed, ...payload } = args;
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ name: operation.name, payload })).digest('hex');
    for (const [key, value] of this.pending) if (value.until < Date.now()) this.pending.delete(key);
    const prior = this.pending.get(confirmation);
    if (userConfirmed === true && prior?.fingerprint === fingerprint && prior.until > Date.now()) {
      this.pending.delete(confirmation);
      return null;
    }
    const challenge = crypto.randomUUID();
    this.pending.set(challenge, { fingerprint, until: Date.now() + 300_000 });
    return {
      confirmationRequired: true, executed: false,
      warning: 'Penghapusan dapat menghapus banyak record terkait (cascade), evidence, atau seluruh import batch. Tampilkan scope ini kepada user dan tunggu persetujuan eksplisit. Jangan mengonfirmasi sendiri atau memecah bulk menjadi delete satu per satu.',
      operation: operation.name, path: operation.path, scope: payload,
      confirmation: challenge, expiresInSeconds: 300,
      next: 'After user approval, repeat the EXACT request with confirmation and userConfirmed:true. Confirmation is single-use. On timeout read state before retrying.',
    };
  }
}

export function normalizeBody(op, input) {
  if (input === undefined) return undefined;
  const body = structuredClone(input);
  if (op.path === '/api/testcases' && ['POST', 'PUT'].includes(op.method)) {
    if ('tags' in body && body.tags === null) body.tags = [];
    if ('status' in body && !['DONE', 'NOT DONE', 'IN PROGRESS', 'BLOCKED', 'FAILED', 'READY TO RETEST', 'TBA'].includes(body.status)) throw new Error('Invalid testcase status. Use NOT DONE (space), not NOT_DONE.');
    if ('actualResult' in body && ![null, '', '-', 'As Expected', 'Not As Expected'].includes(body.actualResult)) throw new Error('Testcase actualResult is a badge; put prose in remarks. Execution actualResult is free text.');
    if (body.status === 'DONE' && body.actualResult === 'Not As Expected') throw new Error('Inconsistent verdict: DONE and Not As Expected.');
    for (const key of ['module', 'progress', 'weight', 'calculatedWeight', 'createdAt', 'updatedAt', 'stepLogs']) delete body[key];
  }
  return body;
}
