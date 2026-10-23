import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-static';

export async function GET() {
  const logo = await readFile(path.join(process.cwd(), 'public', 'traceva-logo.png'));
  // Embed the original artwork so the favicon has no external image dependency.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="35 315 450 450"><defs><clipPath id="mark"><polygon points="0,0 1448,0 1448,458 435,458 435,1086 0,1086"/></clipPath></defs><image width="1448" height="1086" clip-path="url(#mark)" href="data:image/png;base64,${logo.toString('base64')}"/></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } });
}
