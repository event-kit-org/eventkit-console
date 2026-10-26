import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { type Schemas, unwrap } from '@/api/client';
import { uploadFile } from '@/api/upload';
import { useApi } from '@/auth/context';
import { ErrorAlert } from '@/components/ErrorAlert';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useEventContext } from '@/features/events/event-context';
import { useEventMutation } from '@/hooks/useEventMutation';
import { EventFields } from './EventFields';
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
  mailing: 'Automatic emails (coming later)',
};

export function SettingsPage() {
  const [search] = useSearchParams();
  return (
    <div className="grid gap-4">
      {search.get('new') && (
        <Alert>
          Event created. Next: set your portal's URL, switch on the features you need, upload your
          UPI QR if teams pay, then create an API key and{' '}
          <Link className="underline" to="../links" relative="path">
            links
          </Link>
          .
        </Alert>
      )}
      <PortalCard />
      <FeaturesCard />
      <PaymentQrCard />
      <EditEventCard />
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
  const { event, path } = useEventContext();
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
  });
  const [newKey, setNewKey] = useState<string | null>(null);
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
          <details>
            <summary className="cursor-pointer text-sm">
              Paths (change only if your portal uses other routes)
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PATHS.map(([name, label, fallback]) => (
                <FormField
                  key={name}
                  label={label}
                  placeholder={fallback}
                  value={paths[name] ?? ''}
                  onChange={(e) => setPaths({ ...paths, [name]: e.target.value })}
                />
              ))}
            </div>
          </details>
          <ErrorAlert error={save.error} />
          {save.isSuccess && <Alert>Saved.</Alert>}
          <div>
            <Button type="submit" disabled={save.isPending}>
              Save portal
            </Button>
          </div>
        </form>
        <div className="mt-6 grid gap-2 text-sm">
          <div className="font-medium">API keys</div>
          <p className="text-muted-foreground">
            The portal sends its key with every request. It identifies the portal and grants nothing
            by itself.
          </p>
          <ul>
            {keys.data
              ?.filter((k) => !k.revokedAt)
              .map((k) => (
                <li key={k.id}>
                  {k.name} · <span className="font-mono">{k.keyPrefix}…</span>
                </li>
              ))}
          </ul>
          {newKey && (
            <Alert>
              New key (shown once): <span className="break-all font-mono">{newKey}</span>
            </Alert>
          )}
          <ErrorAlert error={keys.error ?? createKey.error} />
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => createKey.mutate(undefined, { onSuccess: (k) => setNewKey(k.key) })}
            >
              Create API key
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeaturesCard() {
  const api = useApi();
  const { event, path } = useEventContext();
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
        {toggles.data?.map((t) => (
          <div key={t.feature} className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium capitalize">{t.feature}</div>
              <div className="text-sm text-muted-foreground">{FEATURE_TEXT[t.feature]}</div>
            </div>
            {!t.bought ? (
              <Button
                size="sm"
                disabled={t.feature === 'mailing' || buy.isPending}
                onClick={() => buy.mutate(t.feature)}
              >
                Activate
              </Button>
            ) : (
              <Button
                size="sm"
                variant={t.enabled ? 'outline' : 'default'}
                onClick={() => toggle.mutate({ feature: t.feature, enabled: !t.enabled })}
              >
                {t.enabled ? 'Switch off' : 'Switch on'}
              </Button>
            )}
          </div>
        ))}
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
          Teams pay to this and upload a receipt. JPG, PNG or WebP, up to 5 MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {qr.data && (
          <img
            src={qr.data.url}
            alt="UPI QR code"
            className="h-48 w-48 rounded border object-contain"
          />
        )}
        {!event.hasPaymentQr && (
          <Alert variant="destructive">No QR uploaded yet: teams cannot pay.</Alert>
        )}
        <ErrorAlert error={upload.error} />
        <input
          ref={input}
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
      <CardContent>
        <form className="grid gap-6" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          {STEPS.map((s, i) => (
            <fieldset key={s.title} className="grid gap-3">
              <legend className="mb-2 text-sm font-semibold">{s.title}</legend>
              <EventFields form={form} step={i} />
            </fieldset>
          ))}
          <ErrorAlert error={save.error} />
          {save.isSuccess && <Alert>Saved.</Alert>}
          <div>
            <Button type="submit" disabled={save.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
