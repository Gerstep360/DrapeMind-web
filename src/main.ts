import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';
import { registerDrapeMindPwa } from './app/incrementos/incremento-ii/offline/register-pwa';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
if (environment.production) window.addEventListener('load',()=>void registerDrapeMindPwa());
