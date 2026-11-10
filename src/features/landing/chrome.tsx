import { Link } from 'react-router';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Buttons ease up on hover and sink a little when pressed (off for reduced motion). */
export const PRESS =
  'duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.96] motion-safe:active:duration-100';
export const PRESS_GLOW = `${PRESS} hover:bg-primary hover:shadow-[0_0_32px_-4px_rgb(255_255_255/0.45)]`;

/** The public pages' frame: always black, whatever the console theme. */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark relative isolate min-h-dvh overflow-x-clip bg-black text-foreground">
      <Backdrop />
      {children}
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

/**
 * The top bar. On the landing page (`home`) its links scroll within the page;
 * elsewhere they lead back to it.
 */
export function Nav({ home = false }: { home?: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {home ? (
          <a href="#top" className="flex items-center gap-2.5 rounded-md">
            <Brand />
          </a>
        ) : (
          <Link to="/" className="flex items-center gap-2.5 rounded-md">
            <Brand />
          </Link>
        )}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button
            asChild
            variant="ghost"
            className={cn(PRESS, 'hidden h-10 px-3 text-muted-foreground sm:inline-flex')}
          >
            {home ? <a href="#features">Features</a> : <Link to="/#features">Features</Link>}
          </Button>
          <Button
            asChild
            variant="ghost"
            className={cn(PRESS, 'hidden h-10 px-3 text-muted-foreground sm:inline-flex')}
          >
            <Link to="/docs/sdk">SDK</Link>
          </Button>
          <Button asChild variant="ghost" className={cn(PRESS, 'h-10 px-3 text-muted-foreground')}>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild className={cn(PRESS_GLOW, 'h-10 rounded-full px-4')}>
            <Link to="/signup">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <>
      <img src={logo} alt="" className="size-7 rounded-md" />
      <span className="font-semibold tracking-tight">eventKit</span>
    </>
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
        <Link to="/docs/sdk" className="hover:text-foreground">
          SDK docs
        </Link>
      </div>
    </footer>
  );
}
