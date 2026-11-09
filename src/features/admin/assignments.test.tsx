import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { asRole, capture, confirmDialog, E, filterBy, registeredTeam } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event, server } from '@/test/server';
import { randomFill } from './assignments';

const go = (sub: string) => renderApp(`/events/${event.id}${sub}`, { token: 'good-token' });

const PS = '11111111-1111-4111-8111-111111111111';
const TABLE = '22222222-2222-4222-8222-222222222222';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const T1 = '44444444-4444-4444-8444-444444444441';
const T2 = '44444444-4444-4444-8444-444444444442';

const option = (id: string, title: string, over: object = {}) => ({
  id,
  title,
  description: null,
  capacity: null,
  position: 0,
  teams: 0,
  ...over,
});
const lists = (over: { released?: boolean; aTeams?: number } = {}) => [
  {
    id: PS,
    name: 'Problem statement',
    kind: 'options',
    position: 0,
    releasedAt: over.released ? event.createdAt : null,
    assignedTeams: over.aTeams ?? 0,
    options: [
      option(A, 'Smart canteen', { capacity: 1, teams: over.aTeams ?? 0 }),
      option(B, 'Campus map', { position: 1 }),
    ],
  },
  {
    id: TABLE,
    name: 'Table',
    kind: 'text',
    position: 1,
    releasedAt: null,
    assignedTeams: 0,
    options: [],
  },
];
const summary = (id: string, name: string, assignments: object = {}) => ({
  id,
  name,
  leader: { registrationId: 'r1', name: 'Asha', email: 'asha@example.com', phone: null },
  status: 'confirmed',
  shortlistedBy: null,
  confirmedBy: null,
  memberCount: 2,
  attendingCount: 0,
  releasedStatus: 'confirmed',
  pendingRelease: false,
  belowMinimum: false,
  latestProofStatus: null,
  paidAmount: null,
  paidMembers: null,
  assignments,
  createdAt: event.createdAt,
});

function serve(listBody = lists(), teams = [summary(T1, 'Byte Club'), summary(T2, 'Null Ptr')]) {
  server.use(
    http.get(`${E}/assignment-lists`, () => HttpResponse.json(listBody)),
    http.get(`${E}/teams`, () => HttpResponse.json(teams)),
  );
}

describe('assignments page', () => {
  it('starts empty and creates a list', async () => {
    asRole('admin');
    serve([], []);
    const create = capture('post', `${E}/assignment-lists`, lists()[0], 201);
    go('/assignments');
    expect(await screen.findByText('No lists yet')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'New list' })[0]!);
    const dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText('Name'), 'Table');
    await userEvent.click(dialog.getByLabelText(/A typed value/));
    await userEvent.click(dialog.getByRole('button', { name: 'Create list' }));
    await waitFor(() => expect(create[0]?.body).toEqual({ name: 'Table', kind: 'text' }));
  });

  it('assigns options and typed values from the grid; a full option is disabled', async () => {
    asRole('admin');
    serve(lists({ aTeams: 1 }), [
      summary(T1, 'Byte Club', { [PS]: { optionId: A, label: 'Smart canteen' } }),
      summary(T2, 'Null Ptr'),
    ]);
    const pick = capture('put', `${E}/assignment-lists/${PS}/teams/${T2}`, lists()[0]);
    const clear = capture('delete', `${E}/assignment-lists/${PS}/teams/${T1}`, null, 204);
    const type = capture('put', `${E}/assignment-lists/${TABLE}/teams/${T2}`, lists()[1]);
    go('/assignments');

    const select = await screen.findByRole('combobox', { name: 'Problem statement for Null Ptr' });
    await userEvent.click(select);
    expect(screen.getByRole('option', { name: /Smart canteen/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(screen.getByRole('option', { name: /Campus map/ }));
    await waitFor(() => expect(pick[0]?.body).toEqual({ optionId: B }));

    await userEvent.click(
      screen.getByRole('combobox', { name: 'Problem statement for Byte Club' }),
    );
    await userEvent.click(screen.getByRole('option', { name: '—' }));
    await waitFor(() => expect(clear).toHaveLength(1));

    const input = screen.getByLabelText('Table for Null Ptr');
    await userEvent.type(input, 'T12');
    await userEvent.tab();
    await waitFor(() => expect(type[0]?.body).toEqual({ text: 'T12' }));

    await filterBy('Unassigned in Problem statement');
    expect(screen.queryByText('Byte Club')).not.toBeInTheDocument();
    expect(screen.getByText('Null Ptr')).toBeInTheDocument();
  });

  it('lists each list compactly; Edit renames it and adds options; release asks first', async () => {
    asRole('admin');
    serve();
    const add = capture('post', `${E}/assignment-lists/${PS}/options`, lists()[0], 201);
    const rename = capture('patch', `${E}/assignment-lists/${PS}`, lists()[0]);
    const release = capture('post', `${E}/assignment-lists/${PS}/release`, lists()[0]);
    go('/assignments');
    const list = await screen.findByRole('list', { name: 'Lists' });
    const row = within(list).getByText('Problem statement').closest('li') as HTMLElement;
    expect(row).toHaveTextContent(/Options · \d+ options?/);
    expect(row).toHaveTextContent('Hidden');
    // The options are edited in a dialog, not on the page.
    expect(screen.queryByLabelText('New option')).not.toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('0 / 1 teams')).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText('New option'), 'Water ATM');
    await userEvent.type(dialog.getByLabelText('Limit'), '3');
    await userEvent.click(dialog.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(add[0]?.body).toEqual({ title: 'Water ATM', capacity: 3 }));
    const name = dialog.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Problem statements');
    await userEvent.click(dialog.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(rename[0]?.body).toEqual({ name: 'Problem statements' }));

    await userEvent.click(within(row).getByRole('button', { name: 'More for Problem statement' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Release to participants' }));
    await confirmDialog('Release');
    await waitFor(() => expect(release).toHaveLength(1));
  });

  it('shows at most three lists as columns, picked in the Lists menu', async () => {
    asRole('admin');
    const text = (id: string, name: string, position: number) => ({
      ...lists()[1]!,
      id,
      name,
      position,
    });
    serve([...lists(), text('l3', 'Mentor', 2), text('l4', 'Room', 3)]);
    const { router } = go('/assignments');
    const table = await screen.findByRole('table');
    const headers = () =>
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent);
    // The first three, then the menu swaps one for another.
    expect(headers()).toEqual(['Team', 'Status', 'Problem statement', 'Table', 'Mentor']);
    await userEvent.click(screen.getByRole('button', { name: 'Lists shown: 3 of 4' }));
    expect(await screen.findByRole('menuitemcheckbox', { name: 'Room' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Table' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Room' }));
    // The menu stays open to swap several; close it to look at the table.
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(headers()).toEqual(['Team', 'Status', 'Problem statement', 'Mentor', 'Room']),
    );
    expect(router.state.location.search).toMatch(/^\?lists=/);
  });

  it('has no Lists menu with three lists or fewer', async () => {
    asRole('admin');
    serve();
    go('/assignments');
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /^Lists shown/ })).not.toBeInTheDocument();
  });

  it('fills unassigned teams at random through the bulk endpoint', async () => {
    asRole('admin');
    serve();
    const fill = capture('put', `${E}/assignment-lists/${PS}/assignments`, lists()[0]);
    go('/assignments');
    await userEvent.click(
      await screen.findByRole('button', { name: 'More for Problem statement' }),
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Random fill' }));
    expect(await screen.findByText(/2 of 2 unassigned teams get an option/)).toBeInTheDocument();
    await confirmDialog('Fill 2 teams');
    await waitFor(() => expect(fill).toHaveLength(1));
    const items = (fill[0]!.body as { items: { teamId: string; optionId: string }[] }).items;
    expect(items.map((i) => i.teamId).sort()).toEqual([T1, T2]);
    // The limit of 1 holds: at most one team gets Smart canteen.
    expect(items.filter((i) => i.optionId === A).length).toBeLessThanOrEqual(1);
  });

  it('is in the sidebar for admins', async () => {
    asRole('admin');
    serve();
    go('/assignments');
    expect(await screen.findAllByRole('link', { name: 'Assignments' })).not.toHaveLength(0);
  });
});

describe('team page', () => {
  it('lists the team’s assignments, who gave them and whether participants see them', async () => {
    asRole('admin');
    const t = registeredTeam('confirmed', {
      assignments: [
        {
          listId: PS,
          listName: 'Problem statement',
          kind: 'options',
          option: { id: A, title: 'Smart canteen', description: 'Shorter queues' },
          text: null,
          released: true,
          assignedBy: { userId: 'u', name: 'Rhea' },
          assignedAt: event.createdAt,
        },
        {
          listId: TABLE,
          listName: 'Table',
          kind: 'text',
          option: null,
          text: 'T12',
          released: false,
          assignedBy: { userId: 'u', name: 'Rhea' },
          assignedAt: event.createdAt,
        },
      ],
    });
    server.use(http.get(`${E}/teams/${t.id}`, () => HttpResponse.json(t)));
    go(`/teams/${t.id}`);
    const card = (
      await screen.findByText('Assignments', { selector: '[data-slot="card-title"]' })
    ).closest('[data-slot="card"]') as HTMLElement;
    expect(within(card).getByText('Smart canteen')).toBeInTheDocument();
    expect(within(card).getByText('Shorter queues')).toBeInTheDocument();
    expect(within(card).getByText('T12')).toBeInTheDocument();
    expect(within(card).getByText('Released')).toBeInTheDocument();
    expect(within(card).getByText('Hidden')).toBeInTheDocument();
    expect(within(card).getAllByText(/by Rhea/)).toHaveLength(2);
  });
});

describe('randomFill', () => {
  const opt = (id: string, capacity: number | null, teams = 0) =>
    ({ id, title: id, description: null, capacity, position: 0, teams }) as const;

  it('spreads teams evenly and respects limits', () => {
    const picks = randomFill(
      ['1', '2', '3', '4', '5'],
      [opt('a', 1), opt('b', null), opt('c', null)],
    );
    const count = (id: string) => picks.filter((p) => p.optionId === id).length;
    expect(picks).toHaveLength(5);
    expect(count('a')).toBe(1);
    expect(count('b')).toBe(2);
    expect(count('c')).toBe(2);
  });

  it('leaves teams out when every option is full', () => {
    expect(randomFill(['1', '2'], [opt('a', 2, 1)])).toHaveLength(1);
    expect(randomFill(['1'], [])).toEqual([]);
  });
});
