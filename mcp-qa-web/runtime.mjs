import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { DeletionGuard, normalizeBody } from './guard.mjs';
import { resolvePath } from './catalog.mjs';

export class Runtime {
  guard = new DeletionGuard();
  constructor(root, env, sessionProvider) {
    this.root = root; this.env = env; this.sessionProvider = sessionProvider;
    this.artifacts = path.join(root, 'data/mcp-artifacts');
    this.web = this.localUrl(env.QA_MCP_WEB_URL || 'http://127.0.0.1:3000');
    this.relay = this.localUrl(env.QA_MCP_RELAY_URL || 'http://127.0.0.1:3001');
  }
  localUrl(raw) {
    const url = new URL(raw);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('MCP adapter supports loopback service origins only.');
    return url.origin;
  }
  scrub(value) {
    let text = JSON.stringify(value);
    for (const key of Object.keys(this.env)) {
      if (/TOKEN|SECRET|PASSWORD|API_KEY/.test(key) && this.env[key]?.length >= 8) text = text.split(this.env[key]).join('[REDACTED]');
    }
    if (this.sessionToken) text = text.split(this.sessionToken).join('[REDACTED]');
    return JSON.parse(text);
  }
  async session() {
    if (this.sessionProvider) return this.sessionProvider();
    if (this.sessionToken && this.sessionUntil > Date.now() + 60000) return this.sessionToken;
    const require = createRequire(path.join(this.root, 'package.json'));
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient({ datasourceUrl: this.env.DATABASE_URL, log: [] });
    try {
      const users = await db.user.findMany({ where: { disabledAt: null, ...(this.env.QA_MCP_USER_ID ? { id: this.env.QA_MCP_USER_ID } : {}), memberships: { some: { role: 'OWNER' } } }, select: { id: true }, take: 2 });
      if (users.length !== 1) throw new Error('Set QA_MCP_USER_ID to exactly one active workspace OWNER in local .env.');
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      this.sessionUntil = Date.now() + 7 * 24 * 3600000;
      await db.session.create({ data: { userId: users[0].id, tokenHash, expiresAt: new Date(this.sessionUntil) } });
      if (this.sessionHash) await db.session.deleteMany({ where: { tokenHash: this.sessionHash } });
      this.sessionToken = token; this.sessionHash = tokenHash;
      return token;
    } finally { await db.$disconnect(); }
  }
  async close() {
    if (!this.sessionHash) return;
    const require = createRequire(path.join(this.root, 'package.json'));
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient({ datasourceUrl: this.env.DATABASE_URL, log: [] });
    try { await db.session.deleteMany({ where: { tokenHash: this.sessionHash } }); }
    finally { await db.$disconnect(); }
  }
  async execute(op, args = {}) {
    const endpoint = resolvePath(op.path, args.params);
    const query = { ...args.query };
    const body = normalizeBody(op, args.body);
    const warning = this.guard.check(op, args);
    if (warning) return warning;
    const url = new URL(endpoint, op.target === 'relay' ? this.relay : this.web);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null) url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    const headers = { Origin: this.web };
    if (op.target === 'relay') {
      if (!this.env.QA_RELAY_TOKEN) throw new Error('QA_RELAY_TOKEN missing in local .env.');
      headers.Authorization = `Bearer ${this.env.QA_RELAY_TOKEN}`;
    } else headers.Cookie = `qa_session=${await this.session()}`;
    let payload;
    if (args.form || args.files?.length) {
      if (body) throw new Error('Use body OR form/files, not both.');
      payload = new FormData();
      for (const [key, value] of Object.entries(args.form || {})) payload.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      // Proxy extracts project scope from query for multipart requests.
      if (args.form?.projectId && !url.searchParams.has('projectId')) url.searchParams.set('projectId', String(args.form.projectId));
      for (const file of args.files || []) {
        const filePath = path.resolve(file.path);
        if (/(^|[/\\])\.env(?:\.|$)|\.pem$|\.key$/i.test(filePath)) throw new Error('Credential files cannot be uploaded as evidence.');
        if ((await fs.stat(filePath)).size > 25 * 1024 * 1024) throw new Error('Upload exceeds 25 MB.');
        payload.append(file.field || 'file', new Blob([await fs.readFile(filePath)], { type: file.mimeType || 'application/octet-stream' }), file.name || path.basename(filePath));
      }
    } else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const start = Date.now();
    let response;
    try { response = await fetch(url, { method: op.method, headers, body: payload, redirect: 'error', signal: AbortSignal.timeout(op.name === 'relay_post_manual_exec' ? 130000 : 120000) }); }
    catch { throw new Error(`Request failed or timed out: ${op.method} ${endpoint}. For mutations, outcome UNKNOWN; read state before retrying.`); }
    const type = response.headers.get('content-type') || '';
    let data;
    if (type.includes('application/json')) data = await response.json();
    else if (type.startsWith('text/') || /jsonlines|javascript/.test(type)) data = await response.text();
    else {
      const bytes = Buffer.from(await response.arrayBuffer());
      const extension = type.includes('spreadsheet') ? '.xlsx' : type.includes('wordprocessing') ? '.docx' : type.includes('png') ? '.png' : type.includes('jpeg') ? '.jpg' : type.includes('mp4') ? '.mp4' : '.bin';
      await fs.mkdir(this.artifacts, { recursive: true });
      const outputPath = path.join(this.artifacts, `${crypto.randomUUID()}${extension}`);
      await fs.writeFile(outputPath, bytes, { flag: 'wx' });
      data = { outputPath, mimeType: type, bytes: bytes.length };
    }
    data = this.scrub(data);
    if (typeof data === 'string' && data.length > 50000) {
      await fs.mkdir(this.artifacts, { recursive: true });
      const outputPath = path.join(this.artifacts, `${crypto.randomUUID()}.txt`);
      await fs.writeFile(outputPath, data, { flag: 'wx' });
      data = { outputPath, preview: data.slice(0, 2000), truncated: true };
    }
    await fs.mkdir(this.artifacts, { recursive: true });
    await fs.appendFile(path.join(this.artifacts, 'audit.jsonl'), JSON.stringify({ at: new Date().toISOString(), operation: op.name, endpoint, status: response.status, elapsedMs: Date.now() - start }) + '\n');
    return { ok: response.ok, status: response.status, data, ...(response.status >= 500 && op.method !== 'GET' ? { outcome: 'UNKNOWN: reconcile persisted state before retrying' } : {}) };
  }
}

export async function loadEnvironment(root) {
  let env = {};
  for (const name of ['.env', '.env.local']) {
    try { env = { ...env, ...parseEnv((await fs.readFile(path.join(root, name), 'utf8')).replace(/^\uFEFF/, '')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { ...env, ...process.env };
}
