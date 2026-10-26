/** Where to go after logging in: ?next=, if it is a same-site path; else home. */
export function safeNext(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
