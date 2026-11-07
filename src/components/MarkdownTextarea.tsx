import { Bold, Italic, Link, List, ListOrdered } from 'lucide-react';
import { type ComponentProps, type Ref, useRef, useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Edit = (text: string, start: number, end: number) => [string, number, number];

/** Wraps the selection, e.g. in `**`; with nothing selected, inserts `placeholder` wrapped. */
const wrap =
  (mark: string, placeholder: string): Edit =>
  (text, start, end) => {
    const inner = text.slice(start, end) || placeholder;
    const next = text.slice(0, start) + mark + inner + mark + text.slice(end);
    return [next, start + mark.length, start + mark.length + inner.length];
  };

/** `[selection](https://)`, with the URL selected to type over. */
const link: Edit = (text, start, end) => {
  const label = text.slice(start, end) || 'link text';
  const next = `${text.slice(0, start)}[${label}](https://)${text.slice(end)}`;
  const url = start + label.length + 3;
  return [next, url, url + 'https://'.length];
};

/** Prefixes every selected line with `- `, or `1. `, `2. `… when `numbered`. */
const lines =
  (numbered: boolean): Edit =>
  (text, start, end) => {
    const from = text.lastIndexOf('\n', start - 1) + 1;
    const prefixed = text
      .slice(from, end)
      .split('\n')
      .map((l, i) => `${numbered ? `${i + 1}.` : '-'} ${l}`)
      .join('\n');
    return [text.slice(0, from) + prefixed + text.slice(end), from, from + prefixed.length];
  };

const TOOLS: { label: string; icon: typeof Bold; edit: Edit }[] = [
  { label: 'Bold', icon: Bold, edit: wrap('**', 'bold text') },
  { label: 'Italic', icon: Italic, edit: wrap('_', 'italic text') },
  { label: 'Link', icon: Link, edit: link },
  { label: 'Bulleted list', icon: List, edit: lines(false) },
  { label: 'Numbered list', icon: ListOrdered, edit: lines(true) },
];

/**
 * A textarea for Markdown, with formatting buttons and a preview tab. Works
 * controlled (`value`) or with react-hook-form's `register` (pass the watched
 * value as `preview`). The textarea stays mounted while previewing.
 */
export function MarkdownTextarea({
  preview,
  ref,
  ...props
}: ComponentProps<typeof Textarea> & { preview?: string }) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const [tab, setTab] = useState('write');
  const text = preview ?? String(props.value ?? '');

  const setRef = (el: HTMLTextAreaElement | null) => {
    own.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = el;
  };

  const apply = (edit: Edit) => {
    const el = own.current;
    if (!el) return;
    const [next, selStart, selEnd] = edit(el.value, el.selectionStart, el.selectionEnd);
    // Through the native setter so React and react-hook-form both see an input event.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
    el.setSelectionRange(selStart, selEnd);
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        {tab === 'write' && (
          <div className="ml-auto flex items-center gap-0.5">
            {TOOLS.map(({ label, icon: Icon, edit }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={label}
                    disabled={props.disabled}
                    // Keep the textarea's selection and focus.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => apply(edit)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
      <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
        <Textarea {...props} ref={setRef as Ref<HTMLTextAreaElement>} />
      </TabsContent>
      <TabsContent value="preview" className="min-h-16 rounded-lg border px-2.5 py-2">
        {text.trim() ? (
          <Markdown>{text}</Markdown>
        ) : (
          <span className="text-muted-foreground">Nothing to preview.</span>
        )}
      </TabsContent>
      <p className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>Supports Markdown: **bold**, _italic_, [link](https://…), - lists.</span>
        {props.maxLength !== undefined && (
          <span className="shrink-0 tabular-nums">
            {text.length}/{props.maxLength}
          </span>
        )}
      </p>
    </Tabs>
  );
}
