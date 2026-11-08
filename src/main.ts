import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';
import { registerDrapeMindPwa } from './app/segundo_parcial/cu13_catalogo_offline/cu13-register-pwa';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
if (environment.production) window.addEventListener('load',()=>void registerDrapeMindPwa());
