import { ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * A filter button that sits right of a list's search box and opens the choices.
 * While something other than `fallback` is picked, the button says what.
 */
export function FilterMenu({
  value,
  onChange,
  options,
  fallback,
  label = 'Show',
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [value: string, label: string])[];
  /** The unfiltered choice ("All teams"); picking it clears the filter. */
  fallback: string;
  /** What the choices are, read out with the current one. */
  label?: string;
}) {
  const current = options.find(([v]) => v === value)?.[1] ?? '';
  const active = value !== fallback;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'outline'}
          className={cn('min-w-0 shrink-0', active && 'max-w-[55%] sm:max-w-64')}
          aria-label={`${label}: ${current}`}
        >
          <ListFilter aria-hidden />
          <span className={cn('truncate', !active && 'hidden sm:inline')}>
            {active ? current : 'Filter'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map(([v, text]) => (
            <DropdownMenuRadioItem key={v} value={v}>
              {text}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
