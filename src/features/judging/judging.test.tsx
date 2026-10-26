import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, capture, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { event, server } from '@/test/server';

const criteria: Schemas['Criterion'][] = [
  { id: 'c1', name: 'Idea', description: 'How original', maxScore: 10, position: 0 },
  { id: 'c2', name: 'Demo', description: '', maxScore: 5, position: 1 },
];
const board = (visibleToEveryone = false): Schemas['Leaderboard'] => ({
  visibleToEveryone,
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
function use(teams: Schemas['JudgingTeam'][] = [], visible = false) {
  server.use(
    http.get(`${E}/criteria`, () => HttpResponse.json(criteria)),
    http.get(`${E}/judging/teams`, () => HttpResponse.json(teams)),
    http.get(`${E}/leaderboard`, () => HttpResponse.json(board(visible))),
  );
}
const go = () => renderApp(`/events/${event.id}/judging`, { token: 'good-token' });

describe('judging', () => {
  it('admins edit the rubric and the leaderboard visibility', async () => {
    asRole('admin');
    use();
    const added = capture('post', `${E}/criteria`, criteria[0], 201);
    const removed = capture('delete', `${E}/criteria/c2`);
    const shown = capture('patch', E, {
      event: { ...event, leaderboardVisible: true },
      role: 'admin',
    });
    go();
    expect(await screen.findByText('How original')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Criterion'), 'Impact');
    await userEvent.type(screen.getByLabelText('Description for judges'), 'Who it helps');
    await userEvent.clear(screen.getByLabelText('Maximum score'));
    await userEvent.type(screen.getByLabelText('Maximum score'), '20');
    await userEvent.click(screen.getByRole('button', { name: 'Add criterion' }));
    await waitFor(() =>
      expect(added[0]?.body).toEqual({ name: 'Impact', description: 'Who it helps', maxScore: 20 }),
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1]!);
    await waitFor(() => expect(removed).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Show to everyone' }));
    await waitFor(() => expect(shown[0]?.body).toEqual({ leaderboardVisible: true }));
  });

  it('an empty leaderboard says so', async () => {
    asRole('admin');
    server.use(
      http.get(`${E}/leaderboard`, () =>
        HttpResponse.json({ visibleToEveryone: false, entries: [] }),
      ),
    );
    go();
    expect(await screen.findByText('No scores yet.')).toBeInTheDocument();
  });
});
