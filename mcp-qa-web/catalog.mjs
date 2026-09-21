import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

export function buildCatalog(root) {
  const require = createRequire(path.join(root, 'package.json'));
  const ts = require('typescript');
  const routes = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name === 'route.ts') {
        const source = fs.readFileSync(file, 'utf8');
        const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
        const endpoint = '/api' + path.relative(path.join(root, 'src/app/api'), dir).split(path.sep).filter(Boolean).map(s => '/' + s).join('');
        for (const node of tree.statements) {
          const method = node.name?.text;
          if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(method)) continue;
          if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
          // Authentication is supplied by the local adapter; never expose login/reset/bootstrap as tools.
          if (endpoint.startsWith('/api/auth/') && endpoint !== '/api/auth/status') continue;
          routes.push({
            name: ('web_' + method.toLowerCase() + endpoint.slice(4).replace(/\[([^\]]+)\]/g, 'by_$1').replace(/[^a-zA-Z0-9]+/g, '_')) || 'web_get',
            target: 'web', method, path: endpoint,
            sourceFile: path.relative(root, file).split(path.sep).join('/'),
            source,
            fields: [...new Set([...source.matchAll(/(?:body|data)\??\.([a-zA-Z]\w*)/g)].map(m => m[1]))],
            query: [...new Set([...source.matchAll(/searchParams\.get\(['"]([^'"]+)/g)].map(m => m[1]))],
          });
        }
      }
    }
  }
  walk(path.join(root, 'src/app/api'));
  const relay = [
    ['GET', '/health'], ['POST', '/log'], ['POST', '/manual/start'], ['POST', '/manual/stop'],
    ['POST', '/manual/[sessionId]/exec'],
    ['GET', '/manual/session/[sessionId]'], ['GET', '/runs/[testCaseId]'], ['GET', '/events/[testCaseId]'],
    ['GET', '/logs/[testCaseId]'], ['GET', '/recordings/[testCaseId]/latest'],
    ['GET', '/recordings/[testCaseId]/[sessionId]/metadata'],
    ['GET', '/recordings/[testCaseId]/[sessionId]/frames/[file]'],
    ['GET', '/recordings/[testCaseId]/[sessionId]/video/[file]'],
  ];
  for (const [method, endpoint] of relay) routes.push({ name: 'relay_' + method.toLowerCase() + endpoint.replace(/\[([^\]]+)\]/g, 'by_$1').replace(/[^a-zA-Z0-9]+/g, '_'), target: 'relay', method, path: endpoint, fields: [], query: [], sourceFile: 'mini-services/ws-server.js' });
  const exec = routes.find(op => op.path === '/manual/[sessionId]/exec');
  exec.name = 'relay_post_manual_exec';
  exec.fields = ['expression', 'timeoutMs'];
  for (const op of routes) if (op.name.length > 64) op.name = op.name.slice(0, 53) + '_' + crypto.createHash('sha256').update(op.name).digest('hex').slice(0, 10);
  return routes;
}

export function resolvePath(template, params = {}) {
  return template.replace(/\[([^\]]+)\]/g, (_, key) => {
    const value = params[key];
    if (typeof value !== 'string' || !value || /[/\\?#%]/.test(value) || value === '.' || value === '..') throw new Error(`Invalid or missing path parameter: ${key}`);
    return encodeURIComponent(value);
  });
}

export function publicOperation(op) {
  const { source, ...result } = op;
  return result;
}
