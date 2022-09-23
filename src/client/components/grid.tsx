import { DependencyDetails } from '../services/dependencies';
import { addOneToMany, OneToManyMap } from '../../lib/dataStructures';
import _ from 'lodash-es';
import * as svgs from './svgs';
import { Accessor, Component, createSignal, JSX } from 'solid-js';
import { useField } from 'solid-js-form';
import { from, Observable } from 'rxjs';
import { concatAll, map, toArray } from 'rxjs/operators';
import { isDefined } from '../../lib/typeUtils';
import { accumulateOutputSynchronous } from '../../lib/asyncUtils';

export type Filter<T> = (row: T) => boolean;

type GroupBy<T> = {
  getKey: (row: T) => string;
  transformRows?: (rows: T[]) => Partial<T>[];
}

function applyGroupBy<T>(groupBy: GroupBy<T>, rows: T[]) {
  const grouped: OneToManyMap<string, T> = new Map();
  for (let row of rows) {
    addOneToMany(groupBy.getKey(row), row, grouped);
  }

  let group$ = from(grouped.values());
  let groupRowPartial$: Observable<Partial<T>[]>;
  if (groupBy.transformRows) {
    groupRowPartial$ = group$.pipe(map(groupBy.transformRows));
  } else {
    groupRowPartial$ = group$;
  }

  let out: Partial<T>[] = accumulateOutputSynchronous(groupRowPartial$.pipe(concatAll()));

  return out!;
}

const groupBys: Record<string, GroupBy<DependencyDetails>> = {
  repoName: {
    getKey: col => col.repoName,
    transformRows: cols => {
      return cols.map((row, index) => {
        if (index === 0) return row;
        let mutRow: Partial<DependencyDetails> = { ...row };
        delete mutRow.repoName;
        delete mutRow.contributors;
        delete mutRow.openIssues;
        delete mutRow.projectType;
        delete mutRow.labels;

        return mutRow;
      });
    }
  }
};

export type SortDirection = 'asc' | 'desc';
export type SortSetting<T> = { col: keyof T; direction: SortDirection };

export const Grid: Component<{ rows: Accessor<DependencyDetails[]>; fromRepos: Accessor<string | undefined>; }> = (props) => {
  const [sortSetting, setSortSetting] = createSignal<SortSetting<DependencyDetails>>({
    col: 'repoName',
    direction: 'asc'
  });
  const filter = () => {
    const filters: Filter<DependencyDetails>[] = [];
    if (props.fromRepos()) {
      const fromRepos = props.fromRepos() as string;
      const repoNames = fromRepos.toLowerCase().split(',');
      filters.push((row) => _.intersection(row.yourDependentRepos.map(r => r.split('/')[1].toLowerCase()), repoNames).length > 0);
    }

    return (row: DependencyDetails) => {
      for (let filter of filters) {
        if (!filter(row)) return false;
      }
      return true;
    };
  };
  const filteredRows = () => props.rows().filter((row) => filter()(row));

  const sortedRows = () => filteredRows().sort((rowA, rowB) => {
    const valueA = rowA[sortSetting().col];
    const valueB = rowB[sortSetting().col];
    const direction = sortSetting().direction === 'asc' ? -1 : 1;
    if (['bigint', 'number', 'date'].includes(typeof valueA)) {
      let numA = valueA as number | bigint;
      if (!isDefined(numA)) numA = -Infinity;
      let numB = valueB as number | bigint;
      if (!isDefined(numB)) numB = -Infinity;
      const sortOut = (numA > numB ? -1 : (numA < numB ? 1 : 0));
      return sortOut * direction;
    } else if (['string'].includes(typeof valueA)) {
      let strA = valueA as string;
      if (!isDefined(strA)) strA = '';
      let strB = valueB as string;
      if (!isDefined(strB)) strB = '';
      return strB.localeCompare(strA) * direction;
    } else {
      throw new Error('Unhandled type ' + typeof valueA);
    }
  });

  const groupByColumn: Accessor<keyof DependencyDetails> = () => {
    return 'repoName';
  };
  const groupedRows = () => applyGroupBy(groupBys[groupByColumn()], sortedRows());
  const visibleRows = groupedRows;
  console.table(visibleRows());

  const setSortedColumn = (column: keyof DependencyDetails) => {
    setSortSetting(sorted => {
      let direction: SortDirection = 'asc';
      if (sorted.col === column) {
        direction = sorted.direction === 'asc' ? 'desc' : 'asc';
      }

      return {
        col: column,
        direction
      };
    });
  };


  const columns: { name: keyof DependencyDetails; label: string }[] = [
    { label: 'Repo Name', name: 'repoName' },
    { label: 'Contributors', name: 'contributors' },
    { label: 'Open Issues', name: 'openIssues' },
    { label: 'Dependent Repos', name: 'yourDependentRepos' },
    { label: 'Packages', name: 'packages' },
    { label: 'Stars', name: 'stars' },
    { label: 'Language', name: 'language' },
    { label: 'RepoSize', name: 'repoSize' },
    { label: 'Fork Count', name: 'forks' }
  ];

  const rowElts = () => visibleRows().map(row => {
    return (<tr>
      <td>{row.repoName}</td>
      <td>{row.contributors?.toLocaleString()}</td>
      <td>{row.openIssues?.toLocaleString()}</td>
      <td>{row.yourDependentRepos?.map(r => r.split('/')[1])?.join(', ')}</td>
      <td>{row.packages?.join(', ')}</td>
      <td>{row.stars}</td>
      <td>{row.language}</td>
      <td>{row.repoSize}</td>
      <td>{row.forks}</td>
      {/*<td>{row.topics?.join(', ')}</td>*/}
      {/*<td>{row.lastUpdate?.toLocaleDateString()}</td>*/}
      {/*<td>{row.labels?.join(', ')}</td>*/}
    </tr>);
  });

  const getSortIcon = (col: keyof DependencyDetails) => {
    let icon: JSX.Element;
    if (col === sortSetting().col) {
      icon = sortSetting().direction === 'asc' ? svgs.sortAscending() : svgs.sortDescending();
    } else {
      icon = svgs.sort();
    }
    return <button style={{ scale: .8 }}
                   onclick={() => setSortedColumn(col)}>{icon}</button>;
  };
  const excludedFromSort: (keyof DependencyDetails)[] = [
    'yourDependentRepos', 'packages'
  ];


  const columnHeaders = columns.map(col => {
    if (excludedFromSort.includes(col.name)) return <td>{col.label}</td>;
    return (
      <td>
        {col.label}
        {getSortIcon(col.name)}
      </td>
    );
  });

  return (
    <table>
      <thead>
      <tr>
        {columnHeaders}
      </tr>
      </thead>
      <tbody>
      {rowElts()}
      </tbody>
    </table>
  );
};
