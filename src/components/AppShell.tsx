import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi } from '@/auth/context';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { sectionFor } from '@/features/events/sections';
import { useOpenEventId } from '@/hooks/useOpenEventId';
import { AppSidebar } from './AppSidebar';

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Crumbs />
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Where you are: Events › the event › its section. */
function Crumbs() {
  const api = useApi();
  const { pathname } = useLocation();
  const eventId = useOpenEventId();
  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: () =>
      unwrap(api.GET('/v1/events/{eventId}', { params: { path: { eventId: eventId! } } })),
    enabled: eventId !== null,
    retry: false,
  });

  const trail: { label: string; to?: string }[] = [{ label: 'Events', to: '/' }];
  if (pathname === '/events/new') trail.push({ label: 'Create an event' });
  if (eventId) {
    const base = `/events/${eventId}`;
    trail.push({ label: event.data?.event.name ?? 'Event', to: base });
    const section = sectionFor(pathname.slice(base.length));
    if (section.to) trail.push({ label: section.label, to: `${base}/${section.to}` });
  }
  // The last crumb is the page you're on; the ones before it link back.
  trail[trail.length - 1]!.to = undefined;

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 && (
              // Phones show only the page you're on.
              <BreadcrumbSeparator className="hidden md:block" />
            )}
            <BreadcrumbItem className={i < trail.length - 1 ? 'hidden md:inline-flex' : 'min-w-0'}>
              {c.to ? (
                <BreadcrumbLink asChild>
                  <Link to={c.to}>{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
