import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClubApiService } from './club-api.service';

describe('ClubApiService union requests', () => {
  let service: ClubApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ClubApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads union tables using the member club path and Firebase token', () => {
    service.getUnionTables('http://localhost:8000/', 'club-a', 'union-1', 'firebase-token').subscribe();

    const request = http.expectOne(
      'http://localhost:8000/clubs/club-a/unions/union-1/tables'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    request.flush([]);
  });

  it('seats a player through their home club without sending a user id', () => {
    service.seatUnionPlayer(
      'http://localhost:8000',
      'union-1',
      'table-1',
      'club-a',
      'firebase-token',
      { seat_index: 2, buy_in_amount: 500, buy_in_id: 'buy-in-1' }
    ).subscribe();

    const request = http.expectOne(
      'http://localhost:8000/unions/union-1/tables/table-1/clubs/club-a/seats'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    expect(request.request.body).toEqual({
      seat_index: 2,
      buy_in_amount: 500,
      buy_in_id: 'buy-in-1'
    });
    request.flush({});
  });
});
