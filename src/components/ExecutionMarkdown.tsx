import ReactMarkdown, { type Components } from 'react-markdown';

const components: Components = {
  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children, start }) => <ol start={start} className="list-decimal space-y-1 pl-6">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  h1: ({ children }) => <p className="font-semibold">{children}</p>,
  h2: ({ children }) => <p className="font-semibold">{children}</p>,
  h3: ({ children }) => <p className="font-semibold">{children}</p>,
  h4: ({ children }) => <p className="font-semibold">{children}</p>,
  h5: ({ children }) => <p className="font-semibold">{children}</p>,
  h6: ({ children }) => <p className="font-semibold">{children}</p>,
  blockquote: ({ children }) => <blockquote className="space-y-2 rounded-md bg-muted/50 p-3">{children}</blockquote>,
  pre: ({ children }) => <pre tabIndex={0} aria-label="Blok kode" className="max-w-full overflow-x-auto rounded-md bg-muted p-3 focus-visible:outline-2 focus-visible:outline-ring [&>code]:whitespace-pre [&>code]:bg-transparent [&>code]:p-0">{children}</pre>,
  code: ({ children }) => <code className="whitespace-pre-wrap rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>,
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="cursor-pointer rounded-sm text-primary underline underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-ring">{children}</a>
    : <span>{children}</span>,
};

export function ExecutionMarkdown({ children }: { children: string }) {
  return (
    <div className="min-w-0 space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere] [&_li>p]:my-1">
      <ReactMarkdown components={components} skipHtml disallowedElements={['img']}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
