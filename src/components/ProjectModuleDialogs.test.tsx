import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectModuleDialogs } from './ProjectModuleDialogs';

vi.mock('@radix-ui/react-dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@radix-ui/react-dialog')>();
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('ProjectModuleDialogs', () => {
  it('renders Create Project dialog with clean typography, presets, and no typo', () => {
    const html = renderToStaticMarkup(
      <ProjectModuleDialogs
        showCreateProject={true}
        showCreateModule={false}
        newProjectName=""
        newProjectDesc=""
        newModuleName=""
        setShowCreateProject={() => {}}
        setShowCreateModule={() => {}}
        setNewProjectName={() => {}}
        setNewProjectDesc={() => {}}
        setNewModuleName={() => {}}
        onCreateProject={() => {}}
        onCreateModule={() => {}}
      />
    );

    // Title and description
    expect(html).toContain('Buat Project Baru');
    expect(html).toContain('Ruang kerja terstruktur');

    // Correct spelling: Buat Project (not Buat Projec!)
    expect(html).toContain('Buat Project');
    expect(html).not.toContain('Buat Projec<');

    // Presets
    expect(html).toContain('Web App');
    expect(html).toContain('Mobile App');
    expect(html).toContain('API / Backend');

    // Form inputs and attributes
    expect(html).toContain('Nama Project');
    expect(html).toContain('Deskripsi Project');
    expect(html).toContain('placeholder="contoh: Sarinah E-Commerce atau Welma API"');
    expect(html).toContain('0/60');
    expect(html).toContain('0/300');

    // Anti-slop checks: no 3-color rainbow gradients
    expect(html).not.toContain('via-indigo-500 to-cyan-500');
    expect(html).not.toContain('bg-clip-text text-transparent');
  });

  it('renders Create Module dialog with quick module suggestions', () => {
    const html = renderToStaticMarkup(
      <ProjectModuleDialogs
        showCreateProject={false}
        showCreateModule={true}
        newProjectName=""
        newProjectDesc=""
        newModuleName="Auth &amp; Profil"
        setShowCreateProject={() => {}}
        setShowCreateModule={() => {}}
        setNewProjectName={() => {}}
        setNewProjectDesc={() => {}}
        setNewModuleName={() => {}}
        onCreateProject={() => {}}
        onCreateModule={() => {}}
      />
    );

    // Title and description
    expect(html).toContain('Buat Module Baru');
    expect(html).toContain('Kelompokkan test case berdasarkan fitur');

    // Quick suggestions
    expect(html).toContain('Autentikasi &amp; Akun');
    expect(html).toContain('Dashboard &amp; Analitik');
    expect(html).toContain('Transaksi &amp; Pembayaran');

    // Correct button label
    expect(html).toContain('Buat Module');
    expect(html).toContain('Batal');
  });

  it('does not render dialog contents when both open flags are false', () => {
    const html = renderToStaticMarkup(
      <ProjectModuleDialogs
        showCreateProject={false}
        showCreateModule={false}
        newProjectName=""
        newProjectDesc=""
        newModuleName=""
        setShowCreateProject={() => {}}
        setShowCreateModule={() => {}}
        setNewProjectName={() => {}}
        setNewProjectDesc={() => {}}
        setNewModuleName={() => {}}
        onCreateProject={() => {}}
        onCreateModule={() => {}}
      />
    );

    expect(html).not.toContain('Buat Project Baru');
    expect(html).not.toContain('Buat Module Baru');
  });
});
