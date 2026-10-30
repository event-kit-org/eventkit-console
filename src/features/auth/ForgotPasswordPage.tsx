import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { ApiError, unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import { FormField } from '@/components/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AuthLayout } from './AuthLayout';

const schema = z.object({ email: z.email('Enter a valid email.') });
type Values = z.infer<typeof schema>;

/** Asks for a reset link. The answer never says whether an account uses the email. */
export function ForgotPasswordPage() {
  const api = useApi();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await unwrap(api.POST('/v1/auth/password/forgot', { body: { email } }));
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send it. Check your connection.');
    }
  });

  return (
    <AuthLayout title="Forgot password" description="We'll email you a link to choose a new one.">
      <div className="grid gap-5">
        {sent ? (
          <Alert>
            <MailCheck aria-hidden />
            <AlertDescription>
              If an account uses that email, we've sent a link. It works once and expires in 10
              minutes. Check your spam folder too.
            </AlertDescription>
          </Alert>
        ) : (
          <form className="grid gap-5" onSubmit={onSubmit} noValidate>
            {error && (
              <Alert variant="destructive">
                <CircleAlert aria-hidden />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              label="Email"
              type="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Sending…' : 'Send the link'}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link className="font-medium text-foreground underline underline-offset-4" to="/login">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
