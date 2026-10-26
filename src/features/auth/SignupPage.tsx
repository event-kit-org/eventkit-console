import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/context';
import { safeNext } from '@/auth/safe-next';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AuthLayout } from './AuthLayout';

// Mirrors the API's rules so most mistakes are caught before sending.
const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(100),
  email: z.email('Enter a valid email.'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ()-]{7,20})?$/, 'Enter a valid phone number, or leave it empty.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
});
type Values = z.infer<typeof schema>;

export function SignupPage() {
  const { signup, status } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: '' } });

  if (status === 'authenticated') return <Navigate to={safeNext(location.search)} replace />;

  const onSubmit = form.handleSubmit(async ({ phone, ...rest }) => {
    setError(null);
    try {
      await signup(phone ? { ...rest, phone } : rest);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign up. Check your connection.');
    }
  });

  const errors = form.formState.errors;
  return (
    <AuthLayout
      title="Create your account"
      description="For event organisers: create events, then build or deploy their portals."
    >
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        {error && <Alert variant="destructive">{error}</Alert>}
        <FormField
          label="Name"
          autoComplete="name"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <FormField
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...form.register('phone')}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link className="font-medium text-foreground underline" to={`/login${location.search}`}>
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
