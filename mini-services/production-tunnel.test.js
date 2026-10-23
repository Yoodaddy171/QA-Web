import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import { parseOptions, tunnelUrl, webEnvironment, relayEnvironment, runtimePorts, startupCommands, createGateway, assertPortFree } from '../scripts/start-prod-tunnel.mjs';

const cleanups = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

describe('production Quick Tunnel launcher', () => {
  it('only starts existing production; never enables builds, including through CLI arguments', () => {
    expect(parseOptions([])).toEqual({ help: false, check: false });
    expect(parseOptions(['--check', '--no-build'])).toEqual({ help: false, check: true });
    expect(() => parseOptions(['--build'])).toThrow();
    expect(() => parseOptions(['--token=secret'])).toThrow();
    const commands = startupCommands('/node/npm/bin/npm-cli.js');
    expect(commands.web).toEqual(['/node/npm/bin/npm-cli.js', 'start']);
    expect(commands.relay).toEqual(['/node/npm/bin/npm-cli.js', 'run', 'relay']);
    expect(commands.runner).toEqual(['/node/npm/bin/npm-cli.js', 'run', 'automation:runner']);
    expect(Object.values(commands).flat()).not.toContain('build');
  });
  it('validates separate web and relay ports without coercing an invalid configuration', () => {
    expect(runtimePorts({})).toEqual({ web: 3000, relay: 3001 });
    expect(runtimePorts({ PORT: '3100', QA_RELAY_PORT: '3101' })).toEqual({ web: 3100, relay: 3101 });
    for (const env of [{ PORT: 'bad' }, { QA_RELAY_PORT: '0' }, { QA_RELAY_PORT: '65536' }, { PORT: '3001' }]) expect(() => runtimePorts(env)).toThrow();
  });
  it('starts an authenticated loopback relay with the same token and exact web origins', () => {
    const env = { QA_RELAY_TOKEN: 'synthetic-token-only-for-tests-1234567890', QA_RELAY_HOST: '0.0.0.0', QA_RELAY_ALLOWED_ORIGINS: '*', QA_ALLOWED_ORIGINS: 'https://qa.trycloudflare.com,http://127.0.0.1:3000' };
    const relay = relayEnvironment(env, 3001);
    expect(relay).toMatchObject({ QA_RELAY_HOST: '127.0.0.1', QA_RELAY_PORT: '3001', QA_RELAY_TOKEN: env.QA_RELAY_TOKEN, QA_RELAY_ALLOWED_ORIGINS: env.QA_ALLOWED_ORIGINS });
    expect(env.QA_RELAY_HOST).toBe('0.0.0.0');
    expect(() => relayEnvironment({ QA_RELAY_TOKEN: 'short' }, 3001)).toThrow('QA_RELAY_TOKEN');
  });
  it('extracts only a Quick Tunnel HTTPS hostname from a log banner', () => {
    expect(tunnelUrl('| https://blue-fast-qa.trycloudflare.com |')).toBe('https://blue-fast-qa.trycloudflare.com');
    expect(tunnelUrl('https://example.com')).toBeNull();
    expect(tunnelUrl('http://blue.trycloudflare.com')).toBeNull();
  });
  it('sets secure cookies/exact origin/loopback without persisting or mutating input', () => {
    const env = { APP_URL: 'http://localhost:3000', QA_COOKIE_SECURE: '0', QA_WEB_HOST: '0.0.0.0', QA_ALLOWED_ORIGINS: '*', DATABASE_URL: 'file:db.db' };
    const result = webEnvironment(env, 'https://traceva-test.trycloudflare.com', 3000);
    expect(result).toMatchObject({ APP_URL: 'https://traceva-test.trycloudflare.com', QA_COOKIE_SECURE: '1', QA_WEB_HOST: '127.0.0.1', HOSTNAME: '127.0.0.1', DATABASE_URL: env.DATABASE_URL });
    expect(result.QA_ALLOWED_ORIGINS).not.toContain('*');
    expect(env.QA_COOKIE_SECURE).toBe('0');
    expect(() => webEnvironment(env, 'https://evil.test', 3000)).toThrow();
    expect(() => webEnvironment({ QA_EVIDENCE_STORAGE_DIR: 'C:/.next/evidence' }, 'https://qa.trycloudflare.com', 3000)).toThrow();
  });
  it('keeps public ingress closed until readiness, then forwards method, body and cookies', async () => {
    const upstream = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => { res.setHeader('Set-Cookie', 'qa_session=test; Secure; HttpOnly'); res.end(JSON.stringify({ method: req.method, url: req.url, body, cookie: req.headers.cookie })); });
    });
    const port = await listen(upstream);
    cleanups.push(() => new Promise(resolve => { upstream.closeAllConnections(); upstream.close(resolve); }));
    const gateway = createGateway(port);
    const gatewayPort = await listen(gateway.server);
    cleanups.push(() => gateway.close());
    const url = `http://127.0.0.1:${gatewayPort}/api/test?q=1`;
    expect((await fetch(url)).status).toBe(503);
    gateway.enable();
    const response = await fetch(url, { method: 'POST', body: 'notes', headers: { Cookie: 'qa_session=test' } });
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(await response.json()).toEqual({ method: 'POST', url: '/api/test?q=1', body: 'notes', cookie: 'qa_session=test' });
  });
  it('refuses an occupied port without terminating its owner', async () => {
    const server = http.createServer((req, res) => res.end('still alive'));
    const port = await listen(server);
    cleanups.push(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    await expect(assertPortFree(port)).rejects.toThrow('sedang dipakai');
    expect(await (await fetch(`http://127.0.0.1:${port}`)).text()).toBe('still alive');
  });
  it('forwards WebSocket upgrade headers and frames after the gate opens', async () => {
    const upstream = http.createServer();
    const sockets = new Set();
    upstream.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    upstream.on('upgrade', (req, socket) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');
      socket.on('data', data => socket.write(data));
    });
    const port = await listen(upstream);
    cleanups.push(() => new Promise(resolve => { for (const socket of sockets) socket.destroy(); upstream.close(resolve); }));
    const gateway = createGateway(port);
    const gatewayPort = await listen(gateway.server);
    cleanups.push(() => gateway.close());
    gateway.enable();
    const received = await new Promise((resolve, reject) => {
      const client = net.connect(gatewayPort, '127.0.0.1', () => client.write('GET /socket HTTP/1.1\r\nHost: test\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'));
      let result = '';
      let sent = false;
      client.setTimeout(2000, () => { client.destroy(); reject(new Error('Upgrade timeout')); });
      client.on('error', reject);
      client.on('data', chunk => {
        result += chunk.toString();
        if (!sent && result.includes('\r\n\r\n')) { sent = true; client.write('test-frame'); }
        if (result.includes('test-frame')) { client.destroy(); resolve(result); }
      });
    });
    expect(received).toContain('101 Switching Protocols');
    expect(received).toContain('test-frame');
  });
});
