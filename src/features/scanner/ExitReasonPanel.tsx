import type { Leaving } from '@eventkit/sdk';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const OTHER = '__other__';

/**
 * At a gate, after scanning someone who is inside: who is going out, a reason
 * to pick (or type), and the button that sends the scan. Nothing is recorded
 * until then.
 */
export function ExitReasonPanel({
  who,
  reasons,
  busy,
  onSubmit,
  onCancel,
}: {
  who: Leaving;
  reasons: string[];
  busy: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState('');
  const [typed, setTyped] = useState('');
  const reason = choice === OTHER ? typed.trim() : choice;
  return (
    <Card className="border-amber-500/60" role="region" aria-label="Going out">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-lg">
          <LogOut className="size-5" aria-hidden /> {who.name} is going out
        </CardTitle>
        <CardDescription>
          {who.teamName && `Team ${who.teamName}`}
          {who.participantCode && ` · ${who.participantCode}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason) onSubmit(reason);
          }}
        >
          <Field>
            <FieldLabel htmlFor="exit-reason">Reason</FieldLabel>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="exit-reason" className="w-full">
                <SelectValue placeholder="Why are they leaving?" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER}>Something else…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {choice === OTHER && (
            <Field>
              <FieldLabel htmlFor="exit-reason-text">Describe it</FieldLabel>
              <Textarea
                id="exit-reason-text"
                maxLength={200}
                value={typed}
                autoFocus
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={!reason || busy}>
              Mark as left
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
