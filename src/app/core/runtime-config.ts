import type { FirebaseConfig } from './firebase-auth.service';

export interface AppRuntimeConfig {
  apiBase: string;
  clubId: string;
  firebase: FirebaseConfig | null;
}

declare global {
  interface Window {
    __COWBOYS_APP_CONFIG__?: AppRuntimeConfig;
  }
}