import { startOfToday, addDays, hoursToSeconds } from 'date-fns';
import { timeCachedFetch } from '../utils/cachedFetch';
import { joinUrl } from '../utils/joinUrl';

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
  versions?: Record<string, PackageJson>;
}

export type PackageJson = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export class NpmApi {
  static async fetchRegistry(path: string, options: RequestInit = {}): Promise<any | null> {
    try {

      const url = joinUrl('/registry', path);
      const res = await timeCachedFetch(hoursToSeconds(4))(url, {
        ...options,
        headers: {
          'Accept': 'application/json',
          ...options?.headers
        }
      });
      // console.log(url, 'completed:', res.statusText)
      if (!res.ok) return null
      return await res.json();
    } catch (err) {
      return null;
    }
  }

  static encodePackage(name: string): string {
    if (name[0] === '@' && name.indexOf('/') !== -1) {
      name = '@' + encodeURIComponent(name.slice(1));
    }
    return name;
  }

  static package(name: string) {
    return NpmApi.fetchRegistry(this.encodePackage(name)) as Promise<Package | null>;
  }

  static async fetchLastWeekDownloadsCount(name: string): Promise<bigint> {

    const today = startOfToday();
    const endOfWeek = addDays(today, 6);

    const fmt = (date: Date) => `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;

    // https://api.npmjs.org/downloads/range/2017-02-25:9999-12-31/
    // const url = `https://api.npmjs.org/downloads/range/${fmt(today)}:${fmt(endOfWeek)}/${NpmApi.encodePackage(name)}`;
    const url = `/npmApi/downloads/range/${fmt(today)}:${fmt(endOfWeek)}/${NpmApi.encodePackage(name)}`;

    const res = await timeCachedFetch(hoursToSeconds(4))(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return 0n;
    const data = await res.json() as DownloadsInRange;
    let count = 0n;
    for (let day of data.downloads) {
      count += BigInt(day.downloads);
    }
    return count;
  }
}
