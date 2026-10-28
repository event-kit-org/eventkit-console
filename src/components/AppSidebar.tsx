import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';
import { Link, NavLink, useMatch } from 'react-router';
import { unwrap } from '@/api/client';
import { useApi, useAuth } from '@/auth/context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { canSee, SECTIONS, type Section } from '@/features/events/sections';
import { useOpenEventId } from '@/hooks/useOpenEventId';
import { type Theme, useTheme } from '@/lib/theme';

export function AppSidebar() {
  const eventId = useOpenEventId();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {eventId ? <EventSwitcher eventId={eventId} /> : <Brand />}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>{eventId ? <EventNav eventId={eventId} /> : <HomeNav />}</SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function Logo() {
  return (
    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
      <CalendarDays className="size-4" aria-hidden />
    </div>
  );
}

function Brand() {
  return (
    <SidebarMenuButton size="lg" asChild>
      <Link to="/">
        <Logo />
        <span className="truncate font-semibold">eventKit</span>
      </Link>
    </SidebarMenuButton>
  );
}

/** The open event's name; opens a menu to jump to another event. */
function EventSwitcher({ eventId }: { eventId: string }) {
  const api = useApi();
  const { isMobile } = useSidebar();
  const events = useQuery({ queryKey: ['events'], queryFn: () => unwrap(api.GET('/v1/events')) });
  const current = events.data?.find((e) => e.event.id === eventId)?.event;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          aria-label="Switch event"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <Logo />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{current?.name ?? 'eventKit'}</span>
            <span className="truncate text-xs text-muted-foreground">
              {current?.hostedBy ?? 'Event'}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto" aria-hidden />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
        side={isMobile ? 'bottom' : 'right'}
        align="start"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">Your events</DropdownMenuLabel>
        {events.data?.map(({ event }) => (
          <DropdownMenuItem key={event.id} asChild>
            <Link to={`/events/${event.id}`}>
              <span className="flex-1 truncate">{event.name}</span>
              {event.id === eventId && <Check aria-hidden />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">
            <CalendarDays aria-hidden /> All events
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/events/new">
            <Plus aria-hidden /> Create an event
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HomeNav() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <NavItem to="/" label="Events" icon={CalendarDays} />
          <NavItem to="/events/new" label="Create an event" icon={Plus} />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function EventNav({ eventId }: { eventId: string }) {
  const api = useApi();
  const base = `/events/${eventId}`;
  const events = useQuery({ queryKey: ['events'], queryFn: () => unwrap(api.GET('/v1/events')) });
  // Until the events load, assume admin: the pages check the role themselves.
  const role = events.data?.find((e) => e.event.id === eventId)?.role ?? 'admin';
  const groups = SECTIONS.map(({ group, links }) => ({
    group,
    links: links.filter((s) => canSee(s, role)),
  })).filter((g) => g.links.length > 0);
  return (
    <nav aria-label="Event sections">
      {groups.map(({ group, links }) => (
        <SidebarGroup key={group ?? 'top'}>
          {group && <SidebarGroupLabel>{group}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((s) => (
                <NavItem key={s.label} {...s} to={s.to ? `${base}/${s.to}` : base} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}

function NavItem({ to, label, icon: Icon }: Section) {
  const { setOpenMobile } = useSidebar();
  const active = useMatch({ path: to, end: true }) !== null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <NavLink to={to} end onClick={() => setOpenMobile(false)}>
          <Icon aria-hidden />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Who is signed in, the colour theme, and logging out. */
function UserMenu() {
  const { user, logout } = useAuth();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Account"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials(user?.name ?? '')}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
              <DropdownMenuRadioItem value="light">
                <Sun aria-hidden /> Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon aria-hidden /> Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor aria-hidden /> System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>
              <LogOut aria-hidden /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
