import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.join(await fs.realpath(os.tmpdir()), 'qadesk-phase8e-20261019');
const f = JSON.parse(await fs.readFile(path.join(root, 'fixture.json'), 'utf8'));
const checkout = await fs.realpath(f.checkout);
const gitRoot = path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: checkout, encoding: 'utf8' }).trim());
if (checkout !== path.join(root, 'candidate') || checkout.toLowerCase() !== gitRoot.toLowerCase() || checkout === await fs.realpath(process.cwd())) throw Error('Isolated build target is ambiguous');
if (!f.databaseUrl.startsWith(`file:${root.replaceAll('\\', '/')}/`)) throw Error('Unsafe database');
const op = process.argv[2];
if (!['dev', 'build', 'start'].includes(op)) throw Error('Specify dev/build/start');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'source-sync.json'), 'utf8').catch(() => fs.readFile(path.join(root, 'source-prepare.json'), 'utf8')));
if (!manifest.some(v => v.file === 'src/components/TraceabilityGraphView.tsx')) throw Error('Uncommitted graph candidate missing');
if (op === 'build') {
  const safety = JSON.parse(await fs.readFile(path.join(root, 'primary-safety.json'), 'utf8'));
  for (const entry of manifest) {
    for (const base of [checkout, safety.root]) {
      const hash = crypto.createHash('sha256').update(await fs.readFile(path.join(base, entry.file))).digest('hex');
      if (hash !== entry.sha256) throw Error(`Candidate parity mismatch: ${entry.file}`);
    }
  }
}
console.log(JSON.stringify({ op, cwd: checkout, gitRoot, output: path.join(checkout, '.next'), database: 'synthetic only', primaryBuild: 'excluded', sourceFiles: manifest.length }));
const args = op === 'build' ? ['build', '--webpack'] : op === 'dev' ? ['dev', '--webpack', '-H', '127.0.0.1', '-p', '3127'] : ['start', '-H', '127.0.0.1', '-p', '3127'];
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), ...args], { cwd: checkout, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: op === 'dev' ? 'development' : 'production', DATABASE_URL: f.databaseUrl, POSTGRES_DATABASE_URL: '', PORT: '3127', HOSTNAME: '127.0.0.1', APP_URL: f.origin, QA_ALLOWED_ORIGINS: f.origin, QA_COOKIE_SECURE: '0', QA_RUNTIME_DIR: path.join(root, 'runtime'), QA_EVIDENCE_STORAGE_DIR: path.join(root, 'evidence'), QA_RELAY_TOKEN: '', GROQ_API_KEY: '', GEMINI_API_KEY: '', QA_PERF_PROFILING: '0', NEXT_TELEMETRY_DISABLED: '1' } });
const log = await fs.open(path.join(root, `${op}.log`), 'a');
for (const [stream, dest] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) stream.on('data', data => { dest.write(data); void log.write(data); });
await fs.writeFile(path.join(root, `owned-${op}.json`), JSON.stringify({ pid: child.pid, checkout, port: op === 'build' ? null : 3127 }));
child.on('exit', async code => { await log.close(); process.exitCode = code || 0; });
