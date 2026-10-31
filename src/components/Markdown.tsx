import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** A tag with fixed classes, dropping react-markdown's `node` prop. */
function styled<T extends keyof React.JSX.IntrinsicElements>(Tag: T, className: string) {
  return (props: React.ComponentProps<T> & { node?: unknown }) => {
    const rest: Record<string, unknown> = { ...props };
    delete rest.node;
    const Element = Tag as React.ElementType;
    return <Element {...rest} className={className} />;
  };
}

const components: Components = {
  a: ({ children, href, title }) => (
    <a href={href} title={title} target="_blank" rel="noreferrer" className="font-medium underline">
      {children}
    </a>
  ),
  h1: styled('h3', 'text-base font-semibold'),
  h2: styled('h3', 'text-base font-semibold'),
  h3: styled('h4', 'font-semibold'),
  h4: styled('h4', 'font-semibold'),
  ul: styled('ul', 'list-disc pl-5'),
  ol: styled('ol', 'list-decimal pl-5'),
  blockquote: styled('blockquote', 'border-l-2 pl-3 italic'),
  code: styled('code', 'rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]'),
  pre: styled('pre', 'overflow-x-auto rounded bg-muted p-2 [&_code]:bg-transparent'),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="text-left [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2">
        {children}
      </table>
    </div>
  ),
  hr: () => <hr className="border-border" />,
};

/** Links shown as text: for Markdown inside something clickable, like a button. */
const inertComponents: Components = {
  ...components,
  a: ({ children }) => <span className="underline">{children}</span>,
};

/**
 * Organiser-written Markdown (payment instructions, question and submission
 * descriptions). Single line breaks are kept, so plain text reads as before.
 * Raw HTML is not rendered.
 */
export function Markdown({
  children,
  className,
  inert = false,
  id,
}: {
  children: string;
  className?: string;
  inert?: boolean;
  id?: string;
}) {
  return (
    <div id={id} className={cn('grid gap-2 break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={inert ? inertComponents : components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
