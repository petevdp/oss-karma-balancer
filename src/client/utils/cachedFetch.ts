import { requestQueue } from '../services/queues';

const cacheName = 'timedCache';
import { differenceInSeconds, hoursToSeconds } from 'date-fns';

export function timeCachedFetch(maxAgeSeconds: number) {
  return async (url: string | URL, options?: RequestInit): (ReturnType<typeof fetch>) => {
    console.log('started ', url);
    const { complete } = await requestQueue.enqueue();
    try {
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
      const out = (await cache.match(url))!;
      return out;
    } finally {
      console.log('completed ', url);
      complete();
    }
  };
}
