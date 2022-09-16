import { isNonNulled } from 'lib/typeUtils';
import {LocalStorageCache} from '../utils/localStorageCache';
import { from, lastValueFrom, Observable } from 'rxjs';
import {
  distinct,
  filter,
  map,
  mergeAll,
  tap,
  mergeMap,
  toArray
} from 'rxjs/operators';

import { NpmApi, PackageJson } from './npm';
import {
  Branch,
  GitBlob,
  GithubApi,
  Label,
  Repo,
  Tree
} from './github';
import { hoursToSeconds } from 'date-fns';

export type DependencyDetails = {
  name: string;
  downloadsLastWeek: bigint;
  yourDependentRepos: string[];
  contributors: number;
  lastUpdate: Date;
  openIssues: number;
  projectType: 'npm',
  labels: string[];
}
const githubRepoRegex = /(git\+)?(https|ssh|git):?\/\/(www\.)?(git@)?github.com\/(?<fullName>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/;
const depCache = new LocalStorageCache('userDependencies', hoursToSeconds(4));
export async function cachedFetchUserDependencies(username: string) {
  return depCache.retrieve(username, () => fetchUserDependencies(username))
}

async function fetchUserDependencies(username: string) {
  const repos = await GithubApi.fetch(`/users/${username}/repos`) as Repo[];
  let depMap = new Map<string, Set<string>>();
  const repoMap = new Map<string, Repo>();
  const package$ = from(repos).pipe(
    filter(repo => repo.size > 0),
    tap(repo => repoMap.set(repo.full_name, repo)),
    mergeMap(async (repo) => {
      const branch = (await GithubApi.fetch(`/repos/${repo.full_name}/branches/${repo.default_branch}`)) as Branch;
      const tree = (await GithubApi.fetch(`${branch.commit.commit.tree.url}?recursive=1`)) as Tree;
      const packageJsonBlobs = tree.tree.filter(blob => blob.path.endsWith('package.json'));
      return from(packageJsonBlobs).pipe(
        mergeMap(async (blobRef): Promise<Observable<string> | null> => {
          const blob = (await GithubApi.fetch(blobRef.url)) as GitBlob;
          let packageJson: PackageJson;
          try {
            packageJson = JSON.parse(atob(blob.content)) as PackageJson;
          } catch (err: any) {
            console.warn('could not parse blob content:', {
              repo: repo.name,
              name: blobRef.path,
              content: blob.content
            });
            console.warn(err);
            return null;
          }
          let dependencies: string[] = [];
          if (packageJson.dependencies) {
            dependencies = Object.keys(packageJson.dependencies);
          }
          if (packageJson.devDependencies) {

            dependencies = Object.keys(packageJson.devDependencies);
          }
          for (let dep of dependencies) {
            let existing = depMap.get(dep);
            if (!existing) {
              existing = new Set<string>();
              depMap.set(dep, existing);
            }
            existing.add(repo.name);
          }
          return from(dependencies);
        }),
        filter(isNonNulled),
        mergeAll()
      );
    }),
    mergeAll(),
    distinct(),
    mergeMap(async (dep): Promise<DependencyDetails | null> => {
      const npmPackagePromise = NpmApi.package(dep);
      const downloadsPromise = NpmApi.fetchLastWeekDownloadsCount(dep);
      const repo = await npmPackagePromise.then(async npmPackage => {
        if (!npmPackage.repository) return null;
        const url = typeof npmPackage.repository === 'string' ? npmPackage.repository : npmPackage.repository.url;
        const match = url.match(githubRepoRegex);
        if (!match) {
          throw new Error(`couldn't match ${url}`);
        }
        let fullName = match!.groups!.fullName;
        if (fullName.endsWith('.git')) {
          fullName = fullName.slice(0, fullName.length - 4);
        }

        return await GithubApi.fetch(`/repos/${fullName}`) as Repo;
      });
      if (!repo || (repo as unknown as any).message === 'Not Found') {
        return null;
      }

      const labelsPromise = lastValueFrom(GithubApi.fetchPaginated(`/repos/${repo.full_name}/labels`).pipe(
        map((label) => (label as Label).name),
        toArray()
      ));

      return {
        name: dep,
        downloadsLastWeek: (await downloadsPromise),
        yourDependentRepos: [...depMap.get(dep)!.values()],
        contributors: await GithubApi.fetchPaginatedEntityCount(`/repos/${repo.full_name}/contributors`),
        projectType: 'npm',
        lastUpdate: new Date(),
        labels: await labelsPromise,
        openIssues: repo.open_issues_count
      };
    }),
    filter(isNonNulled)
  );

  return lastValueFrom(package$.pipe(toArray()));
}
