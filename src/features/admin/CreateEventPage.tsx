import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatIST, fromISTInput } from '@/lib/datetime';
import { formatMoney, rupeesToPaise } from '@/lib/money';
import { EventFields } from './EventFields';
import {
  emptyEventForm,
  eventFormSchema,
  type EventFormValues,
  STEPS,
  toEventPayload,
} from './event-form';

/** Event setup wizard: four steps, then a review. */
export function CreateEventPage() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: emptyEventForm,
    mode: 'onTouched',
  });

  const create = useMutation({
    mutationFn: (v: EventFormValues) => unwrap(api.POST('/v1/events', { body: toEventPayload(v) })),
    onSuccess: async ({ event }) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate(`/events/${event.id}/settings?new=1`);
    },
  });

  const reviewing = step === STEPS.length;
  const next = async () => {
    const fields = STEPS[step]!.fields;
    if (await form.trigger(fields)) setStep(step + 1);
  };
  const v = useWatch({ control: form.control }) as EventFormValues;

  return (
    <section className="mx-auto grid max-w-2xl gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Create an event</h1>
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {[...STEPS.map((s) => s.title), 'Review'].map((title, i) => (
          <li
            key={title}
            aria-current={i === step ? 'step' : undefined}
            className={i === step ? 'font-semibold' : 'text-muted-foreground'}
          >
            {i + 1}. {title}
          </li>
        ))}
      </ol>
      <Card>
        <CardHeader>
          <CardTitle>{reviewing ? 'Review' : STEPS[step]!.title}</CardTitle>
          {reviewing && (
            <CardDescription>You can change all of this later in Settings.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          {reviewing ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
              <dt className="text-muted-foreground">Event</dt>
              <dd>
                {v.name} · {v.hostedBy}
              </dd>
              <dt className="text-muted-foreground">Venue</dt>
              <dd>{v.venue}</dd>
              <dt className="text-muted-foreground">When</dt>
              <dd>
                {formatIST(toEventPayload(v).startAt)} – {formatIST(toEventPayload(v).endAt)}
              </dd>
              <dt className="text-muted-foreground">Registration</dt>
              <dd>
                {formatIST(toEventPayload(v).registrationStart)} –{' '}
                {formatIST(toEventPayload(v).registrationDeadline)}
              </dd>
              <dt className="text-muted-foreground">Capacity</dt>
              <dd>
                {v.maxParticipants} people, teams of {v.minTeamSize}–{v.maxTeamSize}
              </dd>
              <dt className="text-muted-foreground">Payment</dt>
              <dd>
                {v.paymentMode === 'none'
                  ? 'None'
                  : `${formatMoney(rupeesToPaise(v.feeRupees ?? 0), v.currency)} per person, ${
                      v.paymentMode === 'at_registration'
                        ? 'at registration'
                        : `after shortlist, by ${formatIST(fromISTInput(v.paymentDeadline))}`
                    }`}
              </dd>
            </dl>
          ) : (
            <EventFields form={form} step={step} />
          )}
          <ErrorAlert error={create.error} />
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
            {reviewing ? (
              <Button
                type="button"
                disabled={create.isPending}
                onClick={form.handleSubmit((values) => create.mutate(values))}
              >
                {create.isPending ? 'Creating…' : 'Create event'}
              </Button>
            ) : (
              <Button type="button" onClick={next}>
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
