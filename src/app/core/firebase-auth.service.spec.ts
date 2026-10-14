import { TestBed } from '@angular/core/testing';
import { FirebaseAuthService } from './firebase-auth.service';

describe('FirebaseAuthService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    delete (window as any).__COWBOYS_FIREBASE_CONFIG__;
  });

  it('returns null when Firebase is not configured', async () => {
    const service = TestBed.inject(FirebaseAuthService);
    await expectAsync(service.getCurrentIdToken()).toBeResolvedTo(null);
  });

  it('recognizes a configured Firebase auth setup and rejects empty sign-in values', async () => {
    const service = TestBed.inject(FirebaseAuthService);
    service.configure({
      apiKey: 'demo-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo-project',
      storageBucket: 'demo.appspot.com',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:abc123'
    });

    expect(service.isConfigured()).toBeTrue();
    expect(typeof service.onAuthStateChanged).toBe('function');
    await expectAsync(service.signInWithEmailAndPassword('', '')).toBeResolvedTo(false);
    await expectAsync(service.signInWithGoogle()).toBeResolvedTo(false);
    await expectAsync(service.signInWithCustomToken('')).toBeResolvedTo(false);
  });
});
