import { type UseFormReturn, useWatch } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { EventFormValues } from './event-form';

type Form = UseFormReturn<EventFormValues>;

/** One group of event fields (a wizard step, or a section of settings). */
export function EventFields({ form, step }: { form: Form; step: number }) {
  const { register, formState, control } = form;
  const paymentMode = useWatch({ control, name: 'paymentMode' });
  const e = formState.errors;
  const num = { valueAsNumber: true } as const;

  if (step === 0) {
    return (
      <div className="grid gap-4">
        <FormField label="Event name" error={e.name?.message} {...register('name')} />
        <FormField
          label="Hosted by"
          hint="Your club or organisation"
          error={e.hostedBy?.message}
          {...register('hostedBy')}
        />
        <FormField label="Venue" error={e.venue?.message} {...register('venue')} />
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Starts (IST)"
          type="datetime-local"
          error={e.startAt?.message}
          {...register('startAt')}
        />
        <FormField
          label="Ends (IST)"
          type="datetime-local"
          error={e.endAt?.message}
          {...register('endAt')}
        />
        <FormField
          label="Registration opens (IST)"
          type="datetime-local"
          error={e.registrationStart?.message}
          {...register('registrationStart')}
        />
        <FormField
          label="Registration deadline (IST)"
          type="datetime-local"
          error={e.registrationDeadline?.message}
          {...register('registrationDeadline')}
        />
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          label="Capacity (people)"
          type="number"
          min={1}
          hint="Only confirmed people count"
          error={e.maxParticipants?.message}
          {...register('maxParticipants', num)}
        />
        <FormField
          label="Smallest team"
          type="number"
          min={1}
          error={e.minTeamSize?.message}
          {...register('minTeamSize', num)}
        />
        <FormField
          label="Largest team"
          type="number"
          min={1}
          error={e.maxTeamSize?.message}
          {...register('maxTeamSize', num)}
        />
      </div>
    );
  }
  const paid = paymentMode !== 'none';
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="paymentMode">Participant payment</Label>
        <Select id="paymentMode" {...register('paymentMode')}>
          <option value="none">No payment</option>
          <option value="at_registration">Pay at registration</option>
          <option value="after_shortlist">Pay after shortlist</option>
        </Select>
      </div>
      {paid && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="Fee"
            type="number"
            min={0}
            step="0.01"
            error={e.feeRupees?.message}
            {...register('feeRupees', num)}
          />
          <FormField label="Currency" error={e.currency?.message} {...register('currency')} />
          <p className="self-end pb-2 text-sm text-muted-foreground">Per person</p>
        </div>
      )}
      {paymentMode === 'after_shortlist' && (
        <FormField
          label="Payment deadline (IST)"
          type="datetime-local"
          error={e.paymentDeadline?.message}
          {...register('paymentDeadline')}
        />
      )}
      {paid && (
        <p className="text-sm text-muted-foreground">
          Upload your UPI QR code in Settings after creating the event. Teams pay to it and upload a
          receipt; you approve each one.
        </p>
      )}
    </div>
  );
}
