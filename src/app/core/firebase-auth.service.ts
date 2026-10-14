import { Injectable } from '@angular/core';

export type FirebaseConfig = Record<string, string>;

declare global {
  interface Window {
    __COWBOYS_FIREBASE_CONFIG__?: FirebaseConfig;
  }
}

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private auth: any = null;
  private initialized = false;

  configure(config: FirebaseConfig): void {
    window.__COWBOYS_FIREBASE_CONFIG__ = config;
    this.initialized = false;
    this.auth = null;
  }

  async getCurrentIdToken(): Promise<string | null> {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config) return null;

    await this.initialize(config);
    return this.auth?.currentUser ? this.auth.currentUser.getIdToken() : null;
  }

  private async initialize(config: FirebaseConfig): Promise<void> {
    if (this.initialized) return;

    try {
      const { initializeApp } = await import('firebase/app');
      const { getAuth, onAuthStateChanged } = await import('firebase/auth');
      const app = initializeApp(config, 'cowboys-ph-poker-frontend');
      this.auth = getAuth(app);

      await new Promise<void>((resolve) => {
        const unsubscribe = onAuthStateChanged(this.auth, () => {
          unsubscribe();
          resolve();
        });
      });
    } catch {
      this.auth = null;
    }

    this.initialized = true;
  }
}
