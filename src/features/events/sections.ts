import {
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  Gauge,
  Link2,
  MapPin,
  ScanLine,
  Settings,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface Section {
  /** Path under /events/:eventId ('' is the overview). */
  to: string;
  label: string;
  icon: LucideIcon;
}

/** The event's sections, grouped as the sidebar shows them. */
export const SECTIONS: { group: string | null; links: Section[] }[] = [
  { group: null, links: [{ to: '', label: 'Overview', icon: Gauge }] },
  {
    group: 'Registration',
    links: [
      { to: 'teams', label: 'Teams', icon: Users },
      { to: 'payments', label: 'Payments', icon: CreditCard },
      { to: 'form', label: 'Registration form', icon: ClipboardList },
      { to: 'links', label: 'Links', icon: Link2 },
    ],
  },
  {
    group: 'Event day',
    links: [
      { to: 'checkpoints', label: 'Checkpoints', icon: MapPin },
      { to: 'scan', label: 'Scanner', icon: ScanLine },
      { to: 'polls', label: 'Polls', icon: BarChart3 },
      { to: 'notifications', label: 'Notifications', icon: Bell },
      { to: 'judging', label: 'Judging', icon: Trophy },
    ],
  },
  {
    group: 'Setup',
    links: [
      { to: 'people', label: 'Staff', icon: UserCog },
      { to: 'settings', label: 'Portal & settings', icon: Settings },
    ],
  },
];

/** The open section for a path inside an event (`rest` is what follows /events/:eventId). */
export function sectionFor(rest: string): Section {
  const first = rest.split('/').filter(Boolean)[0] ?? '';
  const links = SECTIONS.flatMap((s) => s.links);
  return links.find((l) => l.to === first) ?? links[0]!;
}
