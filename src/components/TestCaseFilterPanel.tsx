'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';

/** One set of controlled filters, with a scrollable sheet on small screens. */
export function TestCaseFilterPanel({ children, mobileDateFilter, activeCount, canReset, onReset }: {
  children: ReactNode;
  mobileDateFilter: ReactNode;
  activeCount: number;
  canReset: boolean;
  onReset: () => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = <Button type="button" variant="outline" className="h-11 w-full gap-2 sm:h-10">
    <SlidersHorizontal data-icon="inline-start" /> Filter
    {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
  </Button>;

  if (isMobile) return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md [&_[data-slot=button]]:min-h-11 [&>button]:size-11 [&>button]:top-2 [&>button]:right-2 [&>button]:flex [&>button]:items-center [&>button]:justify-center" data-lenis-prevent>
        <SheetHeader className="shrink-0 border-b border-border pr-16">
          <SheetTitle>Filter testcase</SheetTitle>
          <SheetDescription>Filter langsung memperbarui daftar. Tutup panel untuk melihat hasilnya.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
          {children}
          <div className="border-t border-border pt-4">{mobileDateFilter}</div>
          <p className="text-sm leading-6 text-muted-foreground">Status inventory terpisah dari hasil Test Run. Retest Bug diselesaikan dengan Done / As Expected pada testcase terkait.</p>
        </div>
        <SheetFooter className="shrink-0 flex-row border-t border-border">
          <Button type="button" variant="outline" className="h-11" onClick={onReset} disabled={!canReset}>Reset filter</Button>
          <SheetClose asChild><Button type="button" className="h-11 flex-1">Lihat hasil</Button></SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="max-h-[min(600px,80dvh)] w-[min(680px,calc(100vw-2rem))] overflow-y-auto p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="text-sm font-semibold">Filter testcase</h2><p className="mt-1 text-sm text-muted-foreground">Persempit daftar berdasarkan atribut QA.</p></div>
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={!canReset}>Reset</Button>
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}
