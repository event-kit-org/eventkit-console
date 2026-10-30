import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, capture, confirmDialog, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { apiError, event, server } from '@/test/server';

const R1 = '66666666-6666-4666-8666-666666666661';
const R2 = '66666666-6666-4666-8666-666666666662';
const stamp = event.createdAt;
const round = (over: Partial<Schemas['Round']> = {}): Schemas['Round'] => ({
  id: R1,
  name: 'Round 1',
  position: 0,
  phase: 'draft',
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
});
const rounds = [round(), round({ id: R2, name: 'Finals', position: 1, phase: 'released' })];
const criteria: Schemas['Criterion'][] = [
  { id: 'c1', roundId: R1, name: 'Idea', description: 'How original', maxScore: 10, position: 0 },
  { id: 'c2', roundId: R1, name: 'Demo', description: '', maxScore: 5, position: 1 },
];
const board = (visibleToEveryone = false): Schemas['Leaderboard'] => ({
  visibleToEveryone,
  round: { id: R1, name: 'Round 1', phase: 'draft' },
  entries: [
    {
      rank: 1,
      team: { id: 't1', name: 'Byte Club' },
      total: 12.5,
      maxTotal: 15,
      judges: 2,
      criteria: [],
    },
  ],
});
function use(list = rounds) {
  const asked: string[] = [];
  server.use(
    http.get(`${E}/rounds`, () => HttpResponse.json(list)),
    http.get(`${E}/criteria`, ({ request }) => {
      const id = new URL(request.url).searchParams.get('roundId') ?? '';
      asked.push(id);
      return HttpResponse.json(id === R1 ? criteria : []);
    }),
    http.get(`${E}/leaderboard`, () => HttpResponse.json(board())),
  );
  return asked;
}
const go = () => renderApp(`/events/${event.id}/judging`, { token: 'good-token' });

describe('judging', () => {
  it('admins edit the rubric of the selected round and the leaderboard visibility', async () => {
    asRole('admin');
    use();
    const added = capture('post', `${E}/criteria`, criteria[0], 201);
    const removed = capture('delete', `${E}/criteria/c2`);
    const edited = capture('patch', `${E}/criteria/c1`, criteria[0]);
    const shown = capture('patch', E, {
      event: { ...event, leaderboardVisible: true },
      role: 'admin',
    });
    go();
    expect(await screen.findByText('How original')).toBeInTheDocument();
    expect(await screen.findByText('Byte Club')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Criterion'), 'Impact');
    await userEvent.type(screen.getByLabelText('Description for judges'), 'Who it helps');
    await userEvent.clear(screen.getByLabelText('Maximum score'));
    await userEvent.type(screen.getByLabelText('Maximum score'), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Add criterion' }));
    await waitFor(() =>
      expect(added[0]?.body).toEqual({
        name: 'Impact',
        description: 'Who it helps',
        maxScore: 20,
        roundId: R1,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit Idea' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Idea' }));
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Originality');
    await userEvent.clear(screen.getByLabelText('Max score'));
    await userEvent.type(screen.getByLabelText('Max score'), '8');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(edited[0]?.body).toEqual({
        name: 'Originality',
        description: 'How original',
        maxScore: 8,
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove Demo' }));
    await waitFor(() => expect(removed).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Show to everyone' }));
    await waitFor(() => expect(shown[0]?.body).toEqual({ leaderboardVisible: true }));
  });

  it('switches rounds, changes the phase, renames, adds and deletes', async () => {
    asRole('admin');
    const asked = use();
    const patch = capture('patch', `${E}/rounds/${R1}`, round());
    const made = capture('post', `${E}/rounds`, round({ id: 'new', name: 'Semis' }), 201);
    const removed = capture('delete', `${E}/rounds/${R1}`);
    go();
    expect(await screen.findByText(/Only admins and judges see this round/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Finals' }));
    await waitFor(() => expect(asked).toContain(R2));
    expect(screen.getByText(/Participants see this round and its submissions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Round 1' }));
    await userEvent.selectOptions(screen.getByLabelText('Round phase'), 'closed');
    await waitFor(() => expect(patch[0]?.body).toEqual({ phase: 'closed' }));

    await userEvent.click(screen.getByRole('button', { name: /Rename/ }));
    await userEvent.clear(screen.getByLabelText('Round name'));
    await userEvent.type(screen.getByLabelText('Round name'), 'Qualifier');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patch[1]?.body).toEqual({ name: 'Qualifier' }));

    await userEvent.click(screen.getByRole('button', { name: /Add round/ }));
    await userEvent.type(screen.getByLabelText('Round name'), 'Semis');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add round' }),
    );
    await waitFor(() => expect(made[0]?.body).toEqual({ name: 'Semis' }));

    server.use(
      http.delete(`${E}/rounds/${R1}`, () =>
        apiError(409, 'ROUND_HAS_SCORES', 'This round has scores.'),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete round' }));
    await confirmDialog('Delete round');
    expect(await screen.findByText('This round has scores.')).toBeInTheDocument();
    expect(removed).toHaveLength(0);
  });

  it('duplicates criteria from another round', async () => {
    asRole('admin');
    use();
    const dup = capture('post', `${E}/rounds/${R1}/criteria/duplicate`, [], 201);
    go();
    await userEvent.click(await screen.findByRole('button', { name: /Duplicate criteria from/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Finals' }));
    await waitFor(() => expect(dup[0]?.body).toEqual({ fromRoundId: R2 }));
  });

  it('asks for a first round when there are none', async () => {
    asRole('admin');
    use([]);
    go();
    expect(await screen.findByText('No rounds yet')).toBeInTheDocument();
  });

  it('an empty leaderboard says so', async () => {
    asRole('admin');
    use();
    server.use(
      http.get(`${E}/leaderboard`, () =>
        HttpResponse.json({ visibleToEveryone: false, round: null, entries: [] }),
      ),
    );
    go();
    expect(await screen.findByText('No scores yet.')).toBeInTheDocument();
  });
});
