import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BulkStatusDialog } from './BulkStatusDialog';
import { BulkAssignDialog } from './BulkAssignDialog';
import { BulkExecutionDialog } from './BulkExecutionDialog';

vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div data-dialog-root>{children}</div> : null),
  Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Overlay: () => <div data-dialog-overlay />,
  Content: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-dialog-content className={className}>{children}</div>,
  Header: ({ children, className }: { children: React.ReactNode; className?: string }) => <header className={className}>{children}</header>,
  Footer: ({ children, className }: { children: React.ReactNode; className?: string }) => <footer className={className}>{children}</footer>,
  Title: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
  Description: ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={className}>{children}</p>,
  Close: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@radix-ui/react-select', () => ({
  Root: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Trigger: ({ children, className }: { children: React.ReactNode; className?: string }) => <button className={className}>{children}</button>,
  Value: ({ placeholder }: { placeholder?: string }) => <span>{placeholder || 'Selected'}</span>,
  Icon: () => null,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Viewport: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Item: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  ItemText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  ItemIndicator: () => null,
  ScrollUpButton: () => null,
  ScrollDownButton: () => null,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Label: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: () => null,
}));

describe('Bulk Dialogs revamp verification', () => {
  it('renders BulkStatusDialog with unified header, badge count, and without legacy classes', () => {
    const html = renderToStaticMarkup(
      <BulkStatusDialog
        open={true}
        selectedCount={5}
        bulkStatus="DONE"
        onOpenChange={vi.fn()}
        setBulkStatus={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain('Update Status Massal');
    expect(html).toContain('5 item');
    expect(html).toContain('Terapkan (5)');
    expect(html).not.toContain('elevation-3');
    expect(html).not.toContain('variant="majestic"');
  });

  it('renders BulkAssignDialog with unified styling and count badge', () => {
    const html = renderToStaticMarkup(
      <BulkAssignDialog
        open={true}
        selectedCount={3}
        testRuns={[{ id: 'run-1', name: 'Sprint 10 Regression', status: 'ACTIVE' }]}
        testRunId="run-1"
        assignee="Sammy QA"
        onOpenChange={vi.fn()}
        onTestRunChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain('Tugaskan Massal');
    expect(html).toContain('3 item');
    expect(html).toContain('Tugaskan (3)');
    expect(html).toContain('Target Test Run');
    expect(html).toContain('Nama Tester / Assignee');
  });

  it('renders BulkExecutionDialog with status choices and count badge', () => {
    const html = renderToStaticMarkup(
      <BulkExecutionDialog
        open={true}
        selectedCount={7}
        testRuns={[{ id: 'run-1', name: 'Sprint 10 Regression', status: 'ACTIVE' }]}
        testRunId="run-1"
        status="PASSED"
        tester="Alex"
        onOpenChange={vi.fn()}
        onTestRunChange={vi.fn()}
        onStatusChange={vi.fn()}
        onTesterChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(html).toContain('Eksekusi Massal');
    expect(html).toContain('7 item');
    expect(html).toContain('Eksekusi (7)');
    expect(html).toContain('Status Hasil Eksekusi');
  });
});
