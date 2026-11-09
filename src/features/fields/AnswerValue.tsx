import { ExternalLink } from 'lucide-react';
import type { Schemas } from '@/api/client';
import { Markdown } from '@/components/Markdown';
import { Badge } from '@/components/ui/badge';
import { formatIST } from '@/lib/datetime';

type Value = Schemas['SubmissionEntry']['answers'][string];

const URL_ONLY = /^https?:\/\/\S+$/i;

/** A link as people read it: host and path, without the scheme or a trailing slash. */
export const shortUrl = (url: string) =>
  url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

/**
 * One answer, shown by its kind, the way the participant portal shows it:
 * links open in a new tab, choices as tags, long text as paragraphs.
 */
export function AnswerValue({ type, value }: { type: string; value: Value | undefined }) {
  if (value === undefined || value === '') {
    return <span className="text-muted-foreground">Not answered</span>;
  }
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <Badge key={v} variant="secondary">
            {v}
          </Badge>
        ))}
      </span>
    );
  }
  if (type === 'datetime') return <span>{formatIST(String(value))}</span>;
  const text = String(value).trim();
  if (URL_ONLY.test(text)) {
    return (
      <a
        href={text}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-start gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
      >
        <span className="wrap-anywhere">{shortUrl(text)}</span>
        <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      </a>
    );
  }
  if (type === 'long_text') {
    return (
      <div className="grid gap-2 rounded-md bg-muted/40 p-3 leading-relaxed wrap-anywhere">
        <Markdown>{text}</Markdown>
      </div>
    );
  }
  return <span className="wrap-anywhere whitespace-pre-wrap">{text}</span>;
}
