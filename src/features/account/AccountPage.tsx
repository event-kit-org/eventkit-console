import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { ApiError, unwrap } from '@/api/client';
import { useAuth } from '@/auth/context';
import { ConfirmButton } from '@/components/ConfirmButton';
import { FormField } from '@/components/FormField';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Your eventKit account: who you are, your password, and deleting the account. */
export function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="grid max-w-2xl gap-4">
      <PageHeader title="Account settings" description="Your eventKit account, for every event." />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{user?.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">{user?.email}</dd>
          </dl>
        </CardContent>
      </Card>
      <ChangePassword />
      <DeleteAccount />
    </div>
  );
}

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.'),
    next: z.string().min(8, 'At least 8 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    path: ['confirm'],
    message: "The passwords don't match.",
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function ChangePassword() {
  const { api, start } = useAuth();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = form.handleSubmit(async ({ current, next }) => {
    setError(null);
    setDone(false);
    try {
      // The reply's token keeps this device signed in; every other session ends.
      start(
        await unwrap(
          api.POST('/v1/auth/password', {
            body: { currentPassword: current, newPassword: next },
          }),
        ),
      );
      form.reset();
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change it. Check your connection.');
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          Every other device signed in to your account is signed out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid max-w-sm gap-4" onSubmit={onSubmit} noValidate>
          {error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {done && (
            <Alert>
              <CircleCheck aria-hidden />
              <AlertDescription>Password changed. Other devices are signed out.</AlertDescription>
            </Alert>
          )}
          <FormField
            label="Current password"
            type="password"
            autoComplete="current-password"
            error={form.formState.errors.current?.message}
            {...form.register('current')}
          />
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.next?.message}
            {...form.register('next')}
          />
          <FormField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.confirm?.message}
            {...form.register('confirm')}
          />
          <Button type="submit" className="w-fit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type OwnedEvent = { id: string; name: string };

function DeleteAccount() {
  const { api, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; events: OwnedEvent[] } | null>(null);

  const remove = async () => {
    setError(null);
    setPending(true);
    try {
      await unwrap(api.DELETE('/v1/auth/me', { body: { password } }));
      logout();
      void navigate('/login', { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? {
              message: e.message,
              events: e.code === 'OWNS_EVENTS' ? (e.details as OwnedEvent[]) : [],
            }
          : { message: 'Could not delete it. Check your connection.', events: [] },
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete account</CardTitle>
        <CardDescription>
          You can't sign in again, and you leave every event you help run. Events you own must be
          deleted first. What you did in events (approvals, scans, scores) stays, under "Deleted
          account".
        </CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-sm gap-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              <p>{error.message}</p>
              {error.events.length > 0 && (
                <ul className="list-disc pl-5">
                  {error.events.map((ev) => (
                    <li key={ev.id}>
                      <Link
                        className="underline underline-offset-4"
                        to={`/events/${ev.id}/settings`}
                      >
                        {ev.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="delete-password">Your password</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <ConfirmButton
          variant="destructive"
          className="w-fit"
          title="Delete your eventKit account?"
          description="This can't be undone. You'll be signed out everywhere."
          confirmLabel="Delete account"
          destructive
          disabled={!password || pending}
          onConfirm={() => void remove()}
        >
          Delete account
        </ConfirmButton>
      </CardContent>
    </Card>
  );
}
