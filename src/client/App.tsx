import {
  Accessor,
  Component,
  createSignal,
  from as solidFrom,
  onCleanup
} from 'solid-js';
import * as Yup from 'yup';
import { Form, FormType } from 'solid-js-form';
import downloadFile from 'js-file-download';
import 'solid-simple-table/dist/SimpleTable.css';
import { DependencyDetails, DependencyMessage } from './services/dependencies';

import DependenciesWorker from './services/dependencies.ts?worker';
import { EMPTY, firstValueFrom, from, Subject } from 'rxjs';
import { exhaustMap, map, startWith } from 'rxjs/operators';
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync';
import { listenToWorker } from './utils/webWorker';
import _ from 'lodash-es';
import { hoursToSeconds } from 'date-fns';
import { LocalStorageCache } from './utils/LocalStorageCache';
import { useSearchParams } from '@solidjs/router';
import { makeCold } from '../lib/asyncUtils';
import { Checkbox, Input } from './components';
import { Grid } from './components/grid';
import { advancedStringifyJson } from '../lib/json';

console.log(DependenciesWorker);

const userDependenciesCache = new LocalStorageCache<DependencyDetails[]>('userDependencies', hoursToSeconds(4));
type FormFields = {
  username: string;
  includeForked: boolean;
  fromRepos: string;
}

const NavCluster: Component = () => {
  return (
    <nav class={'alskdjf'}></nav>
  );
};

const FilterBar: Component = () => {
}



function setup() {

}




const App: Component = () => {
  //region Logic
  const depWorker = new DependenciesWorker();
  const dep$ = listenToWorker(depWorker).pipe(map(evt => evt.data as DependencyDetails[]));
  const submit$ = new Subject<FormType.Context<FormFields>>();
  const [params, setParams] = useSearchParams();
  const [submitting, setSubmitting] = createSignal(false);
  let submission = solidFrom(submit$);
  let prevMessage: DependencyMessage | null = null;
  const rowChange$ = submit$.pipe(
    map((form): DependencyMessage => ({
      type: 'fetchUserDependencies',
      username: form.values.username,
      includeForked: form.values.includeForked
    })),
    exhaustMap(function fetchUserDependenciesCached(msg) {
      // make cold so we only try to retrieve user dependencies/perform side effects when this is the active inner observable of the exhaustMap
      return makeCold(() => {

        if (_.isEqual(msg, prevMessage)) {
          return EMPTY;
        }
        prevMessage = msg;
        setSubmitting(true);

        setParams({
          username: msg.username
        });

        const depPromise = firstValueFrom(dep$);
        depWorker.postMessage(msg);
        depPromise.finally(() => {
          setSubmitting(false);
        });
        return from(depPromise).pipe(startWith(undefined));
      });
    })
  );

  const rows = solidFrom(rowChange$);

  onCleanup(() => {
    submit$.complete();
  });


  const initialValues: FormFields = {
    username: params['username'] || '',
    includeForked: Boolean(params['includeForked']),
    fromRepos: ''
  };

  const fromRows = () => submission()?.values.fromRepos;

  const exportData = (as: 'json' | 'csv') => {
    let currRows = rows();
    let currSubmission = submission();
    if (!currRows || !currSubmission || currRows.length === 0) return;
    downloadOutFile(as, currRows, currSubmission.values.username)
  };
  //endregion

  return (
    <div>
      <NavCluster></NavCluster>
      <Form
        initialValues={initialValues}
        validation={{
          username: Yup.string().required(),
          includeForked: Yup.boolean()
        }}
        onSubmit={async (form) => {
          submit$.next(form);
        }}
      >
        <Input name='username' label='Github Username' />
        <Checkbox name='includeForked' label='Include Forked Repos' />
        <Input name='fromRepos' label='From Repos' />
        <button type='submit'>Submit</button>
        {submitting() && <div>loading....</div>}
      </Form>
      {!!rows() && <Grid rows={rows as Accessor<DependencyDetails[]>}
                         fromRepos={fromRows} />}
      <button class='' onclick={() => exportData('json')}>Export as json
      </button>
      <button disabled={!rows() || !submission() || rows()!.length === 0} onclick={() => exportData('csv')}>Export as csv</button>
    </div>
  );
};

const downloadOutFile = (as: 'json' | 'csv', currRows: DependencyDetails[], username: string)  =>  {
  let outText: string;
  let filename: string;
  if (as === 'json') {
    outText = advancedStringifyJson(currRows);
    filename = username + '-karma.json';
  } else {
    const rowsForCsv = currRows.map(r => {
      const outObj: any = {};
      for (let [key, value] of Object.entries(r)) {
        if (value instanceof Array) {
          outObj[key] = value.join(', ');
        } else {
          outObj[key] = value;
        }
      }
    });
    outText = csvStringify(rowsForCsv, { columns: Object.keys(currRows[0]) });
    filename = username + '-karma.csv';
  }

  downloadFile(outText, filename);
}

export default App;
