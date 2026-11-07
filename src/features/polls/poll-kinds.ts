import type { Schemas } from '@/api/client';

export type Poll = Schemas['Poll'];
export type PollType = Poll['type'];

export const POLL_TYPES: { value: PollType; label: string }[] = [
  { value: 'choice', label: 'Multiple choice' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi_choice', label: 'Multi-select' },
  { value: 'short_text', label: 'Short answer' },
  { value: 'long_text', label: 'Paragraph' },
  { value: 'number', label: 'Number' },
  { value: 'rating', label: 'Rating' },
  { value: 'datetime', label: 'Date and time' },
];
export const typeLabel = (t: PollType) => POLL_TYPES.find((p) => p.value === t)?.label ?? t;
export const isSingleChoice = (t: PollType) => t === 'choice' || t === 'dropdown';
export const hasOptions = (t: PollType) => isSingleChoice(t) || t === 'multi_choice';
