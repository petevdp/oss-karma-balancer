import { advancedParseJson, advancedStringifyJson } from 'lib/json';
import { differenceInSeconds } from 'date-fns';

type Dated<T> = { created: Date; elt: T };

const cacheDisabled = false;

export class LocalStorageCache<T> {
  constructor(private topic: string, private maxAge: number) {
  }

  async retrieve(key: string, fetchItem: () => Promise<T>) {
    if (cacheDisabled) return fetchItem();
    const cacheKey = `cache/${this.topic}/${key}`;
    const rawElt = localStorage.getItem(cacheKey);
    if (rawElt) {
      const cachedElt = advancedParseJson(rawElt) as Dated<T>;
      if (cachedElt && differenceInSeconds(new Date(), new Date(cachedElt.created)) < this.maxAge) {
        return cachedElt.elt;
      }
    }

    const item = await fetchItem();
    let dated = { created: new Date(), elt: item };
    localStorage.setItem(`cache/${this.topic}/${key}`, advancedStringifyJson(dated));
    return item;
  }
}
