import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WalletDashboardMockService } from './wallet-dashboard.mock.service';

describe('WalletDashboardMockService', () => {
  let service: WalletDashboardMockService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(WalletDashboardMockService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads only the local mock dashboard fixture', () => {
    service.load().subscribe((dashboard) => {
      expect(dashboard.mock_only).toBeTrue();
      expect(dashboard.viewer.roles).toEqual(['AGENT', 'PLAYER']);
    });

    const request = http.expectOne('/ui-mocks/wallet-dashboard.json');
    expect(request.request.method).toBe('GET');
    request.flush({ mock_only: true, viewer: { roles: ['AGENT', 'PLAYER'] } });
  });
});
