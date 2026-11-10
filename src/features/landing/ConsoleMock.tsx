import { Bell, ChartLine, CreditCard, Gauge, MapPin, Trophy, Users } from 'lucide-react';
import logo from '@/assets/logo.png';

const NAV = [
  { icon: Gauge, label: 'Overview', active: true },
  { icon: Users, label: 'Teams' },
  { icon: CreditCard, label: 'Payments' },
  { icon: MapPin, label: 'Checkpoints' },
  { icon: Bell, label: 'Notifications' },
  { icon: Trophy, label: 'Judging' },
];

const STATS = [
  { label: 'Teams registered', value: '248', note: '+18 today' },
  { label: 'Checked in', value: '612', note: 'of 744 people' },
  { label: 'Payments approved', value: '96%', note: '9 to review' },
];

const BOARD = [
  { team: 'Null Pointers', score: 92.4 },
  { team: 'Byte Me', score: 89.1 },
  { team: 'Merge Conflict', score: 86.7 },
];

/** A still picture of the console's event overview, drawn in markup so it stays sharp. */
export function ConsoleMock() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-xl border border-white/10 bg-neutral-950 text-left shadow-2xl shadow-black"
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 truncate font-mono text-[11px] text-white/40">
          console.eventkit / events / hackfest-26
        </span>
      </div>
      <div className="flex">
        <aside className="hidden w-48 shrink-0 border-r border-white/10 p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-2">
            <img src={logo} alt="" className="size-6 rounded-md" />
            <span className="text-sm font-medium">HackFest &rsquo;26</span>
          </div>
          <ul className="space-y-0.5">
            {NAV.map(({ icon: Icon, label, active }) => (
              <li
                key={label}
                className={
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ' +
                  (active ? 'bg-white/10 text-white' : 'text-white/50')
                }
              >
                <Icon className="size-3.5" />
                {label}
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0 flex-1 space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Event overview</p>
              <p className="truncate text-xs text-white/40">Live · updated just now</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Event day
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[11px] text-white/50">{s.label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">{s.value}</p>
                <p className="text-[11px] text-white/40">{s.note}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:col-span-3">
              <div className="mb-3 flex items-center gap-1.5 text-[11px] text-white/50">
                <ChartLine className="size-3" /> Check-ins by hour
              </div>
              <div className="flex h-20 items-end gap-1.5">
                {[18, 34, 62, 88, 74, 52, 40, 66, 92, 58, 30, 22].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-brand-to/60 to-brand-from/80"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:col-span-2">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-white/50">
                <Trophy className="size-3" /> Leaderboard
              </div>
              <ol className="space-y-1.5">
                {BOARD.map((b, i) => (
                  <li key={b.team} className="flex items-center gap-2 text-xs">
                    <span className="w-3 font-mono text-white/40">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{b.team}</span>
                    <span className="font-mono text-white/60">{b.score}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
