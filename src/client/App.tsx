import {
  Accessor,
  Component,
  createSignal,
  onCleanup,
  onMount
} from 'solid-js';
import * as Yup from 'yup';
import { Form, FormType, useField } from 'solid-js-form';
import 'solid-simple-table/dist/SimpleTable.css';
import {
  DependencyDetails, DependencyMessage
} from './services/dependencies';

import DependenciesWorker from './services/dependencies.ts?worker';
import db from 'rxjs-debugger';
import { concat, firstValueFrom, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  concatMap,
  exhaustMap,
  map,
  mapTo,
  mergeMap,
  startWith,
  tap
} from 'rxjs/operators';
import { listenToWorker } from './utils/webWorker';
import { from as solidFrom } from 'solid-js';
import { TaskQueue } from './utils/taskQueue';
import { InMemoryCache } from './utils/inMemoryCache';
import { hoursToSeconds } from 'date-fns';
import { LocalStorageCache } from './utils/LocalStorageCache';
import { useSearchParams } from '@solidjs/router';
import { Mutex } from 'async-mutex';
import { makeCold } from '../lib/asyncUtils';

console.log(DependenciesWorker);

const Input: Component<{ name: string, label: string }> = (props) => {
  const { field, form } = useField(props.name);
  const formHandler = form.formHandler;
  let inputRef: HTMLInputElement;
  let formRef: HTMLFormElement;
  return (
    <>
      <label for={props.name}>
        {props.label}
        {field.required() ? ' *' : ''}
      </label>
      <input
        name={props.name}
        value={field.value() as string}
        //@ts-ignore
        use:formHandler //still need to properly type the handler
      />
      <span>{field.error()}</span>
    </>
  );
};

type Filter = (row: DependencyDetails) => boolean;

function applyFilters(rows: DependencyDetails[], filters: Record<string, Filter>) {
  return rows.filter(row => {
    for (let f of Object.values(filters)) {
      if (!f(row)) return false;
    }
    return true;
  });
}

const Grid = (props: { rows: DependencyDetails[] }) => {
  const [filters, setFilters] = createSignal({} as Record<string, Filter>);
  const visibleRows = () => applyFilters(props.rows, filters());
  console.table(props.rows);

  const rowElts = () => visibleRows().map(row => <tr>
    <td>{row.name}</td>
    <td>{row.downloadsLastWeek?.toString() || 'no downloads found'}</td>
    <td>{row.contributors}</td>
    <td>{row.openIssues}</td>
    <td>{row.projectType}</td>
    <td>{row.yourDependentRepos?.join(', ')}</td>
    {/*<td>{row.labels?.join(', ')}</td>*/}
  </tr>);

  return (
    <table>
      <thead>
      <tr>
        <td>Name</td>
        <td>Recent Downloads</td>
        <td>Contributors</td>
        <td>Open Issues</td>
        <td>Project Type</td>
        <td>Dependent Repos</td>
        {/*<td>Labels</td>*/}
      </tr>
      </thead>
      <tbody>
      {rowElts()}
      </tbody>
    </table>
  );
};

const userDependenciesCache = new LocalStorageCache<DependencyDetails[]>('userDependencies', hoursToSeconds(4));

const App: Component = () => {
  const depWorker = new DependenciesWorker();
  const dep$ = listenToWorker(depWorker).pipe(map(evt => evt.data as DependencyDetails[]));
  const submit$ = new Subject<FormType.Context<{ username: string }>>();
  const [params, setParams] = useSearchParams();
  const [submitting, setSubmitting] = createSignal(false);
  const submission$ = submit$.pipe(
    exhaustMap(function fetchUserDependenciesCached(form) {
      // make cold so we only try to retrieve user dependencies/perform side effects when this is the active inner observable of the exhaustMap
      return makeCold(() => {
        console.log('submitting is true');
        setSubmitting(true);
        setParams({ username: form.values.username });
        const msg: DependencyMessage = {
          type: 'fetchUserDependencies',
          username: form.values.username
        };
        return userDependenciesCache.retrieve(form.values.username, () => {
          const depPromise = firstValueFrom(dep$);
          depWorker.postMessage(msg);
          depPromise.finally(() => {
            setSubmitting(false);
          })
          return depPromise;
        });
      }).pipe(
        startWith(undefined)
      );
    })
  );

  const rows = solidFrom(submission$);


  onCleanup(() => {
    submit$.complete();
  });


  return (
    <div>
      <Form
        initialValues={{ username: params['username'] || '' }}
        validation={{
          username: Yup.string().required()
        }}
        onSubmit={async (form) => {
          submit$.next(form);
        }}
      >
        <Input name='username' label='Github Username' />
        <button type='submit'>Submit</button>
      </Form>
      {submitting() && <div>loading....</div>}
      {
        !!rows() && <Grid rows={rows()!} />
      }
    </div>
  );
};

export default App;
