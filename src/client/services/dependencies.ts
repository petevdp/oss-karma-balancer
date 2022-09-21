import { isNonNulled } from 'lib/typeUtils';
import {
  concat,
  EMPTY,
  firstValueFrom,
  from,
  lastValueFrom,
  Observable, of
} from 'rxjs';
import {
  catchError,
  filter,
  last,
  map,
  mergeMap,
  scan,
  share,
  shareReplay,
  startWith,
  tap,
  toArray
} from 'rxjs/operators';

import { NpmApi, PackageJson } from './npm';
import { Branch, GitBlob, GithubApi, Repo, Tree } from './github';
import { hoursToSeconds } from 'date-fns';
import { flattenDeferred } from '../../lib/asyncUtils';
import { addOneToMany, OneToManyMap } from '../../lib/dataStructures';
import { TaskQueue } from '../utils/taskQueue';
import { joinUrl } from '../utils/joinUrl';
import { FetchFailedError } from '../utils/cachedFetch';
import { LocalStorageCache } from '../utils/LocalStorageCache';

//region Types
type Dep = string;
type Path = string;

type RecursiveDependency = {
  dep: Dep;
  path: Dep[];
}
type DependencyWithPaths = { name: string; paths: Dep[][] }
export type DependencyDetails = {
  name: string;
  downloadsLastWeek: bigint | null;
  yourDependentRepos: string[];
  contributors: number;
  lastUpdate: Date;
  openIssues: number;
  projectType: 'npm',
  labels: string[];
}
//endregion

let recursiveDependencyCache = new Map<string, Observable<RecursiveDependency>>();
export type DependencyMessage = {
  type: 'fetchUserDependencies';
  username: string
}

export type ProgressMessage = {
  type: 'progress',
  percentDone: number;
}

const progressSegments = {
  loadRepos: 0.25,
  resolveDependencies: 0.25,
  loadDetails: 0.25
};

onmessage = (e) => {
  console.log('dependencies.ts received event: ', e);
  if (e.data.type === 'fetchUserDependencies') {
    const msg = e.data as DependencyMessage;
    fetchUserDependencies(msg.username).then((deps) => postMessage(deps));
  }
};

const repoQueue = new TaskQueue(1);

async function fetchUserDependencies(username: string) {
  try {
    let reposFetchOut = await GithubApi.fetchFull<Repo[]>(`/users/${username}/repos`);
    if (reposFetchOut.type === 'error') {
      throw new Error('unable to resolve user repos');
    }

    // const repos = [testRepo] as unknown as Repo[];
    const repoPackageNames = new Map<string, string>();

    const dep$ = from(reposFetchOut.value.data).pipe(
      mergeMap((repo) => {
          console.log('repoQueue: ', { active: repoQueue.active$.value.size });
          return repoQueue.enqueueTask(() => {
            const packageJsons = resolveRepoPackageJsons(repo).pipe(share());
            packageJsons.subscribe(([path, packageJson]) => {
              repoPackageNames.set(path, repo.full_name);
            });
            return resolvePackageJsonDependencies(packageJsons, repo);
          });
        }
      )
    );


    const arr = await lastValueFrom(dep$.pipe(
      mergeMap(dep => getDepDetails(dep)),
      filter(isNonNulled),
      toArray()
    ));
    return arr;
  } catch (err) {
    console.log(err);
    throw err;
  }
}


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
        return [blobRef.path, packageJson] as [Path, PackageJson];
      }),
      filter(isNonNulled),
      tap(([path, pkg]) => console.log('found pkg json ' + pkg.name)),
      catchError((err) => {
        throw err;
      })
    );
  })());
}

const depQueue = new TaskQueue(2);

// TODO: validate package json contents
function resolvePackageJsonDependencies(packageJson$: Observable<[Path, PackageJson]>, repo: Repo): Observable<RecursiveDependency> {
  const dep$ = packageJson$.pipe(
    mergeMap(([path, packageJson]): Observable<RecursiveDependency> => {
      return depQueue.enqueueTask(() => {
        let dependencies: Dep[] = [];
        if (packageJson.dependencies) {
          dependencies = Object.keys(packageJson.dependencies);
        }
        if (packageJson.devDependencies) {

          dependencies = Object.keys(packageJson.devDependencies);
        }
        const rootDepPath: Dep[] = [joinUrl(joinUrl(repo.full_name, path), packageJson.name)];

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
      });

    }),
    catchError((err) => {
      debugger;
      throw err;
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

const githubRepoRegex = /(git\+)?(https|ssh|git):?\/\/(www\.)?(git@)?github.com\/(?<fullName>[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/;
const depDetailsQueue = new TaskQueue(10);

function getDepDetails({ dep }: RecursiveDependency) {
  return depDetailsQueue.enqueueTask(async () => {
    const npmPackagePromise = NpmApi.package(dep);
    const downloadsPromise = NpmApi.fetchLastWeekDownloadsCount(dep);
    let repo: Repo | null;
    try {
      repo = await npmPackagePromise.then(async npmPackage => {
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

        return GithubApi.repo(fullName);
      });
      if (!repo) return null;

      // const labelsPromise = lastValueFrom(GithubApi.fetchPaginated(`/repos/${repo.full_name}/labels`).pipe(
      //   map((label) => (label as Label).name),
      //   toArray()
      // ));
      //
      const contributorsPromise = GithubApi.fetchPaginatedEntityCount(`/repos/${repo.full_name}/contributors`);
      let contributors = await contributorsPromise;
      if (!isNonNulled(contributors)) return null;

      const out: DependencyDetails = {
        name: dep,
        downloadsLastWeek: (await downloadsPromise),
        yourDependentRepos: [],
        contributors: await contributors,
        projectType: 'npm',
        lastUpdate: new Date(),
        // labels: await labelsPromise,
        labels: [],
        openIssues: repo.open_issues_count
      };
      return out;
    } catch (err) {
      if (err instanceof FetchFailedError) {
        return null;
      }
      throw err;
    }
  });
}

