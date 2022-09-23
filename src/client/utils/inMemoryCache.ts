import { Falsy, Observable, ObservableInput } from 'rxjs';
import {filter, mergeMap} from 'rxjs/operators';
import { isNonNulled } from '../../lib/typeUtils';

type Id = {};

interface Cache<T> {
  retrieve(key: string, fetchItem: () => Promise<T|null>): Promise<T | null>
}

export class InMemoryCache<T> implements Cache<T> {
  private cache = new WeakMap<Id, T>();
  private keyMap = new Map<string, Id>();

  async retrieve(key: string, fetchItem: () => Promise<T|null>): Promise<T | null> {
    let id = this.keyMap.get(key);
    if (!id || !this.cache.has(id)) {
      id ??= {};
      this.keyMap.set(key, id);
      let item = await fetchItem();
      if (!item) {
        return null;
      }
      this.cache.set(id, item);
    }
    return this.cache.get(id)!;
  }
}

export function mergeCacheRetrieval<I, O>(cache: Cache<O>, getKey: (input: I) => string, fetch: (input: I) => Promise<O|null>) {
  return (o: Observable<I>): Observable<O> => o.pipe(
    mergeMap((input) => cache.retrieve(getKey(input), () => fetch(input))),
    filter(isNonNulled),
  );
}
