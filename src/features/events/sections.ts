import {
  BarChart3,
  Bell,
  ClipboardList,
  FileUp,
  CreditCard,
  Gauge,
  Link2,
  MapPin,
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
  /** Who sees it in the sidebar. Default: admins only. */
  roles?: string[];
}

/** Reviewers work through teams and payments; everything else is for admins. */
const REVIEW = ['admin', 'reviewer'];

/** The event's sections, grouped as the sidebar shows them. */
export const SECTIONS: { group: string | null; links: Section[] }[] = [
  { group: null, links: [{ to: '', label: 'Overview', icon: Gauge, roles: REVIEW }] },
  {
    group: 'Registration',
    links: [
      { to: 'teams', label: 'Teams', icon: Users, roles: REVIEW },
      { to: 'payments', label: 'Payments', icon: CreditCard, roles: REVIEW },
      { to: 'form', label: 'Registration form', icon: ClipboardList },
      { to: 'links', label: 'Links', icon: Link2 },
    ],
  },
  {
    group: 'Event day',
    links: [
      { to: 'checkpoints', label: 'Checkpoints', icon: MapPin },
      { to: 'polls', label: 'Polls', icon: BarChart3 },
      { to: 'notifications', label: 'Notifications', icon: Bell },
      { to: 'submissions', label: 'Submissions', icon: FileUp },
      { to: 'judging', label: 'Judging', icon: Trophy },
    ],
  },
  {
    group: 'Setup',
    links: [
      { to: 'people', label: 'People', icon: UserCog },
      { to: 'settings', label: 'Portal & settings', icon: Settings },
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
