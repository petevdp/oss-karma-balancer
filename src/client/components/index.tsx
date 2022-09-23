import { Accessor, Component } from 'solid-js';
import { useField } from 'solid-js-form';

export const Input: Component<{ name: string, label: string }> = (props) => {
  const { field, form } = useField(props.name);
  const formHandler = form.formHandler;
  let inputRef: HTMLInputElement;
  let formRef: HTMLFormElement;
  return (
    <>
      <FormLabel name={props.name} label={props.label}
                 required={field.required} />
      <input
        classList={{ 'asdf': true }}
        name={props.name}
        value={field.value() as string || ''}
        //@ts-ignore
        use:formHandler //still need to properly type the handler
      />
      <span>{field.error()}</span>
    </>
  );
};


export const FormLabel: Component<{ name: string; label: string; required: Accessor<boolean> }> = (props) => {
  return (
    <label for={props.name}>
      {props.label}
      {props.required() ? ' *' : ''}
    </label>
  );
};

export const Checkbox: Component<{ name: string, label: string }> = (props) => {
  const { field, form } = useField(props.name);
  const formHandler = form.formHandler;

  return (
    <>
      <FormLabel name={props.name} label={props.label}
                 required={field.required} />
      <input
        type='checkbox'
        name={props.name}
        value={field.value().toString()}
        //@ts-ignore
        use:formHandler
      />;
    </>
  );
};


