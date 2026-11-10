import {
  ArrowRight,
  BarChart3,
  Bell,
  Download,
  IdCard,
  LayoutTemplate,
  ScanLine,
  Ticket,
  Trophy,
  Vote,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConsoleMock } from './ConsoleMock';

/**
 * What signed-out visitors see at /: always black, whatever the console theme.
 * Signed-in users get their events there instead (see RequireAuth).
 */
export function LandingPage() {
  return (
    <div className="dark relative isolate min-h-dvh overflow-x-clip bg-black text-foreground">
      <Backdrop />
      <Nav />
      <main>
        <Hero />
        <Features />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/** A faint grid fading out from the top, with the brand glow behind the hero. */
function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1100px] overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] bg-[size:56px_56px]" />
      <div className="absolute top-[-280px] left-1/2 h-[560px] w-[min(900px,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(245_155_255/0.22),rgb(0_102_255/0.12)_55%,transparent)] blur-2xl" />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 rounded-md">
          <img src={logo} alt="" className="size-7 rounded-md" />
          <span className="font-semibold tracking-tight">eventKit</span>
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button
            asChild
            variant="ghost"
            className="hidden h-10 px-3 text-muted-foreground sm:inline-flex"
          >
            <a href="#features">Features</a>
          </Button>
          <Button asChild variant="ghost" className="h-10 px-3 text-muted-foreground">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild className="h-10 rounded-full px-4">
            <Link to="/signup">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="mx-auto max-w-6xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28 lg:pt-32"
    >
      <h1 className="mx-auto max-w-4xl animate-rise text-[2.6rem] leading-[1.05] font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl">
        Run your whole event{' '}
        <span className="bg-gradient-to-r from-brand-from via-[#a78bfa] to-brand-to bg-clip-text text-transparent">
          from one place.
        </span>
      </h1>

      <p className="mx-auto mt-6 max-w-xl animate-rise text-base leading-relaxed text-pretty text-muted-foreground [animation-delay:160ms] sm:text-lg">
        Registrations, payments, check-in and judging. One console for your team, one portal for
        every participant.
      </p>

      <div className="mt-10 flex animate-rise flex-col items-stretch justify-center gap-3 [animation-delay:240ms] sm:flex-row sm:items-center">
        <Button asChild size="lg" className="h-12 rounded-full px-6 text-base">
          <Link to="/login">Open the console</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="ghost"
          className="h-12 rounded-full px-6 text-base text-muted-foreground"
        >
          <a href="#features">See what it does</a>
        </Button>
      </div>

      <div className="relative mt-20 animate-rise [animation-delay:360ms] sm:mt-24">
        <div
          aria-hidden
          className="absolute inset-x-0 -top-8 bottom-1/3 sm:-inset-x-8 -z-10 rounded-[2rem] bg-gradient-to-b from-brand-to/20 via-brand-from/5 to-transparent blur-3xl"
        />
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-1.5 sm:p-2">
          <ConsoleMock />
        </div>
      </div>
    </section>
  );
}

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  className?: string;
}

const FEATURES: Feature[] = [
  {
    icon: Ticket,
    title: 'Registration, made easy',
    body: 'Team leaders sign up the whole team through your form. Payment proofs land in one queue to approve.',
    className: 'md:col-span-2',
  },
  {
    icon: ScanLine,
    title: 'QR check-in',
    body: 'Every participant gets a QR pass. Volunteers scan them in and out at each checkpoint.',
  },
  {
    icon: Trophy,
    title: 'Judging and live leaderboards',
    body: 'Submissions, rounds and scoring criteria, with rankings that update as judges score.',
  },
  {
    icon: LayoutTemplate,
    title: 'Your portal, your brand',
    body: 'Start from our portal template or build your own on the SDK. Participants never need an account.',
    className: 'md:col-span-2',
  },
];

const EXTRAS: { icon: LucideIcon; label: string }[] = [
  { icon: Vote, label: 'Live polls' },
  { icon: Bell, label: 'Push notifications' },
  { icon: BarChart3, label: 'Event statistics' },
  { icon: IdCard, label: 'Staff and judge roles' },
  { icon: Download, label: 'CSV exports' },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6 sm:py-32">
      <div className="max-w-2xl">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Features
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tighter text-balance sm:text-5xl">
          From the first sign-up to the final round.
        </h2>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {EXTRAS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-sm text-muted-foreground"
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, body, className }: Feature) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 p-6 transition-colors duration-300 hover:border-white/20 sm:p-8',
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute -top-24 -right-24 size-48 rounded-full bg-brand-to/0 blur-3xl transition-colors duration-500 group-hover:bg-brand-to/20"
      />
      <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
        <Icon aria-hidden className="size-5" />
      </div>
      <h3 className="mt-10 text-lg font-medium tracking-tight sm:text-xl">{title}</h3>
      <p className="mt-2 max-w-md leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 px-6 py-16 text-center sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="absolute inset-x-0 -bottom-40 mx-auto h-80 w-[min(700px,120%)] rounded-full bg-[radial-gradient(closest-side,rgb(0_102_255/0.35),rgb(245_155_255/0.12)_60%,transparent)] blur-2xl"
        />
        <h2 className="relative text-3xl font-semibold tracking-tighter text-balance sm:text-5xl">
          Your next event starts here.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-muted-foreground">
          Create an account, set up your event and open registrations in an afternoon.
        </p>
        <div className="relative mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="h-12 rounded-full px-6 text-base">
            <Link to="/signup">
              Create an account
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6 text-base">
            <Link to="/login">Sign in to the console</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <img src={logo} alt="" className="size-5 rounded" />
          <span>eventKit</span>
        </div>
      </div>
    </footer>
  );
}
