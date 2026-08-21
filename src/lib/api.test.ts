import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBeaches } from './api';

const payload = [{ slug: 'a', name: 'A' }];

function okResponse() {
  return Promise.resolve(new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' } }));
}

describe('getBeaches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the directory once per page load and again only when asked', async () => {
    const fetchMock = vi.fn(okResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBeaches({ fresh: true })).resolves.toEqual(payload);
    await expect(getBeaches()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await getBeaches({ fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockImplementationOnce(okResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBeaches({ fresh: true })).rejects.toThrow('Unable to load beaches');
    await expect(getBeaches()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
