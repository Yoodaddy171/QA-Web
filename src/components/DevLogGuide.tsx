'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MonitorDot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type DevLogGuideProps = {
  expandedGuide: 'automation' | 'manual' | null;
  setExpandedGuide: (value: 'automation' | 'manual' | null) => void;
};

export function DevLogGuide({ expandedGuide, setExpandedGuide }: DevLogGuideProps) {
  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <MonitorDot className="h-4 w-4 text-primary" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-cyan-400">Panduan DevLog</p>
        <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/10 text-[10px] font-bold text-primary uppercase tracking-tighter dark:bg-black/40 dark:text-cyan-300">
          Automation & Manual Capture
        </Badge>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setExpandedGuide(expandedGuide === 'automation' ? null : 'automation')}
          className="w-full flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-semibold text-foreground uppercase tracking-wider hover:bg-secondary/40 transition-colors"
        >
          <span>Automation Capture Instructions</span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-300', expandedGuide === 'automation' && 'rotate-180')} />
        </button>
        <AnimatePresence>
          {expandedGuide === 'automation' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
              <div className="border-t border-border/40 px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted-foreground font-medium bg-secondary/10">
                <ol className="ml-4 list-decimal space-y-2">
                  <li>Jalankan relay dengan <span className="font-mono text-[11px] text-primary bg-primary/10 px-1 rounded">node mini-services/ws-server.js</span>.</li>
                  <li>Salin UUID test case dari tab Informasi Utama, bukan display ID seperti E-124.</li>
                  <li>Tempel UUID ke kolom **Test Case ID** pada browser Automation Capture.</li>
                  <li>Aktifkan **Event Sync** agar log browser masuk ke aplikasi ini secara real-time.</li>
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
