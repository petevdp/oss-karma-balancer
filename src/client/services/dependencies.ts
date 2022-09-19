import { isNonNulled } from 'lib/typeUtils';
import { LocalStorageCache } from '../utils/LocalStorageCache';
import deepEquals from 'lodash/isEqual';
import semverMaxSatisfying from 'semver/ranges/max-satisfying';
import semverCompare from 'semver/functions/compare';
import { $D } from 'rxjs-debug';
import testRepo from '../../../scratches/test-repo.json';
import {
  concat,
  EMPTY,
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
  shareReplay,
  tap,
  toArray,
  startWith,
  catchError
} from 'rxjs/operators';

import { NpmApi, PackageJson } from './npm';
import { Branch, GitBlob, GithubApi, Label, Repo, Tree } from './github';
import { hoursToSeconds } from 'date-fns';
import {
  flattenDeferred, makeCold,
  scanChangesToMap,
  scanToMap
} from '../../lib/asyncUtils';
import { OneToManyMap, upsertEltOneToMany } from '../../lib/dataStructures';
import { logger } from '../../server/services/logger';

//region Types
type Dep = string;

type RecursiveDependency = {
  dep: Dep;
  path: Dep[];
}
type DepWithPaths = { name: string; paths: Dep[][] }
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
//endregion

const githubRepoRegex = /(git\+)?(https|ssh|git):?\/\/(www\.)?(git@)?github.com\/(?<fullName>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/;
const depCache = new LocalStorageCache<DependencyDetails[]>('userDependencies', hoursToSeconds(4));
let recursiveDependencyCache = new Map<string, Observable<RecursiveDependency>>();

export async function cachedFetchUserDependencies(username: string) {
  return depCache.retrieve(username, () => fetchUserDependencies(username));
}

async function fetchUserDependencies(username: string) {
  // let repos = await GithubApi.fetch(`/users/${username}/repos`) as Repo[];
  const repos = [testRepo] as unknown as Repo[];
  const repoPackageNames = new Map<string, string>();
  const dep$ = from(repos).pipe(
    mergeMap((repo) => {
      const packageJsons = resolveRepoPackageJsons(repo);
      packageJsons.subscribe((packageJson) => {
        if (repoPackageNames.has(packageJson.name)) {
          debugger;
        }
        repoPackageNames.set(packageJson.name, repo.full_name)
      });
      return resolvePackageJsonDependencies(packageJsons).pipe(groupDependencyPathsByDepName());
    }),
    shareReplay(),
    // catchError((err, o) => {
    // })
  );

  dep$.subscribe({
    complete: () => console.log('dep completed'),
    next: (d) => {
      // debugger;
    }
  });

  const depToRepoPromise = (async function mapDepsToRepo() {

    // after this expression repoToPackageJsonNames is now guaranteed to be populated, since we waited for dep$ complete
    // const depsByRootDependency = await lastValueFrom(dep$.pipe(
    //   scan((map, dep) => {
    //     for (let depPath of dep.paths) {
    //       const rootDepName = depPath[0][0];
    //       upsertEltOneToMany(rootDepName, dep.name, map);
    //     }
    //     return map;
    //   }, new Map<string, string[]>),
    //   startWith(new Map() as OneToManyMap<string, string>)
    // ));
    //
    const depToRepoMap: OneToManyMap<string, string> = new Map();
    // for (let repo of repos) {
    //   for (let packageName of repoToPackageJsonNames.get(repo.full_name)!) {
    //     const deps = depsByRootDependency.get(packageName)!;
    //     for (let dep of deps) {
    //       upsertEltOneToMany(dep, repo.full_name, depToRepoMap);
    //     }
    //   }
    // }
    return depToRepoMap;
  })();

  const arr = await lastValueFrom(dep$.pipe(
    mergeMap(dep => getDepDetails(dep, dep.paths.map(path => repoPackageNames.get(path[0])!))),
    filter(isNonNulled),
    toArray()
  ));
  return arr;
}


function resolveRepoPackageJsons(repo: Repo): Observable<PackageJson> {
  return flattenDeferred((async function resolvePackageJson() {
    let branch: Branch;
    let tree: Tree;
    try {
      branch = (await GithubApi.fetch(`/repos/${repo.full_name}/branches/${repo.default_branch}`)) as Branch;
      if (!branch || (branch as unknown as any).message === 'Branch not found') return EMPTY;
      tree = (await GithubApi.fetch(`${branch.commit.commit.tree.url}?recursive=1`)) as Tree;
    } catch (err) {
      return EMPTY;
    }

    const packageJsonBlobs = tree.tree.filter(blob => blob.path.endsWith('package.json'));

    return from(packageJsonBlobs).pipe(
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
      tap(pkg => console.log('found pkg json ' + pkg.name)),
      catchError((err) => {
        throw err;
      })
    );
  })());
}

// TODO: validate package json contents
function resolvePackageJsonDependencies(packageJson$: Observable<PackageJson>): Observable<RecursiveDependency> {
  const dep$ = packageJson$.pipe(
    map((packageJson): Observable<RecursiveDependency> => {
      let dependencies: Dep[] = [];
      if (packageJson.dependencies) {
        dependencies = Object.keys(packageJson.dependencies);
      }
      if (packageJson.devDependencies) {

        dependencies = Object.keys(packageJson.devDependencies);
      }
      const rootDepPath: Dep[] = [packageJson.name];
      return from(new Set(dependencies)).pipe(mergeMap(dep => resolvePackageDependenciesRecursive(dep, rootDepPath)));
    }),
    catchError((err) => {
      debugger;
      throw err;
    }),
    share(),
    mergeAll()
  );
  return dep$;
}

function resolvePackageDependenciesRecursive(parentDep: Dep, path: Dep[] = [], depth = 0): Observable<RecursiveDependency> {
  if (depth === 2) {
    return EMPTY;
  }
  const parentDepName = parentDep;
  if (recursiveDependencyCache.has(parentDep)) {
    return recursiveDependencyCache.get(parentDep)!;
  }
  console.log('depth: ', depth);
  console.log('computing ', parentDep);
  const out = flattenDeferred((async (): Promise<Observable<RecursiveDependency>> => {
    const npmPackageRegistry = await NpmApi.package(parentDepName);
    if (!npmPackageRegistry || !npmPackageRegistry.versions || Object.keys(npmPackageRegistry.versions).length === 0) return EMPTY;
    const maxVersion = Object.keys(npmPackageRegistry.versions).reduce((max, v) => semverCompare(max, v) == 1 ? max : v, '0.0.0');
    if (!maxVersion) return EMPTY as Observable<RecursiveDependency>;
    const packageVersion = npmPackageRegistry.versions[maxVersion];
    let deps: Dep[] = [];
    if (packageVersion.dependencies) deps = Object.keys(packageVersion.dependencies);
    if (packageVersion.devDependencies) deps = [...deps, ...Object.keys(packageVersion.devDependencies)];
    const recDeps = deps.map(dep => ({
      dep,
      path: [...path, parentDep]
    }) as RecursiveDependency);
    return concat(
      recDeps,
      from(recDeps).pipe(mergeMap(recDep => resolvePackageDependenciesRecursive(recDep.dep, recDep.path, depth + 1)))
    ).pipe(shareReplay());
  })());
  recursiveDependencyCache.set(parentDep, out);
  return out;
}

function groupDependencyPathsByDepName() {
  return (recDep$: Observable<RecursiveDependency>): Observable<DepWithPaths> => {
    return recDep$.pipe(
      scan(
        (depMap, recDep) => upsertEltOneToMany(recDep.dep, recDep.path, depMap),
        new Map<string, Dep[][]>()
      ),
      startWith(new Map<string, Dep[][]>),
      last(),
      mergeMap(depMap => from([...depMap.entries()].map(([depName, paths]) => ({
        name: depName,
        paths
      })))),
      catchError(err => {
        debugger;
        throw err;
      })
    );
  };
}

async function getDepDetails(dep: DepWithPaths, dependentRepos: string[]) {
  const npmPackagePromise = NpmApi.package(dep.name);
  const downloadsPromise = NpmApi.fetchLastWeekDownloadsCount(dep.name);
  const repo = await npmPackagePromise.then(async npmPackage => {
    if (!npmPackage?.repository) return null;
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

  let contributorsPromise = GithubApi.fetchPaginatedEntityCount(`/repos/${repo.full_name}/contributors`);
  const out = {
    name: dep.name,
    downloadsLastWeek: (await downloadsPromise),
    yourDependentRepos: dependentRepos,
    contributors: await contributorsPromise,
    projectType: 'npm',
    lastUpdate: new Date(),
    labels: await labelsPromise,
    openIssues: repo.open_issues_count
  } as DependencyDetails;

  return out;
}
