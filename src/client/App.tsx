import { Component, createSignal } from 'solid-js';
import * as Yup from 'yup';
import { Form, useField } from 'solid-js-form';
import 'solid-simple-table/dist/SimpleTable.css';
import {
  DependencyDetails,
  cachedFetchUserDependencies
} from './services/dependencies';

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
  console.log(props.rows);

  const rowElts = () => props.rows.map(row => <tr>
    <td>{row.name}</td>
    <td>{row.downloadsLastWeek.toString()}</td>
    <td>{row.contributors}</td>
    <td>{row.contributors}</td>
    <td>{row.openIssues}</td>
    <td>{row.projectType}</td>
    <td>{row.yourDependentRepos.join(', ')}</td>
    <td>{row.labels.join(', ')}</td>
  </tr>);
  console.log(rowElts());

  return (
    <table>
      <thead>
      <tr>
        <td>Name Test</td>
        <td>Recent Downloads</td>
        <td>Contributors</td>
        <td>Last Update</td>
        <td>Open Issues</td>
        <td>Project Type</td>
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
        rows().length > 0 && <Grid rows={rows()} />
      }
    </div>
  );
};

export default App;
