import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/alert';

/** Shows an API error's own message (they are written for people). */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Check your connection.';
  return <Alert variant="destructive">{message}</Alert>;
}
