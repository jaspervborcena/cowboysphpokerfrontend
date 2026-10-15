import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { AppRuntimeConfig } from './app/core/runtime-config';
import { environment } from './environments/environment';

async function bootstrap(): Promise<void> {
  window.__COWBOYS_FIREBASE_CONFIG__ = environment.firebase;

  try {
    const response = await fetch('/app-config.json');
    if (response.ok) {
      const config = await response.json() as AppRuntimeConfig;
      window.__COWBOYS_APP_CONFIG__ = config;
      if (config.firebase) window.__COWBOYS_FIREBASE_CONFIG__ = config.firebase;
    }
  } catch {
    console.warn('Runtime config unavailable; using local development defaults.');
  }

  await bootstrapApplication(App, appConfig);
}

void bootstrap().catch((error: unknown) => console.error(error));
