/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import App from './App';
import { Router } from '@solidjs/router';

// patchObservable(Observable);

render(
  () => <Router> <App /></Router>,
  document.getElementById('root') as HTMLElement
);
