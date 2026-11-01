import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { API, event, server } from '@/test/server';

// The camera does not exist in jsdom: a stand-in lets tests "show" a QR code.
const camera = vi.hoisted(() => ({
  onScan: null as null | ((codes: { rawValue: string }[]) => void),
  onError: null as null | ((e: { message: string }) => void),
  paused: false,
}));
vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: (props: {
    onScan: typeof camera.onScan;
    onError: typeof camera.onError;
    paused: boolean;
  }) => {
    camera.onScan = props.onScan;
    camera.onError = props.onError;
    camera.paused = props.paused;
    return <div data-testid="camera" />;
  },
}));

const show = (code: string) => act(() => camera.onScan?.([{ rawValue: code }]));

const checkpoints = [
  {
    id: 'c-gate',
    name: 'Main gate',
    type: 'entry',
    opensAt: null,
    closesAt: null,
    allowRepeat: false,
    createdAt: event.createdAt,
  },
  {
    id: 'c-lunch',
    name: 'Lunch',
    type: 'meal',
    opensAt: null,
    closesAt: null,
    allowRepeat: false,
    createdAt: event.createdAt,
  },
];

function result(over: Partial<Schemas['ScanResult']> = {}): Schemas['ScanResult'] {
  return {
    id: 's',
    result: 'accepted',
    reason: null,
    scannedAt: event.createdAt,
    replayed: false,
    previousScanAt: null,
    checkpoint: { id: 'c-gate', name: 'Main gate', type: 'entry' },
    meal: null,
    participant: {
      name: 'Asha',
      participantCode: 'PX-0001',
      teamName: 'Byte Club',
      status: 'checked_in',
    },
    reentry: false,
    exitReason: null,
    offline: false,
    ...over,
  };
}

let bodies: { id: string; checkpointId: string; qrToken: string }[];
function answer(fn: (n: number) => Response | Promise<Response>) {
  server.use(
    http.post(`${E}/scans`, async ({ request }) => {
      bodies.push((await request.json()) as never);
      return fn(bodies.length);
    }),
  );
}

beforeEach(() => {
  bodies = [];
  asRole('admin');
  server.use(
    http.get(`${E}/checkpoints`, () => HttpResponse.json(checkpoints)),
    http.get(`${E}/scans`, () => HttpResponse.json([])),
    // No offline list unless a test gives one.
    http.get(`${E}/scans/roster`, () =>
      HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'none' } }, { status: 404 }),
    ),
  );
});

/** Moves the clock past the pause between scans (and the same-code cooldown). */
function later(ms = 4000) {
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now + ms);
}
afterEach(() => vi.restoreAllMocks());

async function open() {
  renderApp(`/events/${event.id}/scan`, { token: 'good-token' });
  const select = await screen.findByLabelText('Checkpoint');
  await screen.findByRole('option', { name: 'Main gate' });
  return select;
}

describe('scanner', () => {
  it("marks someone attending at the gate when they didn't RSVP, then checks them in", async () => {
    answer((n) =>
      HttpResponse.json(
        n === 1 ? result({ result: 'rejected', reason: 'not_attending' }) : result(),
      ),
    );
    const marked: unknown[] = [];
    server.use(
      http.post(`${E}/attendance`, async ({ request }) => {
        marked.push(await request.json());
        return HttpResponse.json({ registrationId: 'r', status: 'attending', name: 'Asha' });
      }),
    );
    await userEvent.selectOptions(await open(), 'c-gate');
    show('qr-1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark attending and check in' }),
    );
    expect(await screen.findByText('✓ Checked in')).toBeInTheDocument();
    expect(marked).toEqual([{ qrToken: 'qr-1', attending: true }]);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.id).not.toBe(bodies[0]!.id);
  });

  it('at a meal checkpoint, shows exactly what to hand over', async () => {
    const lunch = { id: 'c-lunch', name: 'Lunch', type: 'meal' } as const;
    answer((n) =>
      HttpResponse.json(
        result({
          checkpoint: lunch,
          meal:
            n === 1 ? { label: 'Veg thali', chosen: true } : { label: 'Curd rice', chosen: false },
        }),
      ),
    );
    await userEvent.selectOptions(await open(), 'c-lunch');
    show('qr-1');
    expect(await screen.findByText('Veg thali')).toBeInTheDocument();
    later();
    show('qr-2');
    expect(await screen.findByText('Curd rice')).toBeInTheDocument();
    expect(screen.getByText('Default (did not vote)')).toBeInTheDocument();
  });

  it('shows why marking attendance failed', async () => {
    answer(() => HttpResponse.json(result({ result: 'rejected', reason: 'not_attending' })));
    server.use(
      http.post(`${E}/attendance`, () =>
        HttpResponse.json(
          { error: { code: 'INVALID_TRANSITION', message: 'Not confirmed yet.' } },
          { status: 409 },
        ),
      ),
    );
    await userEvent.selectOptions(await open(), 'c-gate');
    show('qr-1');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark attending and check in' }),
    );
    expect(await screen.findByText('Not confirmed yet.')).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
  });

  it('needs a checkpoint, then shows an accepted check-in', async () => {
    answer(() => HttpResponse.json(result()));
    const select = await open();
    expect(camera.paused).toBe(true);
    show('qr-1');
    expect(bodies).toHaveLength(0);

    await userEvent.selectOptions(select, 'c-gate');
    await waitFor(() => expect(camera.paused).toBe(false));
    show('qr-1');
    expect(await screen.findByText('✓ Checked in')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('✓ Checked inAshaTeam Byte Club');
    expect(bodies[0]).toMatchObject({
      checkpointId: 'c-gate',
      qrToken: 'qr-1',
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(window.localStorage.getItem(`eventkit.checkpoint.${event.id}`)).toBe('c-gate');
  });

  it('ignores the same code for a few seconds, then allows it again', async () => {
    answer(() => HttpResponse.json(result()));
    await userEvent.selectOptions(await open(), 'c-gate');
    show('qr-1');
    await screen.findByText('✓ Checked in');
    show('qr-1');
    expect(bodies).toHaveLength(1);
    await waitFor(() => expect(camera.paused).toBe(false));
    later();
    show('qr-1');
    await waitFor(() => expect(bodies).toHaveLength(2));
  });

  it.each([
    [
      { result: 'rejected', reason: 'duplicate', previousScanAt: '2026-10-31T04:00:00.000Z' },
      'Already scanned at 31 Oct 2026, 9:30 am IST',
    ],
    [{ result: 'rejected', reason: 'duplicate' }, 'Already scanned here'],
    [{ result: 'rejected', reason: 'not_open' }, 'This checkpoint is not open yet'],
    [{ result: 'rejected', reason: 'closed' }, 'This checkpoint has closed'],
    [{ result: 'rejected', reason: 'not_attending' }, 'Has not confirmed attendance (RSVP) yet'],
    [{ result: 'rejected', reason: 'not_checked_in' }, 'Not checked in at the entry yet'],
    [{ result: 'rejected', reason: 'cancelled' }, 'Registration is cancelled'],
    [
      { result: 'accepted', checkpoint: { id: 'c-lunch', name: 'Lunch', type: 'meal' } },
      'OK — hand it over',
    ],
  ] as const)('explains %j', async (over, text) => {
    answer(() => HttpResponse.json(result(over as Partial<Schemas['ScanResult']>)));
    await userEvent.selectOptions(await open(), 'c-gate');
    show('qr-x');
    expect(await screen.findByText(new RegExp(text.replace(/[()]/g, '\\$&')))).toBeInTheDocument();
  });

  it('shows API refusals such as unknown codes', async () => {
    answer(() =>
      HttpResponse.json(
        {
          error: {
            code: 'UNKNOWN_QR',
            message: 'This QR code is not a registration for this event.',
          },
        },
        { status: 404 },
      ),
    );
    await userEvent.selectOptions(await open(), 'c-gate');
    show('junk');
    expect(
      await screen.findByText('This QR code is not a registration for this event.'),
    ).toBeInTheDocument();
  });

  it('retries a lost request with the same scan id', async () => {
    answer((n) => (n === 1 ? HttpResponse.error() : HttpResponse.json(result({ replayed: true }))));
    await userEvent.selectOptions(await open(), 'c-gate');
    show('qr-1');
    expect(await screen.findByText('✓ Checked in')).toBeInTheDocument();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.id).toBe(bodies[0]!.id);
  });

  it('when the server cannot be reached, says so, pauses, and reuses the id on the next scan', async () => {
    let up = false;
    answer(() => (up ? HttpResponse.json(result()) : HttpResponse.error()));
    await userEvent.selectOptions(await open(), 'c-gate');
    show('qr-1');
    expect(
      await screen.findByText(/Not recorded: scan again when back online/),
    ).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent("You're offline");
    expect(camera.paused).toBe(true);
    expect(bodies).toHaveLength(3);

    up = true;
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(camera.paused).toBe(false));
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 4000);
    show('qr-1');
    expect(await screen.findByText('✓ Checked in')).toBeInTheDocument();
    expect(bodies[3]!.id).toBe(bodies[0]!.id);
  });

  it('pauses while /health fails', async () => {
    server.use(http.get(`${API}/health`, () => new HttpResponse(null, { status: 503 })));
    await userEvent.selectOptions(await open(), 'c-gate');
    expect(
      await screen.findByText(/Scanning is paused: this checkpoint has no offline list/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('accepts typed codes when the camera fails', async () => {
    answer(() => HttpResponse.json(result()));
    await userEvent.selectOptions(await open(), 'c-gate');
    act(() => camera.onError?.({ message: 'Permission denied' }));
    expect(await screen.findByText(/Camera unavailable \(Permission denied\)/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Code typed by hand'), ' qr-typed ');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('✓ Checked in')).toBeInTheDocument();
    expect(bodies[0]!.qrToken).toBe('qr-typed');
    await waitFor(() => expect(screen.getByLabelText('Code typed by hand')).toHaveValue(''));
  });

  it('remembers the checkpoint, and refuses when scanning is off', async () => {
    window.localStorage.setItem(`eventkit.checkpoint.${event.id}`, 'c-lunch');
    await open();
    expect(screen.getByLabelText('Checkpoint')).toHaveValue('c-lunch');
  });

  it('copes with storage being unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await userEvent.selectOptions(await open(), 'c-gate');
    expect(screen.getByLabelText('Checkpoint')).toHaveValue('c-gate');
  });

  it('says when scanning is switched off', async () => {
    asRole('admin', {}, { registration: true });
    renderApp(`/events/${event.id}/scan`, { token: 'good-token' });
    expect(await screen.findByText('Scanning is switched off for this event.')).toBeInTheDocument();
  });
});

describe('gate checkpoints', () => {
  const gateCp = {
    id: 'c-door',
    name: 'Venue door',
    type: 'gate',
    opensAt: null,
    closesAt: null,
    allowRepeat: false,
    poll: null,
    createdAt: event.createdAt,
  };
  const door = { id: 'c-door', name: 'Venue door', type: 'gate' } as const;
  /** The server: someone inside needs a reason; with one, they are out. */
  function gateServer() {
    server.use(http.get(`${E}/checkpoints`, () => HttpResponse.json([...checkpoints, gateCp])));
    answer(() => {
      const body = bodies.at(-1) as { exitReason?: string };
      if (!body.exitReason) {
        return HttpResponse.json(
          {
            error: {
              code: 'EXIT_REASON_REQUIRED',
              message: 'Choose why they are leaving.',
              details: {
                participant: { name: 'Asha', participantCode: 'PX-0001', teamName: 'Byte Club' },
              },
            },
          },
          { status: 400 },
        );
      }
      return HttpResponse.json(result({ checkpoint: door, exitReason: body.exitReason }));
    });
  }

  it('after scanning someone inside, shows who it is and a reason to pick, then sends it', async () => {
    gateServer();
    await userEvent.selectOptions(await open(), 'c-door');
    show('qr-1');
    const panel = await screen.findByRole('region', { name: 'Going out' });
    expect(panel).toHaveTextContent('Asha is going out');
    expect(panel).toHaveTextContent('Team Byte Club · PX-0001');
    expect(within(panel).getByRole('button', { name: 'Mark as left' })).toBeDisabled();
    await userEvent.click(within(panel).getByRole('combobox', { name: 'Reason' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Bathroom' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark as left' }));
    expect(await screen.findByText('✓ Out: Bathroom')).toBeInTheDocument();
    expect(bodies.map((b) => (b as { exitReason?: string }).exitReason)).toEqual([
      undefined,
      'Bathroom',
    ]);
    expect(screen.queryByRole('region', { name: 'Going out' })).toBeNull();
  });

  it('takes a typed reason; cancelling sends nothing more', async () => {
    gateServer();
    await userEvent.selectOptions(await open(), 'c-door');
    show('qr-1');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Going out' })).toBeNull();
    expect(bodies).toHaveLength(1);

    await userEvent.type(screen.getByLabelText('Code typed by hand'), 'PX-0001');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await userEvent.click(await screen.findByRole('combobox', { name: 'Reason' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Something else…' }));
    await userEvent.type(screen.getByLabelText('Describe it'), 'Parent pickup');
    await userEvent.click(screen.getByRole('button', { name: 'Mark as left' }));
    await waitFor(() => expect(bodies.at(-1)).toMatchObject({ exitReason: 'Parent pickup' }));
  });

  it('lets someone outside straight back in', async () => {
    server.use(http.get(`${E}/checkpoints`, () => HttpResponse.json([...checkpoints, gateCp])));
    answer(() => HttpResponse.json(result({ checkpoint: door, reentry: true })));
    await userEvent.selectOptions(await open(), 'c-door');
    show('qr-1');
    expect(await screen.findByText('✓ Back in')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Going out' })).toBeNull();
  });
});

describe('scan log', () => {
  it('lists recent scans under the banner', async () => {
    server.use(
      http.get(`${E}/scans`, () =>
        HttpResponse.json([
          {
            id: 's2',
            scannedAt: '2026-10-31T04:05:00.000Z',
            result: 'rejected',
            reason: 'duplicate',
            exitReason: null,
            offline: false,
            checkpoint: { id: 'c-gate', name: 'Main gate', type: 'entry' },
            participant: { name: 'Ravi', participantCode: 'PX-0002', teamName: 'Byte Club' },
          },
          {
            id: 's1',
            scannedAt: '2026-10-31T04:00:00.000Z',
            result: 'accepted',
            reason: null,
            exitReason: null,
            offline: true,
            checkpoint: { id: 'c-gate', name: 'Main gate', type: 'entry' },
            participant: { name: 'Asha', participantCode: 'PX-0001', teamName: 'Byte Club' },
          },
        ]),
      ),
    );
    await userEvent.selectOptions(await open(), 'c-gate');
    const log = await screen.findByRole('table', { name: 'Scan log' });
    const rows = within(log).getAllByRole('row');
    expect(rows[0]).toHaveTextContent('TimeParticipant IDNameStatus');
    expect(rows[1]).toHaveTextContent('9:35:00 amPX-0002RaviDuplicate');
    expect(rows[2]).toHaveTextContent('9:30:00 amPX-0001AshaAcceptedOffline');
  });
});

describe('offline scanning', () => {
  it('keeps scanning from the cached list and says offline mode is on', async () => {
    const qrHash = await sha256('qr-asha');
    let up = true;
    server.use(
      http.get(`${API}/health`, () =>
        up ? HttpResponse.json({ ok: true }) : HttpResponse.error(),
      ),
      http.get(`${E}/scans/roster`, () =>
        HttpResponse.json({
          generatedAt: event.createdAt,
          checkpoint: { ...checkpoints[0], poll: null },
          people: [
            {
              registrationId: 'r1',
              qrHash,
              participantCode: 'PX-0001',
              name: 'Asha',
              teamName: 'Byte Club',
              status: 'attending',
              outsideSince: null,
              outsideCheckpointId: null,
              lastAcceptedAt: null,
            },
          ],
        }),
      ),
    );
    answer(() => HttpResponse.error());
    await userEvent.selectOptions(await open(), 'c-gate');
    await waitFor(() => expect(camera.paused).toBe(false));
    up = false;
    show('qr-asha');
    expect(await screen.findByText('Checked offline · sent when back online')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('✓ Checked inAsha');
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline scan mode is on');
    expect(screen.getByLabelText('1 scans waiting to sync')).toBeInTheDocument();
    const log = screen.getByRole('table', { name: 'Scan log' });
    expect(log).toHaveTextContent('PX-0001AshaAcceptedOffline · not sent');
  });
});

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
