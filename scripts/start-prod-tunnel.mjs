import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveEvidenceStorageRoot } from '../src/lib/storage/evidence-storage-path.mjs';
import relaySecurity from '../mini-services/relay-security.js';
import { runnerRoot, runnerHealth } from '../src/lib/automation/script-store.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function parseOptions(args) {
  const known = new Set(['--help', '--check', '--no-build']);
  if (args.some(arg => !known.has(arg))) throw new Error('Argumen tidak dikenal. Gunakan --help.');
  // --no-build remains a harmless compatibility alias. Building is never a launcher action.
  return { help: args.includes('--help'), check: args.includes('--check') };
}

export function runtimePorts(env) {
  const web = Number(env.PORT || 3000), relay = Number(env.QA_RELAY_PORT || 3001);
  if ([web, relay].some(port => !Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('PORT dan QA_RELAY_PORT harus berupa angka 1–65535.');
  if (web === relay) throw new Error('Port web dan relay harus berbeda.');
  return { web, relay };
}

export function relayEnvironment(env, relayPort) {
  return { ...env, QA_RELAY_HOST: '127.0.0.1', QA_RELAY_PORT: String(relayPort),
    QA_RELAY_TOKEN: relaySecurity.validateRelayToken(env.QA_RELAY_TOKEN || env.NEXT_PUBLIC_QA_RELAY_TOKEN),
    QA_RELAY_ALLOWED_ORIGINS: env.QA_ALLOWED_ORIGINS,
  };
}

export function startupCommands(npmCli) {
  return { web: [npmCli, 'start'], relay: [npmCli, 'run', 'relay'], runner: [npmCli, 'run', 'automation:runner'] };
}

async function findNpmCli(env) {
  const candidates = [env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    ...(env.NVM_SYMLINK ? [path.join(env.NVM_SYMLINK, 'node_modules/npm/bin/npm-cli.js')] : []),
  ].filter(filename => filename && path.basename(filename).toLowerCase() === 'npm-cli.js');
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  throw new Error('npm CLI tidak ditemukan pada instalasi Node.js ini. Periksa instalasi Node.js/npm terlebih dahulu.');
}

export function tunnelUrl(text) {
  return text.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com\b/i)?.[0] || null;
}

export function webEnvironment(env, url, port) {
  if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(url)) throw new Error('URL Quick Tunnel tidak valid.');
  return {
    ...env, NODE_ENV: 'production', PORT: String(port), HOSTNAME: '127.0.0.1', QA_WEB_HOST: '127.0.0.1',
    APP_URL: url, QA_COOKIE_SECURE: '1',
    QA_ALLOWED_ORIGINS: [url, `http://127.0.0.1:${port}`, `http://localhost:${port}`].join(','),
    QA_EVIDENCE_STORAGE_DIR: resolveEvidenceStorageRoot(env),
  };
}

async function exists(filename) {
  return fs.access(filename).then(() => true, () => false);
}

async function findCloudflared(env) {
  const names = process.platform === 'win32' ? ['cloudflared.exe'] : ['cloudflared'];
  const candidates = env.TRACEVA_CLOUDFLARED_PATH ? [env.TRACEVA_CLOUDFLARED_PATH] : [
    ...(env.PATH || '').split(path.delimiter).flatMap(dir => names.map(name => path.join(dir.replaceAll('"', ''), name))),
    ...(env.LOCALAPPDATA ? [path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe')] : []),
    ...['ProgramFiles', 'ProgramFiles(x86)'].flatMap(key => env[key] ? [path.join(env[key], 'cloudflared', 'cloudflared.exe')] : []),
  ];
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  throw new Error('cloudflared belum ditemukan. Jalankan: winget install --id Cloudflare.cloudflared --exact\nLalu buka ulang BAT. Atau isi TRACEVA_CLOUDFLARED_PATH di .env dengan path executable.');
}

export async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${port} sedang dipakai. Hentikan server tersebut atau ubah PORT di .env. Tidak ada proses yang dimatikan otomatis.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

/** Gate remains closed until web and relay pass their readiness checks. */
export function createGateway(port) {
  let ready = false;
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    if (!ready) { res.writeHead(503, { 'Cache-Control': 'no-store' }); res.end('Traceva sedang disiapkan.'); return; }
    const upstream = http.request({ host: '127.0.0.1', port, method: req.method, path: req.url, headers: req.headers }, response => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  });
  server.on('upgrade', (req, socket, head) => {
    if (!ready) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
    const upstream = net.connect(port, '127.0.0.1', () => {
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${req.rawHeaders.reduce((lines, value, i, all) => i % 2 ? lines : `${lines}${value}: ${all[i + 1]}\r\n`, '')}\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    socket.on('close', () => upstream.destroy());
    upstream.on('close', () => socket.destroy());
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  return {
    server,
    enable: () => { ready = true; },
    close: async () => { ready = false; for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); },
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log('Traceva production + relay + Cloudflare Quick Tunnel\n\nDouble-click run-traceva-production-tunnel.bat: npm start + npm run relay, tanpa build ulang.\nBuild production harus sudah tersedia (npm run build dijalankan manual bila diperlukan).\n--check     Cek konfigurasi/dependency saja; tidak menjalankan layanan atau tunnel.\n--no-build  Alias kompatibilitas; launcher memang tidak pernah menjalankan build.\n--help      Bantuan.\n\nCtrl+C menghentikan web, relay, dan tunnel milik launcher. Jangan menutup paksa jendelanya.');
    return;
  }
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22 || major >= 26) throw new Error('Launcher membutuhkan Node.js 22 atau 24 LTS (parseEnv/--env-file).');
  const env = { ...parseEnv((await fs.readFile(path.join(root, '.env'), 'utf8')).replace(/^\uFEFF/, '')), ...process.env };
  const { web: port, relay: relayPort } = runtimePorts(env);
  resolveEvidenceStorageRoot(env);
  relaySecurity.validateRelayToken(env.QA_RELAY_TOKEN || env.NEXT_PUBLIC_QA_RELAY_TOKEN);
  if (!await exists(path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'))) throw new Error('Dependency belum tersedia. Jalankan npm install dahulu.');
  if (!await exists(path.join(root, '.next', 'standalone', 'server.js'))) throw new Error('Build production belum ada. Jalankan npm run build secara manual, lalu buka BAT lagi. Launcher tidak melakukan build.');
  const npmCli = await findNpmCli(env);
  const commands = startupCommands(npmCli);
  const cloudflared = await findCloudflared(env);
  for (const name of ['config.yml', 'config.yaml']) {
    if (await exists(path.join(os.homedir(), '.cloudflared', name))) throw new Error(`Quick Tunnel memerlukan konfigurasi terpisah dari Named Tunnel. Pindahkan sementara ~/.cloudflared/${name} secara manual; launcher tidak mengubahnya.`);
  }
  await Promise.all([assertPortFree(port), assertPortFree(relayPort)]);
  if (options.check) { console.log(`Pemeriksaan lulus. Web loopback:${port}; relay loopback:${relayPort}; npm dan cloudflared tersedia. Tidak ada layanan/tunnel yang dijalankan.`); return; }

  const children = new Set();
  const gateway = createGateway(port);
  let stopping = false;
  let shutdownPromise;
  const stop = (code = 0) => {
    if (shutdownPromise) return shutdownPromise;
    stopping = true;
    process.exitCode = code;
    shutdownPromise = (async () => {
      await gateway.close();
      await Promise.all([...children].map(child => new Promise(resolve => {
        if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
        if (process.platform === 'win32') {
          const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          killer.on('error', resolve); killer.on('close', resolve);
        } else { child.once('close', resolve); child.kill('SIGTERM'); }
      })));
    })();
    return shutdownPromise;
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { console.log('\nMenghentikan Traceva, relay, dan tunnel...'); void stop(); });

  function launch(command, args, childEnv, { quiet = false } = {}) {
    if (stopping) throw new Error('Startup dibatalkan.');
    const child = spawn(command, args, { cwd: root, env: childEnv, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(child);
    // Attach a handler immediately; callers can safely await this promise later.
    child.done = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => { children.delete(child); if (code === 0 || stopping) resolve(); else reject(new Error(`Proses ${path.basename(command)} berhenti (exit ${code}).`)); });
    });
    child.done.catch(() => {});
    if (!quiet) { child.stdout.pipe(process.stdout, { end: false }); child.stderr.pipe(process.stderr, { end: false }); }
    return child;
  }
  try {
    if (stopping) return;
    // A fresh localhost port prevents exposing any other service during startup.
    await new Promise((resolve, reject) => { gateway.server.once('error', reject); gateway.server.listen(0, '127.0.0.1', resolve); });
    const gatewayPort = gateway.server.address().port;
    const tunnelEnv = { ...env };
    delete tunnelEnv.TUNNEL_TOKEN;
    delete tunnelEnv.TUNNEL_URL;
    console.log('Meminta alamat acak Cloudflare (gateway masih tertutup)...');
    const tunnel = launch(cloudflared, ['tunnel', '--url', `http://127.0.0.1:${gatewayPort}`, '--no-autoupdate'], tunnelEnv, { quiet: true });
    let output = '';
    let url = null;
    let connected = false;
    const capture = chunk => {
      output = (output + chunk.toString()).slice(-16000);
      url ||= tunnelUrl(output);
      connected ||= output.includes('Registered tunnel connection');
    };
    tunnel.stdout.on('data', capture); tunnel.stderr.on('data', capture);
    const until = Date.now() + 60_000;
    while (!url || !connected) {
      if (stopping) return;
      if (tunnel.exitCode !== null || Date.now() > until) throw new Error('Cloudflare belum tersambung dalam 60 detik atau berhenti. Periksa internet/firewall lalu coba lagi.');
      await Promise.race([delay(200), tunnel.done.then(() => { throw new Error('Tunnel berhenti sebelum siap.'); })]);
    }
    const appEnv = relayEnvironment(webEnvironment(env, url, port), relayPort);
    console.log('Menjalankan npm start dan npm run relay (tanpa build ulang)...');
    const web = launch(process.execPath, commands.web, appEnv);
    const relay = launch(process.execPath, commands.relay, appEnv);
    // Reuse a runner explicitly started by the operator; never kill that process.
    const runnerDirectory = runnerRoot(appEnv);
    const runner = (await runnerHealth(runnerDirectory)).online ? null : launch(process.execPath, commands.runner, appEnv);
    const webUntil = Date.now() + 60_000;
    for (;;) {
      if (stopping) return;
      if (web.exitCode !== null || relay.exitCode !== null || (runner && runner.exitCode !== null) || Date.now() > webUntil) throw new Error('Web/relay/runner belum siap atau berhenti. Periksa log di atas.');
      let status, relayStatus;
      try {
        [status, relayStatus] = await Promise.all([
          fetch(`http://127.0.0.1:${port}/api/auth/status`, { signal: AbortSignal.timeout(2000), redirect: 'error' }).then(response => response.ok ? response.json() : null),
          fetch(`http://127.0.0.1:${relayPort}/health`, { headers: { Authorization: `Bearer ${appEnv.QA_RELAY_TOKEN}` }, signal: AbortSignal.timeout(2000), redirect: 'error' }).then(response => response.ok ? response.json() : null),
        ]);
      } catch { /* Bounded retry while the owned server starts. */ }
      if (status?.setupRequired === true) throw new Error('Tunnel dibatalkan: buat akun owner secara lokal terlebih dahulu. Bootstrap tidak boleh diekspos publik.');
      if (status?.setupRequired === false && status.authenticated === false && relayStatus?.success === true && relayStatus.status === 'ready' && (await runnerHealth(runnerDirectory)).online) break;
      await Promise.race([delay(300), web.done.then(() => { throw new Error('Web berhenti sebelum siap.'); }), relay.done.then(() => { throw new Error('Relay berhenti sebelum siap.'); }), tunnel.done.then(() => { throw new Error('Tunnel terputus.'); })]);
    }
    gateway.enable();
    console.log(`\nTRACEVA SIAP\nURL publik: ${url}\nLogin: ${url}/login\nRelay lokal: http://127.0.0.1:${relayPort}\n\nBagikan URL dan token tamu secara terpisah. URL berubah setiap restart.\nGunakan URL HTTPS ini untuk login (cookie Secure aktif).\nRelay dan runner berjalan lokal, tidak dipublikasikan melalui tunnel.\nCtrl+C untuk menghentikan web + relay + runner + tunnel milik launcher.\n`);
    console.log('Playwright runner lokal siap. Hanya script tepercaya dari owner/admin; bukan sandbox.');
    await Promise.race([web.done, relay.done, tunnel.done, ...(runner ? [runner.done] : [])]);
    if (!stopping) throw new Error('Web, relay, atau tunnel berhenti; seluruh layanan launcher ikut dihentikan.');
  } finally { await stop(process.exitCode || 0); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`\nTraceva: ${error.message}`); process.exitCode = 1; });
}
