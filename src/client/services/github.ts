import { from, Observable } from 'rxjs';
import { hoursToSeconds } from 'date-fns';
import { mergeAll, mergeMap } from 'rxjs/operators';
import { flattenDeferred } from '../../lib/asyncUtils';
import { timeCachedFetch } from '../utils/cachedFetch';


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
  constructor() {
  }

  static async fetch(path: string, options?: RequestInit) {
    return (await GithubApi.fetchFull(path, options)).json();
  }

  private static async fetchFull(path: string, options?: RequestInit) {
    const url = new URL(path, 'https://api.github.com');
    const res = await timeCachedFetch(hoursToSeconds(4))(url, {
      ...options,
      headers: {
        ...options?.headers,
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${import.meta.env.VITE_GITHUB_PERSONAL_ACCESS_TOKEN}`
      }
    });
    return res;
  }


  static async fetchPaginatedEntityCount(path: string): Promise<number> {
    const res = await GithubApi.fetchFull(`${path}?per_page=100`);
    const header = res.headers.get('Link');
    if (!header) {
      return (await res.json()).length;
    }
    const links = parseLinkHeader(header);
    const numPages = links.last.page;
    const resLast = await GithubApi.fetchFull(links.last.url);
    const lastPageCount = (await resLast.json()).length;
    return (numPages - 1) * 100 + lastPageCount;
  }

  static fetchPaginated(path: string): Observable<any> {
    return flattenDeferred((async () => {
      const initialRes = await GithubApi.fetchFull(`${path}?per_page=100`);
      let header = initialRes.headers.get('Link')!;
      // no other pages, return early
      if (!header) return from(await initialRes.json());
      const links = parseLinkHeader(header);
      const pagePromises: Promise<any[]>[] = [];
      const params = new URLSearchParams(links.last.url.split('?')[1]);
      const pathNoParams = path.split('?')[0];
      for (let i = 2; i <= links.last.page; i++) {
        params.set('page', i.toString());
        pagePromises.push(GithubApi.fetch(pathNoParams + '?' + params.toString()));
      }

      return from([initialRes.json(), ...pagePromises] as Promise<any[]>[]).pipe(
        mergeAll(),
        mergeMap(entities => from(entities))
      );
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
