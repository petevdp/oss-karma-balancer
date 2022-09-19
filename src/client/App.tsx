import { Accessor, Component, createSignal } from 'solid-js';
import * as Yup from 'yup';
import { Form, useField } from 'solid-js-form';
import 'solid-simple-table/dist/SimpleTable.css';
import {
  DependencyDetails,
  cachedFetchUserDependencies
} from './services/dependencies';
import db from 'rxjs-debugger';
import {Observable} from 'rxjs';


if (import.meta.env.VITE_ENVIRONMENT === 'development') {
  // @ts-ignore
  db.RxJSDebugger.init(Observable);
}

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
        vite-plugin-commonjs
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

const Grid = (props: { rows: Accessor<DependencyDetails[]> }) => {
  const [filters, setFilters] = createSignal({} as Record<string, Filter>);
  const visibleRows = () => applyFilters(props.rows(), filters());
  console.table(props.rows());

  const rowElts = () => props.rows().map(row => <tr>
    <td>{row.name}</td>
    <td>{row.downloadsLastWeek.toString()}</td>
    <td>{row.contributors}</td>
    <td>{row.openIssues}</td>
    <td>{row.projectType}</td>
    <td>{row.yourDependentRepos?.join(', ')}</td>
    <td>{row.labels?.join(', ')}</td>
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
        <td>Labels</td>
      </tr>
      </thead>
      <tbody>
      {rowElts()}
      </tbody>
    </table>
  );
};

const App: Component = () => {
  const [rows, setRows] = createSignal([] as DependencyDetails[]);

  return (
    <div>
      <Form
        initialValues={{ username: '' }}
        validation={{
          username: Yup.string().required()
        }}
        onSubmit={async (form) => {
          const rows = await cachedFetchUserDependencies(form.values.username);
          setRows(rows);
        }}
      >
        <Input name='username' label={'Github Username'} />
        <button type='submit'>Submit</button>
      </Form>
      {
        rows().length > 0 && <Grid rows={rows} />
      }
    </div>
  );
};

export default App;
