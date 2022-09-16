import { startOfToday, addDays, hoursToSeconds } from 'date-fns';
import { timeCachedFetch } from '../utils/cachedFetch';

export type DownloadsInRange = {
  start: Date;
  end: Date;
  downloads: { downloads: number; day: Date }[];
}
export type Package = {
  repository: {
    type: 'git',
    url: string;
  } | string;
  versions: Record<string,PackageJson>;
}

export type PackageJson = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class NpmApi {
  static async fetchRegistry(path: string, options?: RequestInit) {
    const url = new URL(path, 'https://registry.npmjs.org');
    const res = await timeCachedFetch(hoursToSeconds(4))(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options?.headers
      }
    });
    return res.json();
  }

  static encodePackage(name: string): string {
    if (name[0] === '@' && name.indexOf('/') !== -1) {
      name = '@' + encodeURIComponent(name.slice(1));
    }
    return name;
  }

  static package(name: string) {
    return NpmApi.fetchRegistry(this.encodePackage(name)) as Promise<Package>;
  }

  static async fetchLastWeekDownloadsCount(name: string): Promise<bigint> {

    const today = startOfToday();
    const endOfWeek = addDays(today, 6);

    const fmt = (date: Date) => `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;

    // https://api.npmjs.org/downloads/range/2017-02-25:9999-12-31/
    const url = `https://api.npmjs.org/downloads/range/${fmt(today)}:${fmt(endOfWeek)}/${NpmApi.encodePackage(name)}`;

    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json() as DownloadsInRange;
    let count = 0n;
    for (let day of data.downloads) {
      count += BigInt(day.downloads);
    }
    return count;
  }
}
