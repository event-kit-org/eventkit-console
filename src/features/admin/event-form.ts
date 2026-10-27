import { z } from 'zod';
import type { Schemas } from '@/api/client';
import { fromISTInput, toISTInput } from '@/lib/datetime';
import { paiseToRupees, rupeesToPaise } from '@/lib/money';

/** A refinement guard: true when none of `keys` has an issue yet. */
function validFields(...keys: string[]) {
  return (payload: { issues: readonly { path?: PropertyKey[] }[] }) =>
    !payload.issues.some((i) => keys.includes(String(i.path?.[0])));
}

/** Form values: dates as IST datetime-local strings, fee in rupees. */
export const eventFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter the event name.').max(200),
    hostedBy: z.string().trim().min(1, 'Who is hosting it?').max(200),
    venue: z.string().trim().min(1, 'Enter the venue.').max(300),
    startAt: z.string().min(1, 'Pick a start time.'),
    endAt: z.string().min(1, 'Pick an end time.'),
    registrationStart: z.string().min(1, 'Pick when registration opens.'),
    registrationDeadline: z.string().min(1, 'Pick the registration deadline.'),
    maxParticipants: z.number({ error: 'Enter a number.' }).int().min(1, 'At least 1.'),
    minTeamSize: z.number({ error: 'Enter a number.' }).int().min(1, 'At least 1.'),
    maxTeamSize: z.number({ error: 'Enter a number.' }).int().min(1, 'At least 1.'),
    paymentMode: z.enum(['none', 'at_registration', 'after_shortlist']),
    // An empty number input gives NaN: treat it as "not entered".
    feeRupees: z
      .union([z.nan().transform(() => undefined), z.number().min(0, 'Cannot be negative.')])
      .optional(),
    // per_person: the fee × team members; per_team: the fee once per team.
    feeBasis: z.enum(['per_person', 'per_team']),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter code, e.g. INR.'),
    paymentInstructions: z.string().max(2000, 'At most 2000 characters.'),
    // After shortlist only: receipts are refused after this (IST datetime-local).
    paymentDeadline: z.string(),
  })
  // Each cross-field rule runs as soon as its own fields are valid, even while
  // fields on later wizard steps are still empty.
  .refine((v) => v.endAt > v.startAt, {
    path: ['endAt'],
    message: 'Must be after the start.',
    when: validFields('startAt', 'endAt'),
  })
  .refine((v) => v.registrationDeadline > v.registrationStart, {
    path: ['registrationDeadline'],
    message: 'Must be after registration opens.',
    when: validFields('registrationStart', 'registrationDeadline'),
  })
  .refine((v) => v.maxTeamSize >= v.minTeamSize, {
    path: ['maxTeamSize'],
    message: 'Must be at least the minimum.',
    when: validFields('minTeamSize', 'maxTeamSize'),
  })
  .refine((v) => v.paymentMode === 'none' || v.feeRupees !== undefined, {
    path: ['feeRupees'],
    message: 'Enter the fee.',
    when: validFields('paymentMode'),
  })
  .refine((v) => v.paymentMode !== 'after_shortlist' || v.paymentDeadline !== '', {
    path: ['paymentDeadline'],
    message: 'Pick the payment deadline.',
    when: validFields('paymentMode'),
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

export const STEPS = [
  { title: 'Basics', fields: ['name', 'hostedBy', 'venue'] },
  { title: 'Dates', fields: ['startAt', 'endAt', 'registrationStart', 'registrationDeadline'] },
  { title: 'Teams and capacity', fields: ['maxParticipants', 'minTeamSize', 'maxTeamSize'] },
  {
    title: 'Payment',
    fields: [
      'paymentMode',
      'feeRupees',
      'feeBasis',
      'currency',
      'paymentDeadline',
      'paymentInstructions',
    ],
  },
] as const satisfies { title: string; fields: (keyof EventFormValues)[] }[];

export const emptyEventForm: Partial<EventFormValues> = {
  paymentMode: 'none',
  feeBasis: 'per_person',
  currency: 'INR',
  paymentInstructions: '',
  paymentDeadline: '',
  minTeamSize: 1,
  maxTeamSize: 4,
};

export function toEventPayload(v: EventFormValues) {
  const paid = v.paymentMode !== 'none';
  return {
    name: v.name,
    hostedBy: v.hostedBy,
    venue: v.venue,
    startAt: fromISTInput(v.startAt),
    endAt: fromISTInput(v.endAt),
    registrationStart: fromISTInput(v.registrationStart),
    registrationDeadline: fromISTInput(v.registrationDeadline),
    maxParticipants: v.maxParticipants,
    minTeamSize: v.minTeamSize,
    maxTeamSize: v.maxTeamSize,
    paymentMode: v.paymentMode,
    registrationFee: paid ? rupeesToPaise(v.feeRupees ?? 0) : null,
    feeBasis: v.feeBasis,
    currency: paid ? v.currency : null,
    paymentInstructions: paid ? v.paymentInstructions.trim() || null : null,
    paymentDeadline:
      v.paymentMode === 'after_shortlist' && v.paymentDeadline
        ? fromISTInput(v.paymentDeadline)
        : null,
  };
}

export function fromEvent(e: Schemas['Event']): EventFormValues {
  return {
    name: e.name,
    hostedBy: e.hostedBy,
    venue: e.venue,
    startAt: toISTInput(e.startAt),
    endAt: toISTInput(e.endAt),
    registrationStart: toISTInput(e.registrationStart),
    registrationDeadline: toISTInput(e.registrationDeadline),
    maxParticipants: e.maxParticipants,
    minTeamSize: e.minTeamSize,
    maxTeamSize: e.maxTeamSize,
    paymentMode: e.paymentMode,
    feeRupees: e.registrationFee === null ? undefined : paiseToRupees(e.registrationFee),
    feeBasis: e.feeBasis,
    currency: e.currency ?? 'INR',
    paymentInstructions: e.paymentInstructions ?? '',
    paymentDeadline: e.paymentDeadline ? toISTInput(e.paymentDeadline) : '',
  };
}
