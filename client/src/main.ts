import { Aurelia, StandardConfiguration } from '@aurelia/runtime-html';
import { MyApp } from './my-app';
import './my-app.css';

(async function () {
  const au = new Aurelia();
  au.register(StandardConfiguration);
  await au.app({ component: MyApp, host: document.querySelector('my-app') })
    .start();
})().catch(console.error);