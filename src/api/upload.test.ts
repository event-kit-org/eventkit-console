import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { uploadFile } from './upload';
import { API, server } from '@/test/server';

// Built per test: openapi-fetch keeps the fetch it sees, and MSW patches it in beforeAll.
const client = () => createApiClient({ apiUrl: API, platformApiKey: 'k' }, () => 't');
const png = (size = 3) => new File([new Uint8Array(size)], 'r.png', { type: 'image/png' });

describe('uploadFile', () => {
  it('asks for a link, PUTs the file to it and returns the key', async () => {
    let asked: unknown;
    server.use(
      http.post(`${API}/v1/events/e1/uploads`, async ({ request }) => {
        asked = await request.json();
        return HttpResponse.json(
          {
            key: 'events/e1/receipts/t1/k.png',
            url: 'https://bucket.test/put',
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            expiresIn: 300,
          },
          { status: 201 },
        );
      }),
    );
    const api = client();
    const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const file = png();
    expect(await uploadFile(api, 'e1', 'receipt', file, put)).toBe('events/e1/receipts/t1/k.png');
    expect(asked).toEqual({ purpose: 'receipt', contentType: 'image/png', size: 3 });
    expect(put).toHaveBeenCalledWith('https://bucket.test/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: file,
    });

    put.mockResolvedValue(new Response(null, { status: 403 }));
    await expect(uploadFile(api, 'e1', 'receipt', file, put)).rejects.toMatchObject({
      code: 'UPLOAD_FAILED',
    });
  });

  it('refuses wrong types and big files before asking', async () => {
    const api = client();
    const pdf = new File(['%PDF'], 'q.pdf', { type: 'application/pdf' });
    await expect(uploadFile(api, 'e1', 'payment_qr', pdf)).rejects.toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
      message: 'Upload a JPEG, PNG, WEBP file.',
    });
    await expect(uploadFile(api, 'e1', 'receipt', png(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });
});
