const cacheName = 'timedCache';
import { differenceInSeconds, hoursToSeconds } from 'date-fns';

export function timeCachedFetch(maxAgeSeconds: number) {
  return async (url: string|URL, options?: RequestInit): (ReturnType<typeof fetch>) => {
    const cache = await caches.open(cacheName);
    const match = await cache.match(url);
    if (match) {
      const date = new Date(match.headers.get('date')!);
      if (differenceInSeconds(new Date(), date) <= maxAgeSeconds) {
        return match;
      }
    }

    const res = await fetch(url, options);
    await cache.put(url, res);
    return (await cache.match(url))!;
  };
}
