import { type ApiClient, ApiError, unwrap } from './client';

export type UploadPurpose = 'receipt' | 'payment_qr' | 'payment_instructions';

type FileType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
const ALLOWED: Record<UploadPurpose, readonly FileType[]> = {
  receipt: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  payment_qr: ['image/jpeg', 'image/png', 'image/webp'],
  payment_instructions: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Uploads a file straight to storage and returns its key, to pass to the API
 * action that uses it (registration, payment proof, payment QR):
 *   1. the API checks permission and returns a short-lived presigned link,
 *   2. the browser PUTs the file to it (it never passes through the API),
 *   3. the caller hands the key back; the API checks the file then.
 */
export async function uploadFile(
  api: ApiClient,
  eventId: string,
  purpose: UploadPurpose,
  file: File,
  put: typeof fetch = fetch,
  /** Receipts: the team the organiser attaches it to. */
  teamId?: string,
): Promise<string> {
  const type = ALLOWED[purpose].find((t) => t === file.type);
  if (!type) {
    const names = ALLOWED[purpose].map((t) => t.split('/')[1]!.toUpperCase()).join(', ');
    throw new ApiError(415, 'UNSUPPORTED_FILE_TYPE', `Upload a ${names} file.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, 'FILE_TOO_LARGE', 'Files can be at most 5 MB.');
  }
  const ticket = await unwrap(
    api.POST('/v1/events/{eventId}/uploads', {
      params: { path: { eventId } },
      body: { purpose, contentType: type, size: file.size, ...(teamId ? { teamId } : {}) },
    }),
  );
  const res = await put(ticket.url, { method: ticket.method, headers: ticket.headers, body: file });
  if (!res.ok) {
    throw new ApiError(
      res.status,
      'UPLOAD_FAILED',
      'The upload failed. Check your connection and try again.',
    );
  }
  return ticket.key;
}
