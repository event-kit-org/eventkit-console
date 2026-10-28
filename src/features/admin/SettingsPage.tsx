import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, CircleAlert, CircleCheck, KeyRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { type Schemas, unwrap } from '@/api/client';
import { uploadFile } from '@/api/upload';
import { useApi, useAuth } from '@/auth/context';
import { CopyButton } from '@/components/CopyButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { EventFields } from './EventFields';
import { ManageEventCard } from './ManageEventCard';
import {
  eventFormSchema,
  type EventFormValues,
  fromEvent,
  STEPS,
  toEventPayload,
} from './event-form';

const FEATURE_TEXT: Record<Schemas['Feature'], string> = {
  registration: 'Team registration on your portal, payments and registration links',
  scanning: 'Checkpoints and QR scanning',
  mailing: "Email the team leader everyone's participant ID and dashboard link after registering",
};

export function SettingsPage() {
  const [search] = useSearchParams();
  const { event } = useEventContext();
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Portal & settings"
        description="Where your portal lives, which features are on, how teams pay, the event's details, and managing the event."
      />
      {search.get('new') && (
        <Alert>
          <CircleCheck aria-hidden />
          <AlertDescription>
            <p>
              Event created. Next: set your portal's URL, switch on the features you need, upload
              your UPI QR if teams pay, then create an API key and{' '}
              <Link to="../links" relative="path">
                links
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>
      )}
      <PortalCard />
      <FeaturesCard />
      <PaymentInstructionsFileCard />
      <PaymentQrCard />
      {/* Remounts when the deadline changes elsewhere (Manage event), so saving the
          details can't put the old deadline back. */}
      <EditEventCard key={event.registrationDeadline} />
      <ManageEventCard />
    </div>
  );
}

const PATHS = [
  ['register', 'Registration link', '/register/{token}'],
  ['staff', 'Staff link', '/staff/{token}'],
  ['me', 'Personal link', '/me/{token}'],
  ['notifications', 'Notifications page', '/notifications'],
] as const;
type PathName = (typeof PATHS)[number][0];

/** Where the event's portal lives, and the paths its links use. */
function PortalCard() {
  const api = useApi();
  const { event, path, isOwner } = useEventContext();
  const [url, setUrl] = useState(event.portalUrl ?? '');
  const [paths, setPaths] = useState<Partial<Record<PathName, string>>>(
    () => (event.portalPaths ?? {}) as Partial<Record<PathName, string>>,
  );
  const save = useEventMutation(event.id, () => {
    const overrides = Object.fromEntries(
      Object.entries(paths).filter(([, v]) => v && v.trim() !== ''),
    );
    return unwrap(
      api.PATCH('/v1/events/{eventId}', {
        ...path,
        body: { portalUrl: url.trim() || null, portalPaths: overrides },
      }),
    );
  });
  const keys = useQuery({
    queryKey: ['event', event.id, 'api-keys'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/api-keys', path)),
    // API keys are the owner's.
    enabled: isOwner,
  });
  const [newKey, setNewKey] = useState<string | null>(null);
  // The address the console reaches the API on, made absolute for a portal elsewhere.
  const apiUrl = new URL(useAuth().config.apiUrl, window.location.origin).href.replace(/\/+$/, '');
  const portalEnv = (key: string) =>
    `VITE_EVENTKIT_API_URL=${apiUrl}\nVITE_EVENTKIT_EVENT_ID=${event.id}\nVITE_EVENTKIT_API_KEY=${key}`;
  const createKey = useEventMutation(event.id, () =>
    unwrap(api.POST('/v1/events/{eventId}/api-keys', { ...path, body: { name: 'Portal' } })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portal</CardTitle>
        <CardDescription>
          Your event's own site, built with @eventkit/sdk or deployed from the template portal.
          Registration, staff and personal links are made on this address.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined);
          }}
        >
          <FormField
            label="Portal URL"
            placeholder="https://machzero.vercel.app"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronRight
                className="size-4 transition-transform group-data-[state=open]:rotate-90"
                aria-hidden
              />
              Paths (change only if your portal uses other routes)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-4 sm:grid-cols-2">
              {PATHS.map(([name, label, fallback]) => (
                <FormField
                  key={name}
                  label={label}
                  placeholder={fallback}
                  value={paths[name] ?? ''}
                  onChange={(e) => setPaths({ ...paths, [name]: e.target.value })}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
          <ErrorAlert error={save.error} />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              Save portal
            </Button>
            {save.isSuccess && <Saved />}
          </div>
        </form>
        <Separator className="my-6" />
        <FieldSet className="gap-3 text-sm">
          <FieldLegend variant="label">Connect your portal</FieldLegend>
          <p className="text-muted-foreground">
            Your portal needs these two values and an API key (below), for example as{' '}
            <code className="font-mono text-xs">VITE_EVENTKIT_EVENT_ID</code> and{' '}
            <code className="font-mono text-xs">VITE_EVENTKIT_API_URL</code> in the template portal.
          </p>
          <dl className="grid gap-2">
            {(
              [
                ['Event ID', event.id],
                ['API URL', apiUrl],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-center gap-2">
                <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 flex-1">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
                    {value}
                  </code>
                </dd>
                <CopyButton value={value} label={label} />
              </div>
            ))}
          </dl>
        </FieldSet>
        <Separator className="my-6" />
        <FieldSet className="gap-3 text-sm">
          <FieldLegend variant="label">API keys</FieldLegend>
          <p className="text-muted-foreground">
            The portal sends its key with every request. It identifies the portal and grants nothing
            by itself.
            {!isOwner && " Only the event's owner sees and creates keys."}
          </p>
          {isOwner && (
            <>
              <ul className="grid gap-1.5">
                {keys.data
                  ?.filter((k) => !k.revokedAt)
                  .map((k) => (
                    <li key={k.id} className="flex items-center gap-2">
                      <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                      {k.name}
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {k.keyPrefix}…
                      </code>
                    </li>
                  ))}
              </ul>
              {newKey && (
                <Alert>
                  <KeyRound aria-hidden />
                  <AlertDescription className="grid gap-2">
                    <p>
                      New key (shown once):{' '}
                      <code className="font-mono break-all text-foreground">{newKey}</code>
                    </p>
                    <p>Your portal's settings, ready to paste into its environment:</p>
                    <pre
                      aria-label="Portal settings"
                      className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs text-foreground"
                    >
                      {portalEnv(newKey)}
                    </pre>
                    <div>
                      <CopyButton value={portalEnv(newKey)} label="portal settings" />
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              <ErrorAlert error={keys.error ?? createKey.error} />
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    createKey.mutate(undefined, { onSuccess: (k) => setNewKey(k.key) })
                  }
                >
                  Create API key
                </Button>
              </div>
            </>
          )}
        </FieldSet>
      </CardContent>
    </Card>
  );
}

function FeaturesCard() {
  const api = useApi();
  const { event, path, isOwner } = useEventContext();
  const toggles = useQuery({
    queryKey: ['event', event.id, 'features'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/features', path)),
  });
  const buy = useEventMutation(event.id, (feature: Schemas['Feature']) =>
    unwrap(
      api.POST('/v1/events/{eventId}/billing/purchases', {
        ...path,
        body: { features: [feature] },
      }),
    ),
  );
  const toggle = useEventMutation(
    event.id,
    ({ feature, enabled }: { feature: Schemas['Feature']; enabled: boolean }) =>
      unwrap(
        api.PATCH('/v1/events/{eventId}/features/{feature}', {
          params: { path: { eventId: event.id, feature } },
          body: { enabled },
        }),
      ),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Features</CardTitle>
        <CardDescription>Free during the pilot.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ErrorAlert error={buy.error ?? toggle.error} />
        <ul className="divide-y rounded-lg border">
          {toggles.data?.map((t) => (
            <li key={t.feature} className="flex items-center justify-between gap-4 p-4">
              <div className="grid gap-0.5">
                <div className="flex items-center gap-2 font-medium capitalize">{t.feature}</div>
                <div className="text-sm text-muted-foreground">{FEATURE_TEXT[t.feature]}</div>
              </div>
              {!t.bought ? (
                isOwner ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={buy.isPending}
                    onClick={() => buy.mutate(t.feature)}
                  >
                    Activate
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">The owner activates it</span>
                )
              ) : (
                <Switch
                  aria-label={t.feature}
                  checked={t.enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(enabled) => toggle.mutate({ feature: t.feature, enabled })}
                />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PaymentInstructionsFileCard() {
  const api = useApi();
  const { event, path } = useEventContext();
  const file = useQuery({
    queryKey: ['event', event.id, 'payment-instructions-file'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/payment-instructions-file', path)),
    enabled: event.hasPaymentInstructionsFile,
  });
  const upload = useEventMutation(event.id, async (f: File) => {
    const key = await uploadFile(api, event.id, 'payment_instructions', f);
    return unwrap(
      api.PUT('/v1/events/{eventId}/payment-instructions-file', { ...path, body: { key } }),
    );
  });
  const remove = useEventMutation(event.id, () =>
    unwrap(api.DELETE('/v1/events/{eventId}/payment-instructions-file', path)),
  );

  if (event.paymentMode === 'none') return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment instructions file</CardTitle>
        <CardDescription>
          Optional: bank details or steps as an image or PDF, shown to teams before they upload
          their receipt. JPG, PNG, WebP or PDF, up to 5 MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {event.hasPaymentInstructionsFile && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {file.data && (
              <a
                href={file.data.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
              >
                View the current file
              </a>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remove
            </Button>
          </div>
        )}
        <ErrorAlert error={upload.error ?? remove.error} />
        <Input
          type="file"
          className="max-w-sm"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-label="Payment instructions file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
          }}
        />
        {upload.isPending && <p className="text-sm text-muted-foreground">Uploading…</p>}
      </CardContent>
    </Card>
  );
}

function PaymentQrCard() {
  const api = useApi();
  const { event, path } = useEventContext();
  const input = useRef<HTMLInputElement>(null);
  const qr = useQuery({
    queryKey: ['event', event.id, 'payment-qr'],
    queryFn: () => unwrap(api.GET('/v1/events/{eventId}/payment-qr', path)),
    enabled: event.hasPaymentQr,
  });
  const upload = useEventMutation(event.id, async (file: File) => {
    const key = await uploadFile(api, event.id, 'payment_qr', file);
    return unwrap(api.PUT('/v1/events/{eventId}/payment-qr', { ...path, body: { key } }));
  });

  if (event.paymentMode === 'none') return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>UPI QR code</CardTitle>
        <CardDescription>
          Optional. Shown with your payment instructions. JPG, PNG or WebP, up to 5 MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {qr.data && (
          <img
            src={qr.data.url}
            alt="UPI QR code"
            className="size-48 rounded-lg border bg-white object-contain p-2"
          />
        )}
        {!event.hasPaymentQr && !event.paymentInstructions && !event.hasPaymentInstructionsFile && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              Teams don't know how to pay yet: add written instructions (Event details), an
              instructions file, or a QR code.
            </AlertDescription>
          </Alert>
        )}
        <ErrorAlert error={upload.error} />
        <Input
          ref={input}
          className="max-w-sm"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="UPI QR image"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
          }}
        />
        {upload.isPending && <p className="text-sm text-muted-foreground">Uploading…</p>}
      </CardContent>
    </Card>
  );
}

function EditEventCard() {
  const api = useApi();
  const { event, path } = useEventContext();
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: fromEvent(event),
  });
  const save = useEventMutation(event.id, (v: EventFormValues) =>
    unwrap(api.PATCH('/v1/events/{eventId}', { ...path, body: toEventPayload(v) })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event details</CardTitle>
        <CardDescription>Payment settings lock once anyone has registered.</CardDescription>
      </CardHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
        noValidate
      >
        <CardContent className="grid gap-8">
          {STEPS.map((s, i) => (
            <FieldSet key={s.title}>
              <FieldLegend>{s.title}</FieldLegend>
              <EventFields form={form} step={i} />
            </FieldSet>
          ))}
          <ErrorAlert error={save.error} />
        </CardContent>
        <CardFooter className="gap-3 border-t">
          <Button type="submit" disabled={save.isPending}>
            Save changes
          </Button>
          {save.isSuccess && <Saved />}
        </CardFooter>
      </form>
    </Card>
  );
}

function Saved() {
  return (
    <span role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CircleCheck className="size-4 text-emerald-600" aria-hidden /> Saved.
    </span>
  );
}
