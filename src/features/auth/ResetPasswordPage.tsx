import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { ApiError, unwrap } from '@/api/client';
import { useAuth } from '@/auth/context';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AuthLayout } from './AuthLayout';

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: "The passwords don't match.",
  });
type Values = z.infer<typeof schema>;

/** The page the forgot-password email links to: choose a new password, then you're in. */
export function ResetPasswordPage() {
  const { api, start } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [error, setError] = useState<{ message: string; expired: boolean } | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      start(
        await unwrap(
          api.POST('/v1/auth/password/reset', { body: { token, newPassword: password } }),
        ),
      );
      void navigate('/', { replace: true });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? { message: e.message, expired: e.code === 'RESET_LINK_INVALID' }
          : { message: 'Could not save it. Check your connection.', expired: false },
      );
    }
  });

  return (
    <AuthLayout
      title="Choose a new password"
      description="Every device signed in to your account is signed out."
    >
      <form className="grid gap-5" onSubmit={onSubmit} noValidate>
        {(error || !token) && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>
              <p>
                {error?.message ?? 'This link is incomplete. Open the link from the email again.'}
              </p>
              {(error?.expired || !token) && (
                <Link className="underline underline-offset-4" to="/forgot-password">
                  Get a new link
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
        <FormField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <FormField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.confirm?.message}
          {...form.register('confirm')}
        />
        <Button type="submit" disabled={!token || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : 'Save and log in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
