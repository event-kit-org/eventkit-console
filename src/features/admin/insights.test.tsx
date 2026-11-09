import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { asRole, capture, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event, server } from '@/test/server';

const go = () => renderApp(`/events/${event.id}`, { token: 'good-token' });
const FIELD = '11111111-1111-4111-8111-111111111111';
const POLL = '22222222-2222-4222-8222-222222222222';

const noTeams = () =>
  server.use(
    http.get(`${E}/teams`, () => HttpResponse.json([])),
    http.get(`${E}/payment-proofs`, () => HttpResponse.json([])),
  );

describe('overview charts', () => {
  it('shows registrations over time, with the numbers as a table', async () => {
    asRole('admin');
    noTeams();
    server.use(
      http.get(`${E}/insights/registrations`, () =>
        HttpResponse.json([
          { date: '2026-10-20', teams: 1, people: 2, totalTeams: 1, totalPeople: 2 },
          { date: '2026-10-21', teams: 2, people: 5, totalTeams: 3, totalPeople: 7 },
        ]),
      ),
    );
    go();
    const card = (await screen.findByText('Registrations over time')).closest(
      '[data-slot="card"]',
    )!;
    expect(
      await within(card as HTMLElement).findByText(
        '7 people in 3 teams so far (cancellations left out)',
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'View as table' }),
    );
    const rows = within(card as HTMLElement).getAllByRole('row');
    expect(rows[2]).toHaveTextContent('21 Oct257');
    expect(within(rows[2]!).getAllByRole('cell')[1]).toHaveClass('text-right');
  });

  it('says when nobody has registered, and hides attendance before the event day', async () => {
    asRole(
      'admin',
      { startAt: '2030-01-01T03:30:00.000Z' },
      { registration: true, scanning: true },
    );
    noTeams();
    go();
    expect(await screen.findByText('Nobody has registered yet.')).toBeInTheDocument();
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument();
  });

  it('shows attendance from the event day', async () => {
    asRole(
      'admin',
      { startAt: '2026-01-01T03:30:00.000Z' },
      { registration: true, scanning: true },
    );
    noTeams();
    server.use(
      http.get(`${E}/insights/attendance`, () =>
        HttpResponse.json([
          { at: '2026-01-01T04:30:00.000Z', checkedIn: 40, inside: 35, outside: 5 },
        ]),
      ),
    );
    go();
    expect(
      await screen.findByText('35 inside now, 5 out through a gate, 40 checked in'),
    ).toBeInTheDocument();
    // It refreshes on its own, and says so.
    expect(screen.getByText(/Live · updated \d+s ago/)).toBeInTheDocument();
  });
});

describe('the shared dashboard', () => {
  const sources = () =>
    server.use(
      http.get(`${E}/fields`, () =>
        HttpResponse.json([
          { id: FIELD, label: 'Track', type: 'choice', scope: 'team', options: ['AI', 'Web'] },
        ]),
      ),
      http.get(`${E}/polls`, () => HttpResponse.json([{ id: POLL, question: 'Lunch?' }])),
      http.get(`${E}/insights/fields/${FIELD}`, () =>
        HttpResponse.json({
          fieldId: FIELD,
          label: 'Track',
          type: 'choice',
          scope: 'team',
          respondents: 4,
          answered: 3,
          buckets: [
            { label: 'AI', count: 2 },
            { label: 'Web', count: 1 },
          ],
        }),
      ),
    );

  it('shows saved charts to reviewers, without the edit button', async () => {
    asRole('reviewer');
    noTeams();
    sources();
    server.use(
      http.get(`${E}/insights/dashboard`, () =>
        HttpResponse.json([{ id: 'w1', kind: 'field', fieldId: FIELD, chart: 'bar', title: null }]),
      ),
    );
    go();
    expect(await screen.findByText('3 of 4 teams answered')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Track' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit charts' })).not.toBeInTheDocument();
  });

  it('lets admins add, reorder, retitle and remove charts, then saves them', async () => {
    asRole('admin');
    noTeams();
    sources();
    const save = capture('put', `${E}/insights/dashboard`, []);
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit charts' }));
    const sheet = within(await screen.findByRole('dialog'));
    const source = sheet.getByLabelText('Add a chart of');
    await waitFor(() => expect(sheet.getByRole('option', { name: 'Lunch?' })).toBeInTheDocument());
    await userEvent.selectOptions(source, `field:${FIELD}`);
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }));
    await userEvent.selectOptions(source, `poll:${POLL}`);
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }));
    // A third chart, then removed again.
    await userEvent.selectOptions(source, `poll:${POLL}`);
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }));
    await userEvent.click(sheet.getAllByRole('button', { name: 'Remove' })[2]!);
    expect(sheet.getAllByRole('listitem')).toHaveLength(2);
    await userEvent.type(sheet.getByLabelText('Title for Lunch?'), 'Food');
    await userEvent.selectOptions(sheet.getByLabelText('Chart type for Track'), 'pie');
    await userEvent.click(sheet.getAllByRole('button', { name: 'Move up' })[1]!);
    await userEvent.click(sheet.getByRole('button', { name: 'Save charts' }));

    await waitFor(() => expect(save).toHaveLength(1));
    expect(save[0]!.body).toEqual([
      expect.objectContaining({ kind: 'poll', pollId: POLL, chart: 'pie', title: 'Food' }),
      expect.objectContaining({ kind: 'field', fieldId: FIELD, chart: 'pie' }),
    ]);
  });

  it('charts a checkpoint over the day, or its meals as a pie', async () => {
    asRole('reviewer', {}, { registration: true, scanning: true });
    noTeams();
    sources();
    const CP = '33333333-3333-4333-8333-333333333333';
    server.use(
      http.get(`${E}/insights/dashboard`, () =>
        HttpResponse.json([
          { id: 'c1', kind: 'checkpoint', checkpointId: CP, chart: 'bar', title: null },
          { id: 'c2', kind: 'checkpoint', checkpointId: CP, chart: 'pie', title: 'Meals' },
        ]),
      ),
      http.get(`${E}/insights/checkpoints/${CP}`, () =>
        HttpResponse.json({
          checkpointId: CP,
          name: 'Lunch',
          type: 'meal',
          totals: { accepted: 3, duplicate: 1, refused: 1, people: 3 },
          series: [
            { at: '2026-10-31T06:30:00.000Z', accepted: 3, duplicate: 0, refused: 0 },
            { at: '2026-10-31T07:00:00.000Z', accepted: 0, duplicate: 1, refused: 1 },
          ],
          meals: [
            { label: 'Veg', count: 2 },
            { label: 'Non-veg', count: 1 },
          ],
        }),
      ),
    );
    go();
    expect(await screen.findByRole('heading', { name: 'Lunch' })).toBeInTheDocument();
    expect(screen.getAllByText('3 accepted (3 people), 1 already scanned, 1 refused')).toHaveLength(
      2,
    );
    expect(screen.getByRole('heading', { name: 'Meals' })).toBeInTheDocument();
  });

  it('offers checkpoints when adding a chart, if scanning is on', async () => {
    asRole('admin', {}, { registration: true, scanning: true });
    noTeams();
    sources();
    const CP = '33333333-3333-4333-8333-333333333333';
    server.use(http.get(`${E}/checkpoints`, () => HttpResponse.json([{ id: CP, name: 'Lunch' }])));
    const save = capture('put', `${E}/insights/dashboard`, []);
    go();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit charts' }));
    const sheet = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(sheet.getByRole('option', { name: 'Lunch' })).toBeInTheDocument());
    await userEvent.selectOptions(sheet.getByLabelText('Add a chart of'), `checkpoint:${CP}`);
    await userEvent.click(sheet.getByRole('button', { name: 'Add' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Save charts' }));
    await waitFor(() =>
      expect(save[0]?.body).toEqual([
        expect.objectContaining({ kind: 'checkpoint', checkpointId: CP, chart: 'bar' }),
      ]),
    );
  });
});
