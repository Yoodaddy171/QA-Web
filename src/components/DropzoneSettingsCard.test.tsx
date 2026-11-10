import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DropzoneSettingsCard } from './DropzoneSettingsCard';

describe('DropzoneSettingsCard', () => {
  it('renders basketball dropzone settings card and toggle switch', () => {
    const html = renderToStaticMarkup(<DropzoneSettingsCard />);
    expect(html).toContain('Fitur Basketball Dropzone');
    expect(html).toContain('Pengaturan tema interaktif');
    expect(html).toContain('Basket Aktif');
    expect(html).toContain('Animasi Lapangan Basket &amp; Tembakan File');
    expect(html).toContain('Project Knowledge');
    expect(html).toContain('Import Excel');
    expect(html).toContain('Execution Evidence');
  });
});
