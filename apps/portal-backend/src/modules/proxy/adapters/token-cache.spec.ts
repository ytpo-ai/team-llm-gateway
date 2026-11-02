import { MemoryTokenCache } from './token-cache.js';

describe('MemoryTokenCache', () => {
  it('stores and retrieves within ttl', async () => {
    const cache = new MemoryTokenCache();
    await cache.set('key', 'value', 60_000);
    await expect(cache.get('key')).resolves.toBe('value');
  });

  it('returns null for missing key', async () => {
    const cache = new MemoryTokenCache();
    await expect(cache.get('missing')).resolves.toBeNull();
  });

  it('expires entries after ttl', async () => {
    vi.useFakeTimers();
    const cache = new MemoryTokenCache();
    await cache.set('key', 'value', 1000);

    vi.advanceTimersByTime(1001);
    await expect(cache.get('key')).resolves.toBeNull();

    vi.useRealTimers();
  });
});
