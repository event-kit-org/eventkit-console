import { useId } from 'react';
import type { Schemas } from '@/api/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { roleLabel } from '@/features/events/roles';
import { ROLES } from '@/lib/audience';

/** Checkboxes for an audience: any combination of roles (all four means everyone). */
export function RolePicker({
  value,
  onChange,
  legend = 'Who it is for',
}: {
  value: Schemas['Role'][];
  onChange: (roles: Schemas['Role'][]) => void;
  legend?: string;
}) {
  const id = useId();
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {ROLES.map((r) => (
          <Field key={r} orientation="horizontal" className="w-auto">
            <Checkbox
              id={`${id}-${r}`}
              checked={value.includes(r)}
              onCheckedChange={(checked) =>
                onChange(checked === true ? [...value, r] : value.filter((x) => x !== r))
              }
            />
            <FieldLabel htmlFor={`${id}-${r}`} className="font-normal">
              {roleLabel[r]}s
            </FieldLabel>
          </Field>
        ))}
      </div>
    </FieldSet>
  );
}
