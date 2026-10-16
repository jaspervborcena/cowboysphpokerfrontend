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

  it('loads the game catalog with the backend active game and support flags', () => {
    service.getGames('http://localhost:8000/').subscribe();

    const request = http.expectOne('http://localhost:8000/games');
    expect(request.request.method).toBe('GET');
    request.flush({
      active_game_id: 'no_limit_texas_holdem',
      games: [{
        game_id: 'no_limit_texas_holdem',
        display_name: 'No-Limit Texas Hold’em',
        create_supported: true
      }]
    });
  });

  it('loads the authenticated member role from the configured club endpoint', () => {
    service.getMembership('http://localhost:8000/', 'club-a', 'firebase-token').subscribe();

    const request = http.expectOne('http://localhost:8000/clubs/club-a/members/me');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    request.flush({ club_id: 'club-a', user_id: 'member-1', username: 'Player', role: 'PLAYER' });
  });

  it('loads the authenticated member wallet summary for club-chip availability', () => {
    service.getMemberWalletSummary('http://localhost:8000/', 'club-a', 'firebase-token').subscribe();

    const request = http.expectOne('http://localhost:8000/clubs/club-a/members/me/wallet');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    request.flush({
      club_id: 'club-a',
      user_id: 'member-1',
      currency_type: 'CLUB_CHIPS',
      available_balance: 750,
      in_play_balance: 1200
    });
  });

  it('requests a Firebase custom token for phone and password sign-in', () => {
    service.signInWithPhonePassword('http://localhost:8000/', '+639123456789', 'secret-pass').subscribe();

    const request = http.expectOne('http://localhost:8000/auth/phone/sign-in');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      phone_number: '+639123456789',
      password: 'secret-pass'
    });
    request.flush({ firebase_custom_token: 'firebase-custom-token' });
  });

  it('requests a phone password reset code without revealing account status', () => {
    service.requestPhonePasswordReset('http://localhost:8000/', '+639171234567').subscribe();

    const request = http.expectOne('http://localhost:8000/auth/phone/password-reset/request');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ phone_number: '+639171234567' });
    request.flush({ message: 'If the account exists, a code was sent.' });
  });

  it('confirms a phone password reset using the OTP and new password', () => {
    service.confirmPhonePasswordReset('http://localhost:8000', {
      phone_number: '+639171234567',
      otp: '123456',
      new_password: 'new-secret-pass'
    }).subscribe();

    const request = http.expectOne('http://localhost:8000/auth/phone/password-reset/confirm');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      phone_number: '+639171234567',
      otp: '123456',
      new_password: 'new-secret-pass'
    });
    request.flush({ status: 'reset' });
  });

  it('loads union tables using the member club path and Firebase token', () => {
    service.getUnionTables('http://localhost:8000/', 'club-a', 'union-1', 'firebase-token').subscribe();

    const request = http.expectOne(
      'http://localhost:8000/clubs/club-a/unions/union-1/tables'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    request.flush([]);
  });

  it('creates union tables with the selected game_id and capacity', () => {
    service.createUnionTable('http://localhost:8000', 'union-1', 'shared-1', 'firebase-token', {
      origin_club_id: 'club-a',
      game_id: 'no_limit_texas_holdem',
      table_name: 'Shared Main',
      small_blind: 1,
      big_blind: 2,
      buy_in_min: 50,
      buy_in_max: 1000,
      table_size: 9
    }).subscribe();

    const request = http.expectOne('http://localhost:8000/unions/union-1/tables/shared-1');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    expect(request.request.body.game_id).toBe('no_limit_texas_holdem');
    expect(request.request.body.table_size).toBe(9);
    request.flush({ union_id: 'union-1', table_id: 'shared-1', origin_club_id: 'club-a', status: 'created' });
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
