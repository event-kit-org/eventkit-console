/** All times are stored in UTC and always shown in IST. */
const IST = 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatIST(iso: string): string {
  return `${dateTime.format(new Date(iso))} IST`;
}

export function formatDateIST(iso: string): string {
  return dateOnly.format(new Date(iso));
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** UTC ISO string → value for <input type="datetime-local">, in IST. */
export function toISTInput(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value, read as IST → UTC ISO string. */
export function fromISTInput(value: string): string {
  return new Date(new Date(`${value}:00.000Z`).getTime() - IST_OFFSET_MS).toISOString();
}
