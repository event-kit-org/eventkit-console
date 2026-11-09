import {
  BarChart3,
  ChartLine,
  Bell,
  ClipboardList,
  ListChecks,
  ListOrdered,
  FileUp,
  CreditCard,
  Gauge,
  IdCard,
  Link2,
  Contact,
  MapPin,
  Plug,
  Settings,
  ToggleRight,
  Trophy,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface Section {
  /** Path under /events/:eventId ('' is the overview). */
  to: string;
  label: string;
  icon: LucideIcon;
  /** Who sees it in the sidebar. Default: admins only. */
  roles?: string[];
}

/** Reviewers work through teams and payments; everything else is for admins. */
const REVIEW = ['admin', 'reviewer'];

/** The event's sections, grouped as the sidebar shows them, most used first. */
export const SECTIONS: { group: string | null; links: Section[] }[] = [
  {
    group: null,
    links: [
      { to: '', label: 'Overview', icon: Gauge, roles: REVIEW },
      { to: 'statistics', label: 'Event statistics', icon: ChartLine, roles: REVIEW },
    ],
  },
  {
    group: 'Registration',
    links: [
      { to: 'teams', label: 'Teams', icon: Users, roles: REVIEW },
      { to: 'payments', label: 'Payments', icon: CreditCard, roles: REVIEW },
      { to: 'assignments', label: 'Assignments', icon: ListChecks },
    ],
  },
  {
    group: 'Event day',
    links: [
      { to: 'checkpoints', label: 'Checkpoints', icon: MapPin },
      { to: 'attendees', label: 'Attendees', icon: Contact },
      { to: 'polls', label: 'Polls', icon: BarChart3 },
      { to: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    group: 'Judging',
    links: [
      { to: 'submissions', label: 'Submissions', icon: FileUp },
      { to: 'judging', label: 'Judging', icon: Trophy },
      { to: 'leaderboards', label: 'Leaderboards', icon: ListOrdered },
    ],
  },
  {
    // One-off setup, used least once the event is running.
    group: 'Setup',
    links: [
      { to: 'form', label: 'Registration form', icon: ClipboardList },
      { to: 'portal', label: 'Portal connection', icon: Plug },
      { to: 'links', label: 'Links', icon: Link2 },
      { to: 'people', label: 'Team & roles', icon: UserCog },
      { to: 'staff', label: 'Staff', icon: IdCard },
      { to: 'features', label: 'Features', icon: ToggleRight },
      { to: 'payment', label: 'Payment setup', icon: Wallet },
      { to: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

/** Whether someone with `role` sees the section. */
export const canSee = (section: Section, role: string) =>
  (section.roles ?? ['admin']).includes(role);

/** The open section for a path inside an event (`rest` is what follows /events/:eventId). */
export function sectionFor(rest: string): Section {
  const first = rest.split('/').filter(Boolean)[0] ?? '';
  const links = SECTIONS.flatMap((s) => s.links);
  return links.find((l) => l.to === first) ?? links[0]!;
}
