'use client';

import React from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const sections = [
    {
      title: 'Navigasi Global',
      shortcuts: [
        { keys: ['Ctrl', 'K'], desc: 'Buka Command Palette & pencarian cepat' },
        { keys: ['/'], desc: 'Fokus langsung ke kolom pencarian data' },
        { keys: ['?'], desc: 'Buka panduan pintasan keyboard ini' },
        { keys: ['Esc'], desc: 'Tutup modal, drawer, atau dialog yang aktif' },
      ],
    },
    {
      title: 'Tabel Test Cases & Bugs',
      shortcuts: [
        { keys: ['J'], desc: 'Pindah fokus ke baris berikutnya (ke bawah)' },
        { keys: ['K'], desc: 'Pindah fokus ke baris sebelumnya (ke atas)' },
        { keys: ['X'], desc: 'Pilih / centang checkbox pada baris yang aktif' },
        { keys: ['Enter'], desc: 'Buka drawer detail skenario pengujian' },
        { keys: ['R'], desc: 'Segarkan (refresh) data dari server' },
      ],
    },
    {
      title: 'Drawer Detail Test Case',
      shortcuts: [
        { keys: ['['], desc: 'Pindah ke skenario test case sebelumnya' },
        { keys: [']'], desc: 'Pindah ke skenario test case berikutnya' },
        { keys: ['Esc'], desc: 'Tutup drawer detail' },
      ],
    },
    {
      title: 'Test Cycle Runner',
      shortcuts: [
        { keys: ['P'], desc: 'Tandai hasil eksekusi: Pass (Lulus)' },
        { keys: ['F'], desc: 'Tandai hasil eksekusi: Fail (Gagal)' },
        { keys: ['B'], desc: 'Tandai hasil eksekusi: Blocked (Terhalang)' },
        { keys: ['R'], desc: 'Tandai hasil eksekusi: Retest (Uji Ulang)' },
        { keys: ['Enter'], desc: 'Lanjut ke skenario berikutnya' },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0 bg-card border-border shadow-xl rounded-2xl">
        <DialogHeader className="border-b border-border/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                Pintasan Keyboard
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Akselerasi navigasi desktop tanpa perlu menyentuh mouse.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5 text-sm">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                {section.title}
              </h3>
              <div className="rounded-lg border border-border/50 bg-background/50 divide-y divide-border/40">
                {section.shortcuts.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{s.desc}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {s.keys.map((k, kIdx) => (
                        <Kbd key={kIdx} size="sm">{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-secondary/25 px-5 py-2.5 text-xs text-muted-foreground">
          <span>Tekan <Kbd size="sm">Esc</Kbd> untuk menutup</span>
          <span className="font-mono text-[11px]">Traceva Desktop v0.2.0</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
