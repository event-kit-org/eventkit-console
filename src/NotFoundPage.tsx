import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-content-center gap-2 p-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="underline">
        Go to your events
      </Link>
    </main>
  );
}
