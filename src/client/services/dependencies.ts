import { isNonNulled } from 'lib/typeUtils';
import { LocalStorageCache } from '../utils/LocalStorageCache';
import deepEquals from 'lodash/isEqual';
import semverMaxSatisfying from 'semver/ranges/max-satisfying';
import {
  concat,
  EMPTY,
  firstValueFrom,
  from,
  lastValueFrom,
  Observable
} from 'rxjs';
import {
  scan,
  distinct,
  last,
  filter,
  map,
  mergeAll,
  mergeMap,
  share,
  tap,
  toArray
} from 'rxjs/operators';

import { NpmApi, PackageJson } from './npm';
import { Branch, GitBlob, GithubApi, Label, Repo, Tree } from './github';
import { hoursToSeconds } from 'date-fns';
import { flattenDeferred } from '../../lib/asyncUtils';
import { OneToManyMap, upsertEltOneToMany } from '../../lib/dataStructures';

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
  return depCache.retrieve(username, () => fetchUserDependencies(username));
}

type DepWithPaths = { name: string; paths: Dep[][]; repoFullName: string; }

async function resolveRepoDependencies(repo: Repo, visitedDeps?: Set<string>): Promise<Observable<RecursiveDependency>> {
  if (visitedDeps === null) visitedDeps = new Set();
  const branch = (await GithubApi.fetch(`/repos/${repo.full_name}/branches/${repo.default_branch}`)) as Branch;
  const tree = (await GithubApi.fetch(`${branch.commit.commit.tree.url}?recursive=1`)) as Tree;
  const packageJsonBlobs = tree.tree.filter(blob => blob.path.endsWith('package.json'));
  const packageJsons: PackageJson[] = await firstValueFrom(from(packageJsonBlobs).pipe(
    mergeMap(async (blobRef): Promise<PackageJson | null> => {
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
      return packageJson;
    }),
    filter(isNonNulled),
    toArray()
  ));

  return from(packageJsons).pipe(
    mergeMap(async (packageJson): Promise<Observable<RecursiveDependency>> => {
      let dependencies: Dep[] = [];
      if (packageJson.dependencies) {
        dependencies = Object.entries(packageJson.dependencies);
      }
      if (packageJson.devDependencies) {

        dependencies = Object.entries(packageJson.devDependencies);
      }
      const rootDepPath: Dep[] = [[packageJson.name, packageJson.version]]
      return from(new Set(dependencies)).pipe(mergeMap(dep => resolvePackageDependenciesRecursive(dep, rootDepPath)));
    }),
    mergeAll(),
  );
}

function groupDependencyPathsByDepName(repoFullName: string) {
  return (recDep$: Observable<RecursiveDependency>): Observable<DepWithPaths> => {
    return recDep$.pipe(
      scan(
        (depMap, recDep) => upsertEltOneToMany(recDep.dep[0], [recDep.dep, ...recDep.path], depMap),
        new Map<string, Dep[][]>()
      ),
      last(),
      mergeMap(depMap => from([...depMap.entries()].map(([depName, paths]): DepWithPaths => ({
        name: depName,
        paths,
        repoFullName
      }))))
    );
  };
}

type Dep = [string, string];

type RecursiveDependency = {
  dep: Dep;
  path: Dep[];
}

function resolvePackageDependenciesRecursive(parentDep: Dep, path: Dep[] = []): Observable<RecursiveDependency> {
  const [parentDepName, parentDepVersion] = parentDep;
  return flattenDeferred((async (): Promise<Observable<RecursiveDependency>> => {
    const npmPackageRegistry = await NpmApi.package(parentDepName);
    const version = semverMaxSatisfying(Object.keys(npmPackageRegistry), parentDepVersion);
    if (!version) return EMPTY as Observable<RecursiveDependency>;
    const packageVersion = npmPackageRegistry.versions[version];
    // const version = npmPackageRegistry.versions[depVersion];
    let deps: Dep[] = [];
    if (packageVersion.dependencies) deps = Object.entries(packageVersion.dependencies);
    if (packageVersion.devDependencies) deps = [...deps, ...Object.entries(packageVersion.devDependencies)];
    const recDeps = deps.map(dep => ({
      dep,
      path: [...path, parentDep]
    }) as RecursiveDependency);
    return concat(
      recDeps,
      from(recDeps).pipe(mergeMap(recDep => resolvePackageDependenciesRecursive(recDep.dep, recDep.path))));
  })());
}

// async function resolveDependencyRepo(dep: string): Promise<Repo | null> {
//   const npmPackage = await NpmApi.package(dep);
//   if (!npmPackage.repository) return null;
//   const url = typeof npmPackage.repository === 'string' ? npmPackage.repository : npmPackage.repository.url;
//   const match = url.match(githubRepoRegex);
//   if (!match) {
//     return null;
//   }
//   let fullName = match!.groups!.fullName;
//   npmPackageRegistry.versions[depVersion];
//   if (fullName.endsWith('.git')) {
//     fullName = fullName.slice(0, fullName.length - 4);
//   }
//   const repo = await GithubApi.fetch(`/repos/${fullName}`) as Repo;
//   if (!repo || (repo as unknown as any).message === 'Not Found') {
//     return null;
//   }
//   return repo;
// }

// async function fetchUserDependencies(username: string) {
//   const repos = await GithubApi.fetch(`/users/${username}/repos`) as Repo[];
//   let depMap = new Map<string, Set<string>>();
//   const repoMap = new Map<string, Repo>();
//   const package$ = from(repos).pipe(
//     filter(repo => repo.size > 0),
//     tap(repo => repoMap.set(repo.full_name, repo)),
//     mergeMap(async (repo) => {
//       const branch = (await GithubApi.fetch(`/repos/${repo.full_name}/branches/${repo.default_branch}`)) as Branch;
//       const tree = (await GithubApi.fetch(`${branch.commit.commit.tree.url}?recursive=1`)) as Tree;
//       const packageJsonBlobs = tree.tree.filter(blob => blob.path.endsWith('package.json'));
//       return from(packageJsonBlobs).pipe(
//         mergeMap(async (blobRef): Promise<Observable<string> | null> => {
//           const blob = (await GithubApi.fetch(blobRef.url)) as GitBlob;
//           let packageJson: PackageJson;
//           try {
//             packageJson = JSON.parse(atob(blob.content)) as PackageJson;
//           } catch (err: any) {
//             console.warn('could not parse blob content:', {
//               repo: repo.name,
//               name: blobRef.path,
//               content: blob.content
//             });
//             console.warn(err);
//             return null;
//           }
//           let dependencies: string[] = [];
//           if (packageJson.dependencies) {
//             dependencies = Object.keys(packageJson.dependencies);
//           }
//           if (packageJson.devDependencies) {
//
//             dependencies = Object.keys(packageJson.devDependencies);
//           }
//           for (let dep of dependencies) {
//             let existing = depMap.get(dep);
//             if (!existing) {
//               existing = new Set<string>();
//               depMap.set(dep, existing);
//             }
//             existing.add(repo.name);
//           }
//           return from(dependencies);
//         }),
//         filter(isNonNulled),
//         mergeAll()
//       );
//     }),
//     mergeAll(),
//     distinct(),
//     mergeMap(async (dep): Promise<DependencyDetails | null> => {
//       const npmPackagePromise = NpmApi.package(dep);
//       const downloadsPromise = NpmApi.fetchLastWeekDownloadsCount(dep);
//       const repo = await npmPackagePromise.then(async npmPackage => {
//         if (!npmPackage.repository) return null;
//         const url = typeof npmPackage.repository === 'string' ? npmPackage.repository : npmPackage.repository.url;
//         const match = url.match(githubRepoRegex);
//         if (!match) {
//           return null;
//         }
//         let fullName = match!.groups!.fullName;
//         if (fullName.endsWith('.git')) {
//           fullName = fullName.slice(0, fullName.length - 4);
//         }
//
//         return await GithubApi.fetch(`/repos/${fullName}`) as Repo;
//       });
//       if (!repo || (repo as unknown as any).message === 'Not Found') {
//         return null;
//       }
//
//       const labelsPromise = lastValueFrom(GithubApi.fetchPaginated(`/repos/${repo.full_name}/labels`).pipe(
//         map((label) => (label as Label).name),
//         toArray()
//       ));
//
//       const out = {
//         name: dep,
//         downloadsLastWeek: (await downloadsPromise),
//         yourDependentRepos: [...depMap.get(dep)!.values()],
//         contributors: await GithubApi.fetchPaginatedEntityCount(`/repos/${repo.full_name}/contributors`),
//         projectType: 'npm',
//         lastUpdate: new Date(),
//         labels: await labelsPromise,
//         openIssues: repo.open_issues_count
//       } as DependencyDetails;
//
//       return out;
//     }),
//     filter(isNonNulled)
//   );
//
//   return lastValueFrom(package$.pipe(toArray()));
// }

async function fetchUserDependencies(username: string) {
  const repos = await GithubApi.fetch(`/users/${username}/repos`) as Repo[];
  const visitedDeps = new Set<string>();
  const dep$ = from(repos).pipe(mergeMap((repo) => {
      const repoDep$ = flattenDeferred(resolveRepoDependencies(repo, visitedDeps));
      return repoDep$.pipe(groupDependencyPathsByDepName(repo.full_name))
    }
  ));
}

async function getDepDetails(dep: DepWithPaths, depMap: OneToManyMap<string, string>) {
  const npmPackagePromise = NpmApi.package(dep.name);
  const downloadsPromise = NpmApi.fetchLastWeekDownloadsCount(dep.name);
  const repo = await npmPackagePromise.then(async npmPackage => {
    if (!npmPackage.repository) return null;
    const url = typeof npmPackage.repository === 'string' ? npmPackage.repository : npmPackage.repository.url;
    const match = url.match(githubRepoRegex);
    if (!match) {
      return null;
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

  const out = {
    name: dep.name,
    downloadsLastWeek: (await downloadsPromise),
    yourDependentRepos: depMap.get(depName)!,
    contributors: await GithubApi.fetchPaginatedEntityCount(`/repos/${repo.full_name}/contributors`),
    projectType: 'npm',
    lastUpdate: new Date(),
    labels: await labelsPromise,
    openIssues: repo.open_issues_count
  } as DependencyDetails;

  return out;
}

class Accumulated<T> {
  public readonly change$: Observable<T>;
  public readonly state: Map<string, T>;

  constructor(change$: Observable<T>, getKey: (elt: T) => string) {
    this.change$ = change$.pipe(share());
    this.state = new Map<string, T>();
    this.change$.subscribe(elt => {
      this.state.set(getKey(elt), elt);
    });
  }

  trackAll(): Observable<T> {
    return concat(
      from(this.state.values()),
      this.change$
    );
  }
}
