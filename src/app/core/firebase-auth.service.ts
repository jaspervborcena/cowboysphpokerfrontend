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

  isConfigured(): boolean {
    return !!window.__COWBOYS_FIREBASE_CONFIG__;
  }

  async getCurrentUser(): Promise<{ uid: string; displayName: string | null; email: string | null; phoneNumber: string | null } | null> {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config) return null;

    await this.initialize(config);
    const user = this.auth?.currentUser;
    if (!user) return null;

    return {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      phoneNumber: user.phoneNumber
    };
  }

  onAuthStateChanged(callback: (user: { uid: string; displayName: string | null; email: string | null; phoneNumber: string | null } | null) => void): () => void {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config) {
      callback(null);
      return () => undefined;
    }

    let unsubscribe: (() => void) | null = null;

    void this.initialize(config).then(() => {
      if (!this.auth) {
        callback(null);
        return;
      }

      void import('firebase/auth').then(({ onAuthStateChanged }) => {
        unsubscribe = onAuthStateChanged(this.auth, (firebaseUser: any) => {
          if (!firebaseUser) {
            callback(null);
            return;
          }

          callback({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            phoneNumber: firebaseUser.phoneNumber
          });
        });
      });
    });

    return () => {
      unsubscribe?.();
    };
  }

  async getCurrentIdToken(): Promise<string | null> {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config) return null;

    await this.initialize(config);
    if (!this.auth?.currentUser) return null;

    return this.auth.currentUser.getIdToken();
  }

  async signInWithEmailAndPassword(email: string, password: string): Promise<boolean> {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config || !email || !password) return false;

    await this.initialize(config);
    if (!this.auth) return false;

    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(this.auth, email, password);
      return true;
    } catch {
      return false;
    }
  }

  async signInWithGoogle(): Promise<boolean> {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config) return false;

    await this.initialize(config);
    if (!this.auth) return false;

    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
      return true;
    } catch {
      return false;
    }
  }

  async signInWithCustomToken(customToken: string): Promise<boolean> {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config || !customToken) return false;

    await this.initialize(config);
    if (!this.auth) return false;

    try {
      const { signInWithCustomToken } = await import('firebase/auth');
      await signInWithCustomToken(this.auth, customToken);
      return true;
    } catch {
      return false;
    }
  }

  async signOut(): Promise<void> {
    const config = window.__COWBOYS_FIREBASE_CONFIG__ ?? null;
    if (!config) return;

    await this.initialize(config);
    if (!this.auth) return;

    const { signOut } = await import('firebase/auth');
    await signOut(this.auth);
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
