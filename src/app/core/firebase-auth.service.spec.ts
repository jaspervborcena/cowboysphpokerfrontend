import { TestBed } from '@angular/core/testing';
import { FirebaseAuthService } from './firebase-auth.service';

describe('FirebaseAuthService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('returns null when Firebase is not configured', async () => {
    const service = TestBed.inject(FirebaseAuthService);
    await expectAsync(service.getCurrentIdToken()).toBeResolvedTo(null);
  });
});
