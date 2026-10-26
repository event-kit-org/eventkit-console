import { ChevronDown, ChevronUp, Copy, EllipsisVertical, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Field, TeamRule } from '@/features/fields/fields';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<Field['type'], string> = {
  short_text: 'Short answer',
  long_text: 'Paragraph',
  number: 'Number',
  choice: 'Dropdown',
};

/** What a question card edits. A saved field, or a draft not created yet. */
export type Question = Pick<
  Field,
  'scope' | 'label' | 'help' | 'type' | 'options' | 'required' | 'unique' | 'pattern'
>;
export type QuestionPatch = Partial<Omit<Question, 'scope' | 'type'>>;
/** Minimum members per team, keyed by dropdown option. */
export type MinCounts = Record<string, number>;

/** What a text question's answer line says, as in Google Forms. */
const ANSWER_HINT: Record<Exclude<Field['type'], 'choice'>, string> = {
  short_text: 'Short answer text',
  long_text: 'Long answer text',
  number: 'Number',
};

const isText = (type: Field['type']) => type === 'short_text' || type === 'long_text';

/** A question as the person filling in the form will see it. Click to edit. */
export function QuestionPreview({
  question,
  rules,
  onEdit,
}: {
  question: Question;
  rules: TeamRule[];
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Edit ${question.label}`}
      onClick={onEdit}
      className="grid w-full gap-2 rounded-lg border bg-card p-4 text-left text-sm transition-colors hover:bg-muted/40"
    >
      <div className="font-medium">
        {question.label}
        {question.required && <span className="text-destructive"> *</span>}
      </div>
      {question.help && <div className="text-xs text-muted-foreground">{question.help}</div>}
      {question.type === 'choice' ? (
        <ol className="grid gap-1 text-muted-foreground">
          {question.options.map((o, i) => {
            const rule = rules.find((r) => r.value === o);
            return (
              <li key={o}>
                {i + 1}. {o}
                {rule && <span className="text-xs"> · at least {rule.minCount} per team</span>}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="w-1/2 border-b border-dashed pb-1 text-muted-foreground">
          {ANSWER_HINT[question.type]}
        </div>
      )}
      {(question.unique || question.pattern) && (
        <div className="text-xs text-muted-foreground">
          {[question.unique && 'Unique answers', question.pattern && `Format: ${question.pattern}`]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
    </button>
  );
}

/**
 * The open question card. Saved questions commit each change as it happens
 * (text on blur); a draft keeps changes locally until it is added.
 */
export function QuestionEditor({
  question,
  minCounts,
  saved,
  error,
  onChange,
  onTypeChange,
  onMinCount,
  footer,
}: {
  question: Question;
  minCounts: MinCounts;
  saved: boolean;
  error?: unknown;
  onChange: (patch: QuestionPatch) => void;
  /** Drafts only: a saved question's type is fixed. */
  onTypeChange?: (type: Field['type']) => void;
  onMinCount: (option: string, min: number | null) => void;
  footer: React.ReactNode;
}) {
  const [showHelp, setShowHelp] = useState(Boolean(question.help));
  const [showPattern, setShowPattern] = useState(Boolean(question.pattern));
  const text = isText(question.type);

  return (
    <div className="grid gap-4 rounded-lg border border-l-4 border-l-primary bg-card p-4 text-sm shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row">
        <TextCommit
          aria-label="Question"
          placeholder="Question"
          className="h-11 flex-1 bg-muted/40 text-base"
          value={question.label}
          live={!saved}
          autoFocus={!saved}
          onCommit={(label) => label && onChange({ label })}
        />
        <Select
          aria-label="Question type"
          className="h-11 sm:w-44"
          value={question.type}
          disabled={saved}
          title={saved ? "A saved question's type can't change. Duplicate it instead." : undefined}
          onChange={(e) => onTypeChange?.(e.target.value as Field['type'])}
        >
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {showHelp && (
        <TextCommit
          aria-label="Description"
          placeholder="Description"
          value={question.help ?? ''}
          live={!saved}
          onCommit={(help) => onChange({ help: help || null })}
        />
      )}

      {question.type === 'choice' ? (
        <Options
          options={question.options}
          withMinCounts={question.scope === 'member'}
          minCounts={minCounts}
          onChange={(options) => onChange({ options })}
          onMinCount={onMinCount}
        />
      ) : (
        <div className="w-1/2 border-b border-dashed pb-1 text-muted-foreground">
          {ANSWER_HINT[question.type]}
        </div>
      )}

      {text && showPattern && (
        <TextCommit
          aria-label="Answer format"
          placeholder="Regular expression, e.g. PES[12]UG\d{2}[A-Z]{2}\d{3}"
          className="font-mono"
          value={question.pattern ?? ''}
          live={!saved}
          onCommit={(pattern) => onChange({ pattern: pattern || null })}
        />
      )}

      <ErrorAlert error={error} />

      <div className="flex flex-wrap items-center justify-end gap-1 border-t pt-3">
        {footer}
        <span className="mx-2 h-6 w-px bg-border" aria-hidden />
        <Switch
          label="Required"
          checked={question.required}
          onChange={(required) => onChange({ required })}
        />
        <MoreMenu
          items={[
            {
              label: 'Description',
              checked: showHelp,
              toggle: () => {
                if (showHelp && question.help) onChange({ help: null });
                setShowHelp(!showHelp);
              },
            },
            {
              label: 'Unique answers',
              checked: question.unique,
              toggle: () => onChange({ unique: !question.unique }),
            },
            ...(text
              ? [
                  {
                    label: 'Answer format',
                    checked: showPattern,
                    toggle: () => {
                      if (showPattern && question.pattern) onChange({ pattern: null });
                      setShowPattern(!showPattern);
                    },
                  },
                ]
              : []),
          ]}
        />
      </div>
    </div>
  );
}

function Options({
  options,
  withMinCounts,
  minCounts,
  onChange,
  onMinCount,
}: {
  options: string[];
  withMinCounts: boolean;
  minCounts: MinCounts;
  onChange: (options: string[]) => void;
  onMinCount: (option: string, min: number | null) => void;
}) {
  const rename = (i: number, value: string) => {
    if (!value || value === options[i] || options.includes(value)) return;
    onChange(options.map((o, j) => (j === i ? value : o)));
  };
  return (
    <div className="grid gap-2">
      {withMinCounts && options.length > 0 && (
        <div className="flex justify-end pr-10 text-xs text-muted-foreground">Min per team</div>
      )}
      <ol className="grid gap-2">
        {options.map((o, i) => (
          <li key={`${i}:${o}`} className="flex items-center gap-2">
            <span className="w-5 text-right text-muted-foreground">{i + 1}.</span>
            <TextCommit
              aria-label={`Option ${i + 1}`}
              className="flex-1"
              value={o}
              onCommit={(value) => rename(i, value)}
            />
            {withMinCounts && (
              <TextCommit
                aria-label={`Minimum members per team choosing ${o}`}
                type="number"
                min={0}
                placeholder="–"
                className="w-20"
                value={minCounts[o] ? String(minCounts[o]) : ''}
                onCommit={(v) => {
                  const n = Number(v);
                  const next = v && n > 0 ? n : null;
                  if (next !== (minCounts[o] ?? null)) onMinCount(o, next);
                }}
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remove ${o}`}
              disabled={options.length === 1}
              onClick={() => onChange(options.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2">
        <Plus className="size-4 w-5 text-muted-foreground" aria-hidden />
        <TextCommit
          aria-label="Add option"
          placeholder="Add option"
          className="flex-1 border-dashed"
          value=""
          clearOnCommit
          onCommit={(value) => value && !options.includes(value) && onChange([...options, value])}
        />
      </div>
    </div>
  );
}

/**
 * A text input that reports its trimmed value on blur or Enter (or on every
 * keystroke when `live`), once per change. It resets when `value` changes.
 */
function TextCommit({
  value,
  onCommit,
  live = false,
  clearOnCommit = false,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (value: string) => void;
  live?: boolean;
  /** For "add" inputs: empty the box after each commit. */
  clearOnCommit?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  // What was last reported, so Enter followed by blur doesn't report twice.
  const [committed, setCommitted] = useState(value);
  // Reset to the saved value whenever it changes (adjusting state during render).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
    setCommitted(value);
  }
  const commit = () => {
    const next = draft.trim();
    if (clearOnCommit) {
      if (next) onCommit(next);
      setDraft('');
    } else if (next !== committed) {
      setCommitted(next);
      onCommit(next);
    }
  };
  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (live) onCommit(e.target.value.trim());
      }}
      onBlur={() => !live && commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (!live) commit();
        }
      }}
    />
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 px-2">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-background transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </label>
  );
}

function MoreMenu({ items }: { items: { label: string; checked: boolean; toggle: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <EllipsisVertical className="size-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-10 mb-1 grid min-w-48 rounded-md border bg-card p-1 shadow-md"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.checked}
              className="flex items-center gap-2 rounded px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                item.toggle();
                setOpen(false);
              }}
            >
              <span className="w-4">{item.checked ? '✓' : ''}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Move / duplicate / delete buttons for a saved question's footer. */
export function SavedActions({
  label,
  canMoveUp,
  canMoveDown,
  onMove,
  onDuplicate,
  onDelete,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const icon = (name: string, Icon: typeof Copy, onClick: () => void, disabled = false) => (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={`${name} ${label}`}
      title={name}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
  return (
    <>
      {icon('Move up', ChevronUp, () => onMove(-1), !canMoveUp)}
      {icon('Move down', ChevronDown, () => onMove(1), !canMoveDown)}
      {icon('Duplicate', Copy, onDuplicate)}
      {icon('Delete', Trash2, onDelete)}
    </>
  );
}
