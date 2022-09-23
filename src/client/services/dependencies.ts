import { isNonNulled } from 'lib/typeUtils';
import * as _ from 'lodash-es';
import {
  concat,
  EMPTY,
  firstValueFrom,
  from,
  lastValueFrom,
  Observable
} from 'rxjs';
import {
  catchError,
  filter,
  first,
  last,
  map,
  mergeAll,
  mergeMap,
  scan,
  share,
  shareReplay,
  startWith,
  toArray
} from 'rxjs/operators';

import { NpmApi, PackageJson } from './npm';
import { Branch, GitBlob, GithubApi, Repo, Tree } from './github';
import { flattenDeferred } from '../../lib/asyncUtils';
import { addOneToMany, OneToManyMap } from '../../lib/dataStructures';
import { queuedMerge, TaskQueue } from '../utils/taskQueue';
import { joinUrl } from '../utils/joinUrl';
import { FetchFailedError } from '../utils/cachedFetch';
import { InMemoryCache, mergeCacheRetrieval } from '../utils/inMemoryCache';
import { Future } from '../../lib/future';

onmessage = (e) => {
  console.log('dependencies.ts received event: ', e);
  if (e.data.type === 'fetchUserDependencies') {
    const msg = e.data as DependencyMessage;
    fetchUserDependencies(msg.username, { includeForked: msg.includeForked }).then((deps) => postMessage(deps));
  }
};

//region Types
type Dep = string;
type Path = string;

type RecursiveDependency = {
  dep: Dep;
  path: Dep[];
}
type DependencyWithPaths = { name: string; paths: Dep[][] }
export type DependencyDetails = {
  repoName: string;
  packages: string[];
  yourDependentRepos: string[];
  dependencies: { package: string; repo: string; }[]
  contributors: number;
  lastUpdate: Date;
  openIssues: number;
  projectType: 'npm',
  labels: string[];
  topics: string[];
  forks: number;
  language: string;
  repoSize: number;
  stars: number;
}

export type DependencyMessage = {
  type: 'fetchUserDependencies';
  username: string;
  includeForked: boolean;
}

export type ProgressMessage = {
  type: 'progress',
  percentDone: number;
}

type FetchDepsOptions = {
  includeForked: boolean;
}

//endregion

//region Constants
const PROGRESS_SEGMENTS = {

  loadRepos: 0.25,
  resolveDependencies: 0.25,
  loadDetails: 0.25
};
const DEFAULT_OPTIONS: FetchDepsOptions = {
  includeForked: false
};
const GITHUB_REPO_REGEX = /(git\+)?(https|ssh|git):?\/\/(www\.)?(git@)?github.com\/(?<fullName>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/;
//endregion

//region Caches
let recursiveDependencyCache = new Map<string, Observable<RecursiveDependency>>();
const userRepoDependencyCache = new InMemoryCache<Observable<RecursiveDependency>>();
const dependencyDetailsCache = new InMemoryCache<DependencyDetails>();
//endregion

//region Queues
const depDetailsQueue = new TaskQueue(10);
const repoQueue = new TaskQueue(4);
const depQueue = new TaskQueue(10);

//endregion

async function fetchUserDependencies(username: string, options: FetchDepsOptions) {
  const repoPackageNames: Map<string, string> = new Map();
  let allReposRead = new Future<void>();

  async function getDepRepoDetails(repo: Repo, dependencies: DependencyWithPaths[]) {

      const contributorsPromise = GithubApi.fetchPaginatedEntityCount(`/repos/${repo.full_name}/contributors`);
      let contributors = await contributorsPromise;
      if (!isNonNulled(contributors)) return null;

      let dependencyMap = await allReposRead.then(() => {
        const dependencyMap = new Map<string,string>();
        for (let dep of dependencies) {
          for (let path of dep.paths) {
            const repoName = repoPackageNames.get(path[0])!
            dependencyMap.set(repoName, dep.name);
          }
        }
        return dependencyMap;
      });

      const out: DependencyDetails = {
        repoName: repo.full_name,
        packages: _.uniq([...dependencyMap.values()]),
        yourDependentRepos: _.uniq([...dependencyMap.keys()]),
        dependencies: [...dependencyMap.entries()].map(([r,p]) => ({repo: r, package: p})),
        contributors: await contributors,
        projectType: 'npm',
        lastUpdate: new Date(),
        // labels: await labelsPromise,
        labels: [],
        openIssues: repo.open_issues_count,
        forks: repo.forks,
        topics: repo.topics,
        stars: repo.stargazers_count,
        repoSize: repo.size,
        language: repo.language
      };
      return out;
  }

  const repos = await GithubApi.repos(username, options.includeForked);

  let reposRead = 0;
  const dependency$ = from(repos).pipe(
    mergeCacheRetrieval(userRepoDependencyCache, (repo) => repo.full_name, async (repo) => {
      const packageJsons = repoQueue.enqueueTask(() => {
        return resolveRepoPackageJsons(repo).pipe(share());
      });
      firstValueFrom(packageJsons.pipe(
        toArray()
      )).then(packageJsons => {
        for (let [path] of packageJsons) {
          if (repo.name === 'atdatabases') {
            console.log(`adding ${path} to `, repo.name);
          }
          repoPackageNames.set(path, repo.full_name);
        }
        reposRead++;
        if (reposRead === repos.length) {
          allReposRead.resolve();
        }
      });

      return resolvePackageJsonDependencies(packageJsons, repo).pipe(shareReplay());
    }),
    mergeAll()
  );


  const arr = await lastValueFrom(dependency$.pipe(
    groupDependencyPathsByDepName(),
    groupDependencyByGithubRepo(),
    mergeCacheRetrieval(dependencyDetailsCache, ([repo]) => repo.full_name, ([repo,dep]) => {
      return firstValueFrom(depDetailsQueue.enqueueTask(() => getDepRepoDetails(repo,dep)));
    }),
    filter(isNonNulled),
    toArray()
  ));
  return arr;
}

//region UserDependencyFuncs
function resolveRepoPackageJsons(repo: Repo): Observable<[Path, PackageJson]> {
  return flattenDeferred((async function resolvePackageJson() {
    const branch = (await GithubApi.fetchOrNull<Branch>(`/repos/${repo.full_name}/branches/${repo.default_branch}`));
    if (!branch || (branch as unknown as any).message === 'Branch not found') return EMPTY;
    const tree = (await GithubApi.fetchOrNull<Tree>(`${branch.commit.commit.tree.url}?recursive=1`));
    if (!tree || (tree as unknown as any).message === 'Tree not found') return EMPTY;


    const packageJsonBlobs = tree.tree.filter(blob => blob.path.endsWith('package.json'));

    return from(packageJsonBlobs).pipe(
      mergeMap(async (blobRef): Promise<[Path, PackageJson] | null> => {
        const blob = (await GithubApi.fetchOrNull<GitBlob>(blobRef.url));
        if (!blob) return null;

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
        if (!packageJson.name) return null;
        if (!(packageJson.dependencies || packageJson.devDependencies)) return null;
        const path = getRootDepPath(repo.full_name, blobRef.path, packageJson.name);
        return [path, packageJson] as [Path, PackageJson];
      }),
      filter(isNonNulled),
      catchError((err) => {
        throw err;
      })
    );
  })());
}

function extractPackageName(rootDepPath: string) {
  return rootDepPath.split('__packageName__/')[1];
}

function getRootDepPath(repoName: string, filePath: string, packageName: string) {
  return joinUrl(repoName, filePath, packageName);
}

// TODO: validate package json contents
function resolvePackageJsonDependencies(packageJson$: Observable<[Path, PackageJson]>, repo: Repo): Observable<RecursiveDependency> {
  const dep$ = packageJson$.pipe(
    queuedMerge(depQueue, ([path, packageJson]): Observable<RecursiveDependency> => {
      let dependencies: Dep[] = [getRootDepPath(repo.full_name, path, packageJson.name)];
      if (packageJson.dependencies) {
        dependencies = Object.keys(packageJson.dependencies);
      }
      if (packageJson.devDependencies) {

        dependencies = [...dependencies, ...Object.keys(packageJson.devDependencies)];
      }
      const rootDepPath: string[] = [path];

      const dep$ = from(dependencies).pipe(
        map((dep): RecursiveDependency => ({ dep, path: rootDepPath }))
      );

      const subDep$ = from(new Set(dependencies)).pipe(
        mergeMap(dep => {
          return resolvePackageDependenciesRecursive(dep, rootDepPath);
        })
      );

      return concat(
        dep$,
        subDep$
      );
    })
  );
  return dep$;
}

function resolvePackageDependenciesRecursive(parentDep: Dep, path: Dep[] = [], depth = 0): Observable<RecursiveDependency> {
  if (depth === 0) {
    return EMPTY;
  }
  const parentDepName = parentDep;
  if (recursiveDependencyCache.has(parentDep)) {
    return recursiveDependencyCache.get(parentDep)!;
  }
  console.log('depth: ', depth);
  console.log('computing ', parentDep);
  const out = flattenDeferred((async () => {
    try {
      const packageVersion = await NpmApi.package(parentDepName);
      if (!packageVersion) return EMPTY;
      let deps: Dep[] = [];
      if (packageVersion.dependencies) deps = Object.keys(packageVersion.dependencies);
      if (packageVersion.devDependencies) deps = [...deps, ...Object.keys(packageVersion.devDependencies)];
      const recDeps = deps.map(dep => ({
        dep,
        path: [...path, parentDep]
      }) as RecursiveDependency);
      return concat(
        recDeps,
        from(recDeps).pipe(
          mergeMap(recDep => resolvePackageDependenciesRecursive(recDep.dep, recDep.path, depth + 1))
        )
      ).pipe(shareReplay());
    } catch (err) {
      if (err instanceof FetchFailedError) return EMPTY;
      throw err;
    }
  })());

  recursiveDependencyCache.set(parentDep, out);
  return out;
}

function groupDependencyPathsByDepName() {
  return (recursiveDependency$: Observable<RecursiveDependency>): Observable<DependencyWithPaths> => {
    return recursiveDependency$.pipe(
      scan(
        (pathsMap, recDep) => addOneToMany(recDep.dep, recDep.path, pathsMap),
        new Map() as OneToManyMap<string, string[]>
      ),
      // ensure we start with something in case no dependencies are received
      startWith(new Map() as OneToManyMap<string, string[]>),
      last(),
      mergeMap(pathsMap => from(pathsMap.entries()).pipe(map(([depName, paths]) => ({
        name: depName,
        paths
      })))),
      catchError(err => {
        throw err;
      })
    );
  };
}

/**
 * Fetches and groups dependencies according to their linked repos
 * @param dep$
 */
function groupDependencyByGithubRepo() {
  return (dep$: Observable<DependencyWithPaths>): Observable<[Repo, DependencyWithPaths[]]> => {
    const repos: Map<string, Repo> = new Map();
    const depMap: OneToManyMap<string, DependencyWithPaths> = new Map();
    return dep$.pipe(
      mergeMap(async (dep) => {
        let repo: Repo | null;
        {
          const npmPackage = await NpmApi.package(dep.name);
          if (!npmPackage?.repository) return null;
          const url = typeof npmPackage.repository === 'string' ? npmPackage.repository : npmPackage.repository.url;
          const match = url.match(GITHUB_REPO_REGEX);
          if (!match) {
            return null;
          }
          let fullName = match!.groups!.fullName;
          if (fullName.endsWith('.git')) {
            fullName = fullName.slice(0, fullName.length - 4);
          }
          repo = await GithubApi.repo(fullName);
          if (!repo) return null;
        }
        repos.set(repo.full_name, repo);
        addOneToMany(repo.full_name, dep, depMap);
        return dep;
      }),
      filter(isNonNulled),
      last(),
      mergeMap(() => (
        from(depMap.entries()).pipe(
          map(([repoName, deps]): [Repo, DependencyWithPaths[]] => [repos.get(repoName)!, deps])
        )
      ))
    );
  };
}

//endregion


