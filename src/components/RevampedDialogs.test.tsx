import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIGenerateDialog } from './AIGenerateDialog';
import { AIRefineDialog } from './AIRefineDialog';
import { ImportExcelDialog } from './ImportExcelDialog';

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

vi.mock('@/components/BasketballUploadDropzone', () => ({
  BasketballUploadDropzone: () => <div data-testid="basketball-dropzone" />,
}));

describe('Revamped AI and Import Dialogs', () => {
  it('renders AIGenerateDialog without rainbow gradients and without typo Rese', () => {
    const html = renderToStaticMarkup(
      <AIGenerateDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="proj-1"
        modules={[{ id: 'mod-1', name: 'Auth', projectId: 'proj-1' }]}
        aiGenerating={false}
        aiGeneratedCases={[]}
        aiSelectedCases={new Set()}
        aiSaving={false}
        handleAIGenerate={vi.fn()}
        handleAISaveSelected={vi.fn()}
        toggleAISelectAll={vi.fn()}
        toggleAISelect={vi.fn()}
        resetGeneratedCases={vi.fn()}
        getTestTypeColor={() => ''}
        getPriorityColor={() => ''}
      />
    );

    expect(html).toContain('AI Test Case Generator');
    expect(html).not.toContain('via-indigo-600 to-cyan-600');
    expect(html).not.toContain('from-emerald-600 to-teal-600');
    expect(html).not.toContain('> Rese<');
  });

  it('renders AIRefineDialog without rainbow gradients and with correct button text', () => {
    const mockCase = {
      id: 'tc-1',
      testCaseId: 'TC-001',
      page: 'Login',
      subMenu: null,
      testType: 'Positive',
      testAction: 'Submit valid form',
      steps: '1. Enter email\n2. Click submit',
      expectedResult: 'Logged in successfully',
      status: 'DONE',
      progress: 100,
      priority: 'High',
    };

    const html = renderToStaticMarkup(
      <AIRefineDialog
        open={true}
        onOpenChange={vi.fn()}
        testCase={mockCase as any}
        refinedCase={null}
        refining={false}
        saving={false}
        onRefine={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        getPriorityColor={() => ''}
        getTestTypeColor={() => ''}
      />
    );

    expect(html).toContain('AI Testcase Refiner');
    expect(html).not.toContain('via-indigo-600 to-cyan-600');
    expect(html).not.toContain('from-emerald-600 to-teal-600');
    expect(html).not.toContain('Apply Refinemen<');
  });

  it('renders ImportExcelDialog with primary button and no rainbow gradient', () => {
    const html = renderToStaticMarkup(
      <ImportExcelDialog
        open={true}
        onOpenChange={vi.fn()}
        createModules={true}
        onCreateModulesChange={vi.fn()}
        importing={false}
        previewing={false}
        selectedFileName=""
        importPreview={null}
        fileInputRef={{ current: null }}
        onChooseFile={vi.fn()}
        onConfirmImport={vi.fn()}
        onClearPreview={vi.fn()}
      />
    );

    expect(html).toContain('Import Excel');
    expect(html).not.toContain('via-indigo-600 to-cyan-600');
  });
});
