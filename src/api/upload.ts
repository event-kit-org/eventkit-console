import { type ApiClient, ApiError, unwrap } from './client';

export type UploadPurpose = 'receipt' | 'payment_qr' | 'payment_instructions';

type FileType = 'image/jpeg' | 'image/png' | 'image/webp';
// PDFs are switched off for now.
const ALLOWED: Record<UploadPurpose, readonly FileType[]> = {
  receipt: ['image/jpeg', 'image/png', 'image/webp'],
  payment_qr: ['image/jpeg', 'image/png', 'image/webp'],
  payment_instructions: ['image/jpeg', 'image/png', 'image/webp'],
};
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MAX_SIDE = 2000;
const WEBP_QUALITY = 0.85;

/**
 * Re-encodes a JPG or PNG as WebP, scaled down to at most 2000 px on its
 * longest side, so stored files stay small. Anything else (another type, a
 * browser that cannot encode WebP, a WebP that comes out bigger) gets the file
 * back unchanged.
 */
export async function toWebp(file: Blob): Promise<Blob> {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') return file;
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const webp = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
    return webp.type === 'image/webp' && webp.size < file.size ? webp : file;
  } catch {
    return file;
  }
}

/**
 * Uploads a file straight to storage and returns its key, to pass to the API
 * action that uses it (registration, payment proof, payment QR):
 *   0. a JPG or PNG is turned into WebP first (`toWebp`),
 *   1. the API checks permission and returns a short-lived presigned link,
 *   2. the browser PUTs the file to it (it never passes through the API),
 *   3. the caller hands the key back; the API checks the file then.
 */
export async function uploadFile(
  api: ApiClient,
  eventId: string,
  purpose: UploadPurpose,
  original: File,
  put: typeof fetch = fetch,
  /** Receipts: the team the organiser attaches it to. */
  teamId?: string,
): Promise<string> {
  const file = await toWebp(original);
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
      body: {
        purpose,
        contentType: type,
        size: file.size,
        ...(teamId ? { teamId } : {}),
      },
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
