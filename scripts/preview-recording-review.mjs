import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import tailwind from '@tailwindcss/postcss';

const root = process.cwd();
const directory = path.join(root, 'artifacts/ui-review/fullscreen-2026-11-04/preview');
await fs.mkdir(directory, { recursive: true });
const require = createRequire(import.meta.url);
execFileSync(require('@ffmpeg-installer/ffmpeg').path, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=960x540:rate=2', '-t', '30', '-an', '-c:v', 'libvpx', '-b:v', '100k', path.join(directory, 'synthetic.webm')], { stdio: 'pipe', windowsHide: true });
const server = await createServer({
  configFile: false, root: directory, publicDir: false, cacheDir: path.join(directory, '.vite'),
  optimizeDeps: { entries: ['index.html'] },
  define: { 'process.env': '{}' },
  resolve: { alias: { '@': path.join(root, 'src') } },
  esbuild: { jsx: 'automatic' },
  css: { postcss: { plugins: [tailwind()] } },
  server: { host: '127.0.0.1', port: 3128, strictPort: true, fs: { allow: [root] } },
});
await server.listen();
console.log('Synthetic component preview: http://127.0.0.1:3128/');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
