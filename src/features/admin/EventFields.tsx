import { type UseFormReturn, useWatch } from 'react-hook-form';
import { FormField } from '@/components/FormField';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
          <div className="grid gap-2">
            <Label htmlFor="feeBasis">Charged</Label>
            <Select id="feeBasis" {...register('feeBasis')}>
              <option value="per_person">Per person</option>
              <option value="per_team">Once per team</option>
            </Select>
          </div>
          <FormField label="Currency" error={e.currency?.message} {...register('currency')} />
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
        <div className="grid gap-2">
          <Label htmlFor="paymentInstructions">How to pay</Label>
          <Textarea
            id="paymentInstructions"
            rows={4}
            placeholder={
              'e.g. Bank: Canara Bank, A/c 1234567890, IFSC CNRB0001234\nor UPI: club@upi'
            }
            aria-invalid={e.paymentInstructions ? true : undefined}
            aria-describedby="paymentInstructions-hint"
            {...register('paymentInstructions')}
          />
          {e.paymentInstructions ? (
            <p id="paymentInstructions-hint" className="text-sm text-destructive">
              {e.paymentInstructions.message}
            </p>
          ) : (
            <p id="paymentInstructions-hint" className="text-sm text-muted-foreground">
              Shown to teams before they upload their receipt. You can also upload an instructions
              file (image or PDF) or a UPI QR code in Settings. You approve each receipt.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
