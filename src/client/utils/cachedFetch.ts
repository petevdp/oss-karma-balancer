import { TaskQueue } from '../utils/taskQueue';
import { differenceInSeconds, hoursToSeconds } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import { emitCaughtErrors, PossibleError } from '../../lib/typeUtils';

const requestQueue = new TaskQueue(12);
const cacheName = 'timedCache';

export class FetchFailedError extends Error {
  constructor(public res: Response, error?: any) {
    super(res.statusText, error);
  }
}

// export type FetchOutput<T> = {
//   type: 'err';
//   error: FetchFailedError;
// } | {
//   type: 'success';
//   response: Omit<Response, 'json'>;
//   data: T;
// }

export type FetchOutput<T> = PossibleError<{ response: Response; data: T }, SyntaxError | FetchFailedError>

export async function timeCachedFetch<T>(url: string | URL, options?: RequestInit): Promise<FetchOutput<T>> {
  const out = await firstValueFrom(requestQueue.enqueueTask(async (): Promise<FetchOutput<T>> => {
    const cache = await caches.open(cacheName);
    let match = await cache.match(url);
    const expired = match && differenceInSeconds(new Date(), new Date(match.headers.get('date')!)) > hoursToSeconds(4)
    if (!match || expired) {
      let res: Response;
      res = await fetch(url, options);
      if (!res.ok) {
        return {
          type: 'error',
          error: new FetchFailedError(res)
        };
      }

      await cache.put(url, res);
      match = (await cache.match(url))!;
    }

    const jsonOut = await processJson<T>(match);
    if (jsonOut.type === 'error') return jsonOut;

    return {
      type: 'success',
      value: {
        response: match,
        data: jsonOut.value,
      }
    };
  }));
  return out;
}

function processJson<T>(res: Response) {
  return emitCaughtErrors([SyntaxError] as [typeof SyntaxError], async () => (await res.json()) as T);
}
//     const out = await requestCacheDataOnly.retrieve(url.toString(), async (): Promise<T> => {
//       const res = await fetch(url, options);
//       const data = await res.json() as T;
//       if (!res.ok) {
//         throw new FetchFailedError(res);
//       }
//       return data;
//     });
//     return out as T;
//   }));
// }
