import {
  advancedParseJson,
  advancedStringifyJson
} from 'lib/json';

type Dated<T> = { created: Date; elt: T };
import { differenceInSeconds, hoursToSeconds } from 'date-fns';
const cacheDisabled = true;
export class LocalStorageCache<T> {
  cache = new Map<string, Dated<T>>();

  constructor(private topic: string, private maxAge: number) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) as string;
      if (key.startsWith(`cache/${topic}/`)) {
        const item = advancedParseJson(localStorage.getItem(key)!) as Dated<T>;
        item.created = new Date(item.created);
        this.cache.set(key.split('/')[2], item);
      }
    }
  }

  async retrieve(key: string, fetchItem: () => Promise<T>) {
    if (cacheDisabled) return fetchItem();
    const cachedElt = this.cache.get(key);
    if (cachedElt && differenceInSeconds(new Date(), cachedElt.created) < this.maxAge) {
      return cachedElt.elt;
    }

    const item = await fetchItem();
    let dated = { created: new Date(), elt: item };
    this.cache.set(key, dated);
    setTimeout(() => {
      localStorage.setItem(`cache/${this.topic}/${key}`, advancedStringifyJson(dated));
    });
    return item;
  }

}
