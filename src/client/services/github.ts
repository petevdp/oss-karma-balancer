import { EMPTY, from, Observable } from 'rxjs';
import { flattenDeferred } from '../../lib/asyncUtils';
import { timeCachedFetch } from '../utils/cachedFetch';
import { InMemoryCache } from '../utils/inMemoryCache';


//region Api Types
export type Repo = {
  contents_url: string;
  default_branch: string;
  size: number;
  full_name: string;
  language: string;
  open_issues_count: number;
  contributors_url: string;
  name: string;
  owner: {
    login: string;
  }
}

export type Branch = {
  name: string;
  commit: {
    commit: {
      tree: {
        url: string
      }
    }
  }
}

export type BlobRef = {
  path: string;
  url: string;
}

export type Tree = {
  tree: BlobRef[]
}


export type GitBlob = {
  content: string;
}

export type Label = {
  id: number;
  name: string;
}
type Link = {
  url: string;
  page: number;
}

//endregion

export class GithubApi {
  constructor(private maxRateLimitConsumption: number) {
  }

  static async fetchFull<T>(path: string, options?: RequestInit) {
    const url = new URL(path, 'https://api.github.com');
    return await timeCachedFetch<T>(url, {
      ...options,
      headers: {
        ...options?.headers,
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${import.meta.env.VITE_GITHUB_PERSONAL_ACCESS_TOKEN}`
      }
    });
  }

  static async fetchOrNull<T>(path: string, options?: RequestInit): Promise<null | T> {
    const out = await GithubApi.fetchFull<T>(path, options);
    if (out.type === 'error') return null;
    return out.value.data;
  }


  static async fetchPaginatedEntityCount(path: string): Promise<number | null> {
    const out = await GithubApi.fetchFull<unknown[]>(`${path}?per_page=100`);
    if (out.type === 'error') return null;
    const res = out.value.response;
    const header = res.headers.get('Link');
    if (!header) {
      return out.value.data.length;
    }
    const links = parseLinkHeader(header);
    const numPages = links.last.page;
    const resLast = await GithubApi.fetchFull(links.last.url);
    const lastPageCount = out.value.data.length;
    return (numPages - 1) * 100 + lastPageCount;
  }

  private static repoCache = new InMemoryCache<Repo>();

  static repo(fullName: string) {
    return this.repoCache.retrieve(fullName, () => GithubApi.fetchOrNull<Repo>(`/repos/${fullName}`));
  }

  static fetchPaginated<T>(path: string): Observable<T> {
    return flattenDeferred((async (): Promise<Observable<T>> => {
      const out = await GithubApi.fetchFull<T[]>(`${path}?per_page=100`);
      if (out.type === 'error') return EMPTY;
      const initialRes = out.value.response;

      let header = initialRes.headers.get('Link')!;
      // no other pages, return early
      if (!header) return from(await out.value.data);
      const links = parseLinkHeader(header);
      const params = new URLSearchParams(links.last.url.split('?')[1]);
      const pathNoParams = path.split('?')[0];
      const entities: T[] = out.value.data;
      for (let i = 2; i <= links.last.page; i++) {
        params.set('page', i.toString());
        const entityBatch = await GithubApi.fetchOrNull<T[]>(pathNoParams + '?' + params.toString());
        if (entityBatch === null) return EMPTY;
        for (let entity of entityBatch) {
          entities.push(entity);
        }
      }
      return from(entities);
    })());
  }
}

type Links = {
  next: Link;
  prev: Link;
  last: Link;
}
const linkPartRegex = /<(?<url>[^<>]+)>; rel="(?<rel>\w+)"/;

/**
 * link: <https://api.github.com/repositories/24841635/labels?page=2>; rel="next", <https://api.github.com/repositories/24841635/labels?page=2>; rel="last"
 * @param header
 */
function parseLinkHeader(header: string): Links {
  const parts = header.split(', ');
  const links: Partial<Links> = {};
  for (let part of parts) {
    const groups = part.match(linkPartRegex)!.groups!;
    const params = new URLSearchParams(groups.url.split('?')[1]);
    links[groups.rel as keyof Links] = {
      page: parseInt(params.get('page')!),
      url: groups.url
    } as Link;
  }
  return links as Links;
}
