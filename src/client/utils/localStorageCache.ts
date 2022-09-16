import { advancedStringify } from '../../lib/json';

type Dated<T> = { created: Date; elt: T };
import { differenceInSeconds, hoursToSeconds } from 'date-fns';

export class LocalStorageCache<T> {
  cache = new Map<string, Dated<T>>();

  constructor(private topic: string, private maxAge: number) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) as string;
      if (key.startsWith(`cache/${topic}/`)) {
        this.cache.set(key.split('/')[2], JSON.parse(localStorage.getItem(key)!));
      }
    }
  }

  async retrieve(key: string, fetchItem: () => Promise<T>) {
    const cachedElt = this.cache.get(key);
    if (cachedElt && differenceInSeconds(new Date(), new Date(cachedElt.created)) < this.maxAge) {
      return cachedElt.elt;
    }
    // this.cache.delete(key);

    const item = await fetchItem();
    let dated = { created: new Date(), elt: item };
    this.cache.set(key, dated);
    localStorage.setItem(`cache/${this.topic}/${key}`, advancedStringify(dated));
    return item;
  }

}
