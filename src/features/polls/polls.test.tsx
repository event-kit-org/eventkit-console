import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Schemas } from '@/api/client';
import { asRole, capture, E } from '@/test/fixtures';
import { renderApp } from '@/test/render';
import { apiError, event, server } from '@/test/server';

function poll(over: Partial<Schemas['Poll']> = {}): Schemas['Poll'] {
  return {
    id: 'p1',
    question: 'Lunch?',
    audience: ['participant', 'volunteer', 'judge', 'admin'],
    closesAt: '2026-10-31T06:30:00.000Z',
    closed: false,
    resultsVisible: false,
    defaultOptionId: 'o2',
    createdBy: { id: 'u', name: 'Asha' },
    createdAt: event.createdAt,
    options: [
      { id: 'o1', label: 'Veg thali', position: 0, votes: null },
      { id: 'o2', label: 'Curd rice', position: 1, votes: null },
    ],
    totalVotes: null,
    myVote: null,
    canVote: true,
    canManage: false,
    optionsLocked: false,
    mealCheckpoints: [{ id: 'c', name: 'Lunch' }],
    ...over,
  };
}
const usePolls = (list: Schemas['Poll'][]) =>
  server.use(http.get(`${E}/polls`, () => HttpResponse.json(list)));
const go = () => renderApp(`/events/${event.id}/polls`, { token: 'good-token' });

describe('polls', () => {
  it('votes when in the audience; results stay hidden', async () => {
    asRole('admin');
    usePolls([poll()]);
    const vote = capture('put', `${E}/polls/p1/vote`, poll({ myVote: 'o1' }));
    go();
    expect(await screen.findByText('Lunch?')).toBeInTheDocument();
    expect(
      screen.getByText(/Everyone · closes 31 Oct 2026, 12:00 pm IST · used at Lunch/),
    ).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Vote' });
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Veg thali'));
    await userEvent.click(button);
    await waitFor(() => expect(vote[0]?.body).toEqual({ optionId: 'o1' }));
    expect(screen.queryByText(/votes in total/)).not.toBeInTheDocument();
  });

  it('shows results when allowed, and closed polls without voting', async () => {
    asRole('admin');
    usePolls([
      poll({
        closed: true,
        canVote: false,
        myVote: 'o2',
        totalVotes: 3,
        options: [
          { id: 'o1', label: 'Veg thali', position: 0, votes: 1 },
          { id: 'o2', label: 'Curd rice', position: 1, votes: 2 },
        ],
      }),
    ]);
    go();
    expect(await screen.findByText('Closed')).toBeInTheDocument();
    expect(screen.getByText('3 votes in total.')).toBeInTheDocument();
    expect(screen.getByText(/Curd rice \(your choice\)/)).toBeInTheDocument();
  });

  it('staff create polls, add options and show results', async () => {
    asRole('admin');
    usePolls([poll({ canManage: true, canVote: false, mealCheckpoints: [] })]);
    const created = capture('post', `${E}/polls`, poll(), 201);
    const patched = capture('patch', `${E}/polls/p1`, poll({ resultsVisible: true }));
    const added = capture('post', `${E}/polls/p1/options`, poll(), 201);
    go();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Show results to the audience' }),
    );
    await waitFor(() => expect(patched[0]?.body).toEqual({ resultsVisible: true }));
    await userEvent.type(screen.getByLabelText('New option'), 'Pasta');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(added[0]?.body).toEqual({ label: 'Pasta' }));

    await userEvent.click(screen.getByRole('button', { name: 'New poll' }));
    const create = screen.getByRole('button', { name: 'Create poll' });
    await userEvent.type(screen.getByLabelText('Question'), 'Dinner?');
    await userEvent.type(screen.getByLabelText('Options, one per line'), 'Biryani\nDosa\n');
    await userEvent.selectOptions(screen.getByLabelText('Default option'), '1');
    await userEvent.click(screen.getByLabelText('Volunteers'));
    await userEvent.click(screen.getByLabelText('The audience can see the results'));
    await userEvent.type(screen.getByLabelText('Closes (IST, optional)'), '2026-10-31T20:00');
    await userEvent.click(create);
    await waitFor(() =>
      expect(created[0]?.body).toEqual({
        question: 'Dinner?',
        options: ['Biryani', 'Dosa'],
        audience: ['participant', 'volunteer'],
        closesAt: '2026-10-31T14:30:00.000Z',
        resultsVisible: true,
        defaultOptionIndex: 1,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Create poll' })).toBeNull());
  });

  it('creating can be cancelled; errors and an empty list show', async () => {
    asRole('admin');
    usePolls([]);
    server.use(http.post(`${E}/polls`, () => apiError(400, 'VALIDATION_ERROR', 'Bad poll.')));
    go();
    expect(await screen.findByText('No polls yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New poll' }));
    await userEvent.type(screen.getByLabelText('Question'), 'Q');
    await userEvent.type(screen.getByLabelText('Options, one per line'), 'a\nb');
    await userEvent.click(screen.getByRole('button', { name: 'Create poll' }));
    expect(await screen.findByText('Bad poll.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'New poll' })).toBeInTheDocument();
  });
});
