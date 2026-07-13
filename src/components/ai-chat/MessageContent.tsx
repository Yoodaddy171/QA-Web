'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

const TESTCASE_ID_PATTERN = /\b[A-Z]{1,4}-\d{2,4}\b/g;

function isMarkdownTable(lines: string[], index: number) {
  const header = lines[index]?.trim();
  const separator = lines[index + 1]?.trim();
  return Boolean(
    header?.startsWith('|')
    && header.endsWith('|')
    && separator?.startsWith('|')
    && separator.endsWith('|')
    && /^\|[\s:-]+\|[\s|:-]*$/.test(separator)
  );
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function linkifyTestCaseIds(value: string) {
  return value.replace(TESTCASE_ID_PATTERN, match => `[${match}](tc:${match})`);
}

function LinkedText({
  value,
  compact,
  onOpenTestCaseId,
}: {
  value: string;
  compact?: boolean;
  onOpenTestCaseId?: (testCaseId: string) => void;
}) {
  const parts = value.split(TESTCASE_ID_PATTERN);
  const matches = value.match(TESTCASE_ID_PATTERN) || [];

  return (
    <>
      {parts.map((part, index) => (
        <React.Fragment key={`${part}-${index}`}>
          {part}
          {matches[index] && (
            <button
              type="button"
              onClick={() => onOpenTestCaseId?.(matches[index])}
              className={`font-semibold underline underline-offset-2 ${compact ? 'text-cyan-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
            >
              {matches[index]}
            </button>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

export function MessageContent({
  content,
  compact = false,
  onOpenTestCaseId,
}: {
  content: string;
  compact?: boolean;
  onOpenTestCaseId?: (testCaseId: string) => void;
}) {
  const blocks: Array<{ type: 'markdown'; value: string } | { type: 'table'; rows: string[][] }> = [];
  const lines = content.split('\n');
  let buffer: string[] = [];

  const flushMarkdown = () => {
    const value = buffer.join('\n').trim();
    if (value) blocks.push({ type: 'markdown', value });
    buffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (!isMarkdownTable(lines, index)) {
      buffer.push(lines[index]);
      continue;
    }

    flushMarkdown();
    const tableLines = [lines[index]];
    index += 2;
    while (index < lines.length && lines[index].trim().startsWith('|') && lines[index].trim().endsWith('|')) {
      tableLines.push(lines[index]);
      index += 1;
    }
    index -= 1;
    blocks.push({ type: 'table', rows: tableLines.map(splitTableRow) });
  }
  flushMarkdown();

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          const [header, ...rows] = block.rows;
          return (
            <div key={`table-${index}`} className="my-3 overflow-x-auto rounded-xl border border-border/50 bg-secondary/30">
              <table className="min-w-full table-auto border-collapse text-left text-[11px]">
                <thead className="bg-secondary/50 font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>{header.map((cell, cellIndex) => <th key={`${cell}-${cellIndex}`} className="min-w-[90px] border-b border-border/50 px-3 py-2.5 font-semibold leading-snug">{cell}</th>)}</tr>
                </thead>
                <tbody className="text-foreground/80">
                  {rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="border-t border-border/30 transition-colors hover:bg-secondary/30">
                      {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="max-w-[220px] align-top px-3 py-2.5 leading-relaxed"><LinkedText value={cell} compact={compact} onOpenTestCaseId={onOpenTestCaseId} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <ReactMarkdown
            key={`markdown-${index}`}
            components={{
              p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 marker:text-primary/50 last:mb-0">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 marker:text-primary/50 last:mb-0">{children}</ol>,
              li: ({ children }) => <li className="pl-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              code: ({ children }) => <code className="rounded-lg border border-border/40 bg-secondary/50 px-1.5 py-0.5 font-mono text-xs font-medium text-primary">{children}</code>,
              a: ({ href, children }) => {
                const target = typeof href === 'string' && href.startsWith('tc:') ? decodeURIComponent(href.slice(3)) : null;
                return target
                  ? <button type="button" onClick={() => onOpenTestCaseId?.(target)} className="font-bold text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary">{children}</button>
                  : <span className="cursor-pointer font-semibold text-primary hover:underline">{children}</span>;
              },
            }}
          >
            {linkifyTestCaseIds(block.value)}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
