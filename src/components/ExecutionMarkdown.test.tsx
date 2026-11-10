import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExecutionMarkdown } from './ExecutionMarkdown';

const render = (text: string) => renderToStaticMarkup(<ExecutionMarkdown>{text}</ExecutionMarkdown>);

describe('ExecutionMarkdown', () => {
  it('renders numbered steps, bullets, nested lists and emphasis', () => {
    const html = render('**Langkah:**\n\n1. Login\n2. Buka detail\n   - Periksa status\n\n**Hasil:** *Gagal*');
    expect(html).toContain('<ol');
    expect(html).toContain('<ul');
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain('<strong>Langkah:</strong>');
    expect(html).toContain('<em>Gagal</em>');
  });

  it('preserves plain text newlines and separates paragraphs', () => {
    const html = render('Baris pertama\nBaris kedua\n\nParagraf berikutnya');
    expect(html).toContain('whitespace-pre-wrap');
    expect(html).toContain('Baris pertama\nBaris kedua</p>');
    expect(html).toContain('>Paragraf berikutnya</p>');
  });

  it('keeps code scrollable and ordered list start numbers intact', () => {
    const html = render('3. Ulangi\n\n```json\n{"status": "failed"}\n```');
    expect(html).toContain('start="3"');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('&quot;status&quot;');
  });

  it('does not execute HTML, load remote images or allow javascript links', () => {
    const html = render('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n![tracking](https://example.com/pixel)\n\n[bad](javascript:alert%281%29)');
    expect(html).not.toMatch(/<script|<img|href="javascript:|onerror=/);
    expect(html).toContain('<span>bad</span>');
  });

  it('renders real links with safe new-tab attributes and keyboard focus styling', () => {
    const html = render('[Detail](https://example.com/detail)');
    expect(html).toContain('href="https://example.com/detail"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('focus-visible:outline-ring');
  });
});
