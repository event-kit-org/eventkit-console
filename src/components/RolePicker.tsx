import type { Schemas } from '@/api/client';
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
  return (
    <fieldset className="grid gap-1">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {ROLES.map((r) => (
          <label key={r} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={value.includes(r)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))
              }
            />
            {roleLabel[r]}s
          </label>
        ))}
      </div>
    </fieldset>
  );
}
