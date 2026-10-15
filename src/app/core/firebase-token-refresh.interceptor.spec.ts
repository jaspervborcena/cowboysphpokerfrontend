import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FirebaseAuthService } from './firebase-auth.service';
import { firebaseTokenRefreshInterceptor } from './firebase-token-refresh.interceptor';
import { UserSessionStore } from './user-session.store';

describe('firebaseTokenRefreshInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let firebaseAuth: FirebaseAuthService;
  let session: UserSessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([firebaseTokenRefreshInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    firebaseAuth = TestBed.inject(FirebaseAuthService);
    session = TestBed.inject(UserSessionStore);
  });

  afterEach(() => http.verify());

  it('refreshes once and retries a buy-in request with its idempotency key', async () => {
    spyOn(firebaseAuth, 'getCurrentIdToken').and.resolveTo('refreshed-token');
    let response: unknown;
    const result = new Promise<void>((resolve, reject) => {
      client.post('/seats', { buy_in_amount: 500, buy_in_id: 'buy-in-1' }, {
        headers: { Authorization: 'Bearer expired-token' }
      }).subscribe({ next: (value) => { response = value; resolve(); }, error: reject });
    });

    http.expectOne('/seats').flush({ code: 40101 }, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    const retry = http.expectOne('/seats');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer refreshed-token');
    retry.flush({ status: 'seated' });
    await result;

    expect(response).toEqual({ status: 'seated' });
    expect(session.firebaseIdToken()).toBe('refreshed-token');
    expect(firebaseAuth.getCurrentIdToken).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-idempotent mutation after 401', async () => {
    const refreshToken = spyOn(firebaseAuth, 'getCurrentIdToken');
    const result = new Promise<void>((resolve, reject) => {
      client.post('/tables/table-1/hands', {}, {
        headers: { Authorization: 'Bearer expired-token' }
      }).subscribe({ next: () => resolve(), error: reject });
    });

    http.expectOne('/tables/table-1/hands').flush({ code: 40101 }, { status: 401, statusText: 'Unauthorized' });
    await expectAsync(result).toBeRejected();
    http.expectNone('/tables/table-1/hands');
    expect(refreshToken).not.toHaveBeenCalled();
  });
});
