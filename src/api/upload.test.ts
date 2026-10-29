import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';
import { toWebp, uploadFile } from './upload';
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
    for (const purpose of ['payment_qr', 'payment_instructions', 'receipt'] as const) {
      await expect(uploadFile(api, 'e1', purpose, pdf)).rejects.toMatchObject({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'Upload a JPEG, PNG, WEBP file.',
      });
    }
    await expect(uploadFile(api, 'e1', 'receipt', png(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
      code: 'FILE_TOO_LARGE',
    });
  });
});

describe('toWebp', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A stand-in browser: images decode to `width`×`height`; the canvas encodes to `encoded`. */
  const browser = (width: number, height: number, encoded: () => Blob) => {
    const canvases: { width: number; height: number }[] = [];
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', async () => ({ width, height, close }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
          canvases.push(this);
        }
        getContext() {
          return { drawImage: () => {} };
        }
        async convertToBlob(options: { type: string; quality: number }) {
          expect(options).toEqual({ type: 'image/webp', quality: 0.85 });
          return encoded();
        }
      },
    );
    return { canvases, close };
  };
  const webp = (size: number) => new Blob([new Uint8Array(size)], { type: 'image/webp' });

  it('uploads a photo as a smaller WebP, scaled to 2000 px on its longest side', async () => {
    const { canvases, close } = browser(3000, 4000, () => webp(30));
    let asked: unknown;
    server.use(
      http.post(`${API}/v1/events/e1/uploads`, async ({ request }) => {
        asked = await request.json();
        return HttpResponse.json(
          {
            key: 'events/e1/payment-qr/k.webp',
            url: 'https://bucket.test/put',
            method: 'PUT',
            headers: { 'Content-Type': 'image/webp' },
            expiresIn: 300,
          },
          { status: 201 },
        );
      }),
    );
    const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await uploadFile(client(), 'e1', 'payment_qr', png(5 * 1024 * 1024 + 1), put);
    expect(asked).toEqual({ purpose: 'payment_qr', contentType: 'image/webp', size: 30 });
    expect(canvases[0]).toMatchObject({ width: 1500, height: 2000 });
    expect(close).toHaveBeenCalled();
  });

  it('leaves WebP and other types alone', async () => {
    const { canvases } = browser(10, 10, () => webp(1));
    const already = webp(20);
    expect(await toWebp(already)).toBe(already);
    expect(canvases).toHaveLength(0);
  });

  it('keeps the original when the browser cannot help', async () => {
    const file = png(40);
    vi.stubGlobal('OffscreenCanvas', undefined);
    expect(await toWebp(file)).toBe(file);
    browser(10, 10, () => png(5));
    expect(await toWebp(file)).toBe(file);
    browser(10, 10, () => webp(41));
    expect(await toWebp(file)).toBe(file);
    vi.stubGlobal('createImageBitmap', async () => {
      throw new DOMException('bad image', 'InvalidStateError');
    });
    expect(await toWebp(file)).toBe(file);
  });
});
