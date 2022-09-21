import { addDays, startOfToday } from 'date-fns';
import {
  FetchFailedError, timeCachedFetch
} from '../utils/cachedFetch';
import { joinUrl } from '../utils/joinUrl';
import { coalesceToNull } from '../../lib/typeUtils';

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

export type Manifest = PackageJson & {
  repository: {
    type: 'git',
    url: string;
  }
}

export class NpmApi {
  static async fetchRegistry<T>(path: string, options: RequestInit = {}): Promise<T | null> {
    const url = joinUrl('/registry', path);
    const out = await timeCachedFetch<T>(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options?.headers
      }
    });
    return coalesceToNull(out)?.data || null;
  }

  static encodePackage(name: string): string {
    if (name[0] === '@' && name.indexOf('/') !== -1) {
      name = '@' + encodeURIComponent(name.slice(1));
    }
    return name;
  }

  static async package(name: string, version: string = 'latest') {
    const url = joinUrl(this.encodePackage(name), version);
    return await NpmApi.fetchRegistry<Manifest>(url);
  }

  static async fetchLastWeekDownloadsCount(name: string): Promise<bigint | null> {

    const today = startOfToday();
    const endOfWeek = addDays(today, 6);

    const fmt = (date: Date) => `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;

    // https://api.npmjs.org/downloads/range/2017-02-25:9999-12-31/
    // const url = `https://api.npmjs.org/downloads/range/${fmt(today)}:${fmt(endOfWeek)}/${NpmApi.encodePackage(name)}`;
    const url = `/npmApi/downloads/range/${fmt(today)}:${fmt(endOfWeek)}/${NpmApi.encodePackage(name)}`;

    const out = await timeCachedFetch<DownloadsInRange>(url, { headers: { 'Accept': 'application/json' } });

    if (out.type === 'error') return null;
    let count = 0n;
    for (let day of out.value.data.downloads) {
      count += BigInt(day.downloads);
    }
    return count;
  }
}
