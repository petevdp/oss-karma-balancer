import { Falsy } from 'rxjs';

type Id = {};

export class InMemoryCache<T> {
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
