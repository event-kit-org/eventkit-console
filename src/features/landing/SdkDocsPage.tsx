import { Check, Copy } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { Nav, PRESS_GLOW, PublicPage, SectionLink } from './chrome';

/**
 * How to build a portal on @eventkit/sdk, linked from the landing page. Public:
 * anyone can read it, signed in or not. Keep the examples in step with
 * eventkit-sdk's README.
 */
export function SdkDocsPage() {
  usePageTitle('SDK docs');
  // Opened from the landing page mid-scroll: start at the top, unless a section is named.
  useEffect(() => {
    if (window.location.hash)
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, []);
  return (
    <PublicPage>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6 sm:pt-20">
        <header className="max-w-3xl">
          <Badge variant="outline" className="font-mono">
            @eventkit/sdk
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tighter text-balance sm:text-5xl">
            Build your event's own site
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">
            The SDK is a typed client for the eventKit API: registration, personal links, RSVP,
            check-in scanning (offline too), polls, notifications, submissions and judging. Our
            template portal is built on nothing else, so anything it does, your site can do.
          </p>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
          <Contents />
          <div className="min-w-0 space-y-14">
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-2xl font-semibold tracking-tight">{s.title}</h2>
                <div className="mt-4 space-y-4 leading-relaxed text-muted-foreground [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-foreground">
                  {s.body}
                </div>
              </section>
            ))}
            <Next />
          </div>
        </div>
      </main>
    </PublicPage>
  );
}

/** Sticky on wide screens; a wrapping list of links above the content on phones. */
function Contents() {
  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        On this page
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm lg:flex-col lg:gap-2">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <SectionLink id={s.id} className="text-muted-foreground hover:text-foreground">
              {s.title}
            </SectionLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A code sample with a copy button. Long lines scroll inside the block, never the page. */
function Code({ children, label = 'ts' }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const code = children.trim();
  return (
    <div className="relative rounded-xl border border-white/10 bg-neutral-950">
      <div className="flex items-center justify-between border-b border-white/[0.06] py-1 pr-1 pl-4">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={copied ? 'Copied' : 'Copy code'}
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Next() {
  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-950 p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Next</h2>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          Every call and its exact request and response: the API's Swagger UI at{' '}
          <code className="font-mono text-foreground">/docs</code> on your eventKit server.
        </li>
        <li>
          A complete small portal:{' '}
          <code className="font-mono text-foreground">examples/vite-react</code> in the SDK, and the
          full template portal, <code className="font-mono text-foreground">eventkit-portal</code>.
        </li>
        <li>
          Anything not wrapped yet: <code className="font-mono text-foreground">ek.raw</code>, the
          typed HTTP client underneath.
        </li>
      </ul>
      <Button asChild className={cn(PRESS_GLOW, 'mt-6 h-11 rounded-full px-5')}>
        <Link to="/signup">Create an event</Link>
      </Button>
    </section>
  );
}

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'install',
    title: 'Install',
    body: (
      <>
        <p>
          The SDK isn't on the npm registry: install it straight from{' '}
          <a
            href="https://github.com/event-kit-org/eventkit-sdk"
            className="text-foreground underline underline-offset-4"
          >
            GitHub
          </a>
          . npm clones it and builds it on install.
        </p>
        <Code label="bash">npm install github:event-kit-org/eventkit-sdk</Code>
        <p>
          Imports stay <code>@eventkit/sdk</code>, with React hooks in{' '}
          <code>@eventkit/sdk/react</code> (TanStack Query v5) and the push handlers for your
          service worker in <code>@eventkit/sdk/sw</code>. Add <code>#&lt;commit&gt;</code> to pin a
          version. On npm 11, run <code>npm install-scripts approve @eventkit/sdk</code> once to
          allow its build step.
        </p>
      </>
    ),
  },
  {
    id: 'setup',
    title: 'Create a client',
    body: (
      <>
        <p>
          In the console, open your event's <strong>Portal &amp; settings</strong>: set your site's
          address, create an API key, and note the event ID. The key identifies your portal and
          grants nothing by itself, so it is safe in the browser.
        </p>
        <Code>{`
import { createEventKit, localStorageSession } from '@eventkit/sdk';

export const ek = createEventKit({
  apiUrl: 'https://api.your-eventkit.example',
  apiKey: 'ek_…',
  eventId: '…',
  session: localStorageSession(),
});

const info = await ek.portal.info();
// event, form fields, team rules, link paths, places left, payment details
`}</Code>
        <p>
          <code>apiUrl</code> can list several servers, primary first, separated by commas. Reads
          move to the next one as soon as one can't be reached; writes move only once its{' '}
          <code>/health</code> also fails, so nothing is sent twice.
        </p>
      </>
    ),
  },
  {
    id: 'register',
    title: 'Register a team',
    body: (
      <>
        <p>
          Participants have no accounts. The leader opens a registration link and enters the whole
          team. When the event takes payment at registration, pass the receipt photo (JPG, PNG or
          WebP, up to 5 MB): it is uploaded before the team is sent.
        </p>
        <Code>{`
const { team, members } = await ek.portal.register({
  linkToken,                         // from /register/{token}
  team: { name: 'Byte Club', answers: { [projectFieldId]: 'Smart bins' } },
  members: [
    { name: 'Asha', email: 'asha@example.com' },
    { name: 'Ravi', email: 'ravi@example.com' },
  ],
  receipt: file,
});
// Every member has a participantCode. Only the leader's entry has a link:
// show it once. When the event sends email, the leader gets everyone's links.
`}</Code>
        <p>
          Check the form before sending with <code>checkRegistration</code> (team size, required
          answers, team rules); the API checks again and answers with codes like{' '}
          <code>TEAM_SIZE</code> or <code>TEAM_RULES</code>.
        </p>
      </>
    ),
  },
  {
    id: 'links',
    title: 'Personal links',
    body: (
      <>
        <p>
          Each member comes back through their own link, <code>/me/ek_…</code>. Opening it swaps the
          token for a session and removes it from the address bar.
        </p>
        <Code>{`
const me = await ek.portal.openSecretLink(undefined, { paths: info.paths });

if (me.status === 'confirmed' && me.rsvpEnabled) await ek.portal.me.rsvp();
// me.qrToken is the check-in QR, shown once the team is confirmed

await ek.portal.me.team.get();
await ek.portal.me.team.payReceipt(file);            // leader: after shortlisting or a rejection
await ek.portal.me.team.addMember({ name, email });  // leader, until registration closes
await ek.portal.me.cancel('asha@example.com');       // confirmed with the registered email
`}</Code>
        <p>
          Links last until 7 days after the event. Only organisers issue new ones; participants who
          lose theirs ask them (<code>ASK_ORGANISERS</code>).
        </p>
      </>
    ),
  },
  {
    id: 'activities',
    title: 'Polls, updates and submissions',
    body: (
      <>
        <p>
          Once the team is confirmed (<code>me.confirmed</code>), members get polls, notifications
          and push. Submissions and leaderboards also wait for the event day (
          <code>me.activitiesOpen</code>).
        </p>
        <Code>{`
const polls = await ek.portal.me.polls.list();
await ek.portal.me.polls.vote(pollId, optionId);     // or a value for text, number, rating polls

const feed = await ek.portal.me.notifications.feed(); // newest first; page with { before }
await ek.portal.me.push.enable();                     // urgent notifications on this device

const forms = await ek.portal.me.submissions.list();
await ek.portal.me.submissions.sendResponse(submissionId, answers);

const boards = await ek.portal.me.leaderboards.list();
`}</Code>
        <p>
          Before then these answer <code>NOT_CONFIRMED</code> or <code>NOT_EVENT_DAY</code>.
        </p>
      </>
    ),
  },
  {
    id: 'staff',
    title: 'Volunteers and scanning',
    body: (
      <>
        <p>
          Volunteers and judges sign up through a staff link and its password, then sign in on your
          site. The owner and co-admins sign in with their eventKit login.
        </p>
        <Code>{`
await ek.portal.staff.signup({ linkToken, linkPassword, name, email, password });
await ek.portal.login(email, password);

const scanner = ek.createScanner({ checkpointId });
const result = await scanner.scan(code);   // a QR token or a typed participant ID
if (result) show(scanner.describe(result)); // null: the camera saw the same code again
scanner.online;                            // false: scans are decided here and queued
scanner.pendingCount;                      // sent automatically once back online
`}</Code>
        <p>
          Every scan gets an ID on the device and retries reuse it, so nothing counts twice. At a
          gate, scanning someone inside fails with <code>EXIT_REASON_REQUIRED</code>:{' '}
          <code>leavingFrom(error)</code> says who it is; scan again with{' '}
          <code>{'{ exitReason }'}</code>.
        </p>
      </>
    ),
  },
  {
    id: 'judging',
    title: 'Judging',
    body: (
      <>
        <Code>{`
const ev = ek.event();
const teams = await ev.judging.teams(roundId);     // with your own scores and comment
await ev.judging.saveScores(teamId, [{ criterionId, value: 8 }], 'Strong demo', roundId);
`}</Code>
        <p>
          Judges see teams with at least one checked-in member. Scores lock when the organiser
          closes the round.
        </p>
      </>
    ),
  },
  {
    id: 'react',
    title: 'React',
    body: (
      <>
        <Code label="tsx">{`
import {
  EventKitProvider, usePortalInfo, useSecretLink, useMe, usePortalMutation,
} from '@eventkit/sdk/react';

<EventKitProvider client={ek}>
  <App />
</EventKitProvider>;

function MePage() {
  const { paths } = usePortalInfo().data!;
  useSecretLink(paths);                 // opens the link in the address bar once
  const me = useMe();
  const rsvp = usePortalMutation((portal) => portal.me.rsvp());
  if (!me.data) return <p>Opening your link…</p>;
  return <button onClick={() => rsvp.mutate(undefined)}>I will attend</button>;
}
`}</Code>
        <p>
          Also: <code>useMyTeam</code>, <code>useMyPolls</code>, <code>useMySubmissions</code>,{' '}
          <code>useMyLeaderboards</code>, <code>useMyNotifications</code>, <code>useScanner</code>,{' '}
          <code>useScanLog</code>, <code>useOutside</code>, and event hooks such as{' '}
          <code>useRounds</code> and <code>useJudgingTeams</code>.
        </p>
      </>
    ),
  },
  {
    id: 'push',
    title: 'Push notifications',
    body: (
      <>
        <p>Urgent notifications arrive as web push. In your service worker:</p>
        <Code>{`
import { registerPushHandlers } from '@eventkit/sdk/sw';

registerPushHandlers(self, { urlFor: (p) => \`/notifications#\${p.notificationId}\` });
`}</Code>
        <p>
          Participants turn it on with <code>ek.portal.me.push.enable()</code>, staff with{' '}
          <code>ek.push.enable()</code>. On iPhone, push works once the site is added to the home
          screen.
        </p>
      </>
    ),
  },
  {
    id: 'email',
    title: 'Your registration email',
    body: (
      <>
        <p>
          Replace eventKit's registration email with your own HTML. eventKit fills it in and escapes
          every value when it sends; buttons are links, since mail apps run no scripts.
        </p>
        <Code>{`
import { registrationEmail as t } from '@eventkit/sdk';

const html = \`<h1>\${t.team.name} is registered for \${t.event.name}</h1>
\${t.eachMember((m) => \`<p>\${m.name} · \${m.participantCode}</p>
  \${t.when(m.dashboardUrl, t.button({ href: m.dashboardUrl, label: 'Open dashboard' }))}\`)}\`;

const ev = ek.event();                       // signed in as an admin of the event
const draft = { subject: \`\${t.event.name}: you're in\`, html };
await ev.emails.preview('registration', draft);
await ev.emails.sendTest('registration', draft);
await ev.emails.save('registration', draft);
`}</Code>
      </>
    ),
  },
  {
    id: 'errors',
    title: 'Errors',
    body: (
      <>
        <Code>{`
import { isEventKitError, fieldErrors } from '@eventkit/sdk';

try {
  await ek.portal.register(input);
} catch (e) {
  if (isEventKitError(e, 'TEAM_NAME_TAKEN')) showNameTaken();
  else if (isEventKitError(e, 'INVALID_ANSWERS')) setErrors(fieldErrors(e));
  else throw e;
}
`}</Code>
        <p>
          Every error carries the API's <code>code</code> and a message you can show as it is. A{' '}
          <code>401</code> clears the session; <code>WRONG_SESSION</code> (a valid session on the
          wrong page) doesn't.
        </p>
      </>
    ),
  },
  {
    id: 'helpers',
    title: 'Helpers',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <code>formatIST</code>, <code>formatDateIST</code>: eventKit stores UTC; show times in
          IST.
        </li>
        <li>
          <code>formatMoney</code>, <code>amountDue</code>, <code>describeFee</code>: fees are in
          paise.
        </li>
        <li>
          <code>teamDisplayStatus</code>, <code>checkRegistration</code>,{' '}
          <code>checkTeamRules</code>.
        </li>
        <li>
          <code>parseLink</code> and <code>portalUrl</code>: tell registration, staff and personal
          links apart, and build them.
        </li>
        <li>
          <code>toWebp</code>: shrinks photos before upload (done for you by <code>register</code>{' '}
          and <code>payReceipt</code>).
        </li>
      </ul>
    ),
  },
];
