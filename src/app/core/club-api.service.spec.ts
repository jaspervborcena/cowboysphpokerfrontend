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
      role: 'PLAYER',
      currency_type: 'CLUB_CHIPS',
      available_balance: 750,
      in_play_balance: 1200
    });
  });

  it('ensures and reads the authenticated global playmoney wallet', () => {
    service.ensureGlobalWallet('http://localhost:8000/', 'firebase-token').subscribe();

    const ensureRequest = http.expectOne('http://localhost:8000/me/wallets/global-playmoney/ensure');
    expect(ensureRequest.request.method).toBe('POST');
    expect(ensureRequest.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    ensureRequest.flush({
      wallet_id: 'global-1',
      wallet_type: 'GLOBAL_PLAYMONEY',
      currency_type: 'GLOBAL_PLAYMONEY',
      user_id: 'member-1',
      balance: 20000,
      created: true
    });

    service.getGlobalWallet('http://localhost:8000', 'firebase-token').subscribe();
    const getRequest = http.expectOne('http://localhost:8000/me/wallets/global-playmoney');
    expect(getRequest.request.method).toBe('GET');
    expect(getRequest.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    getRequest.flush({
      wallet_id: 'global-1',
      wallet_type: 'GLOBAL_PLAYMONEY',
      currency_type: 'GLOBAL_PLAYMONEY',
      user_id: 'member-1',
      balance: 20000
    });
  });

  it('reads the club treasury and transfers between club treasuries', () => {
    service.getClubTreasury('http://localhost:8000/', 'club-a', 'firebase-token').subscribe();

    const treasuryRequest = http.expectOne('http://localhost:8000/clubs/club-a/wallet');
    expect(treasuryRequest.request.method).toBe('GET');
    expect(treasuryRequest.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    treasuryRequest.flush({ club_id: 'club-a', currency_type: 'CLUB_CHIPS', chip_balance: 10000 });

    service.transferClubTreasury('http://localhost:8000', 'club-a', 'firebase-token', {
      destination_club_id: 'club-b',
      amount: 2500,
      transaction_id: '3c2de3c1-8b75-4f9e-9cb7-b6cdbe4cbfb8',
      note: 'weekly transfer'
    }).subscribe();
    const transferRequest = http.expectOne('http://localhost:8000/clubs/club-a/wallet/transfers');
    expect(transferRequest.request.method).toBe('POST');
    expect(transferRequest.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    expect(transferRequest.request.body.destination_club_id).toBe('club-b');
    expect(transferRequest.request.body.transaction_id).toBe('3c2de3c1-8b75-4f9e-9cb7-b6cdbe4cbfb8');
    transferRequest.flush({
      transaction_id: '3c2de3c1-8b75-4f9e-9cb7-b6cdbe4cbfb8',
      type: 'INTER_CLUB_TRANSFER',
      from_club_id: 'club-a',
      to_club_id: 'club-b',
      amount: 2500,
      status: 'completed'
    });
  });

  it('sends out and claims back member chips with idempotent transaction IDs', () => {
    const transfer = {
      user_id: 'player-2',
      amount: 600,
      transaction_id: 'b0882a59-3d2a-4124-b0f7-3ae7a4ae8321',
      note: 'welcome chips'
    };
    service.sendOutClubChips('http://localhost:8000/', 'club-a', 'firebase-token', transfer).subscribe();

    const sendRequest = http.expectOne('http://localhost:8000/clubs/club-a/wallet/send-out');
    expect(sendRequest.request.method).toBe('POST');
    expect(sendRequest.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    expect(sendRequest.request.body).toEqual(transfer);
    sendRequest.flush({
      club_id: 'club-a',
      transaction_id: transfer.transaction_id,
      type: 'SEND_OUT',
      amount: 600,
      from_user_id: 'operator-1',
      to_user_id: 'player-2',
      status: 'completed'
    });

    service.claimBackClubChips('http://localhost:8000/', 'club-a', 'firebase-token', transfer).subscribe();
    const claimRequest = http.expectOne('http://localhost:8000/clubs/club-a/wallet/claim-back');
    expect(claimRequest.request.method).toBe('POST');
    expect(claimRequest.request.headers.get('Authorization')).toBe('Bearer firebase-token');
    expect(claimRequest.request.body).toEqual(transfer);
    claimRequest.flush({
      club_id: 'club-a',
      transaction_id: transfer.transaction_id,
      type: 'CLAIM_BACK',
      amount: 600,
      from_user_id: 'player-2',
      to_user_id: 'operator-1',
      status: 'completed'
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
