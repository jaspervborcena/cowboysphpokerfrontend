import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { App } from './app';
import { ClubApiService, GameCatalogResponse } from './core/club-api.service';
import { FirebaseAuthService } from './core/firebase-auth.service';
import { UserSessionStore } from './core/user-session.store';

const testGameCatalog: GameCatalogResponse = {
  active_game_id: 'no_limit_texas_holdem',
  games: [
    { game_id: 'no_limit_texas_holdem', display_name: 'No-Limit Texas Hold’em', create_supported: true },
    { game_id: 'pot_limit_omaha', display_name: 'Pot-Limit Omaha', create_supported: false }
  ]
};

describe('App', () => {
  beforeEach(async () => {
    delete (window as any).__COWBOYS_FIREBASE_CONFIG__;
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ClubApiService, useValue: {
          getGames: () => of(testGameCatalog),
          signInWithPhonePassword: () => of({ firebase_custom_token: '' }),
          requestPhonePasswordReset: () => of({}),
          confirmPhonePasswordReset: () => of({}),
          getMemberWalletSummary: () => of({
            club_id: 'demo',
            user_id: 'player-1',
            currency_type: 'CLUB_CHIPS',
            available_balance: 1000,
            in_play_balance: 0
          }),
          getTables: () => of([]),
          getUnions: () => of([]),
          getUnionTables: () => of([])
        } }
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.isMyTurn).toBeFalse();
  });

  it('normalizes phone sign-in and exchanges the backend token with Firebase', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    const api = TestBed.inject(ClubApiService);
    const firebaseAuth = TestBed.inject(FirebaseAuthService);
    const signInSpy = spyOn(api, 'signInWithPhonePassword').and.returnValue(of({
      firebase_custom_token: 'custom-token'
    }));
    const tokenSpy = spyOn(firebaseAuth, 'signInWithCustomToken').and.returnValue(Promise.resolve(true));
    const finalizeSpy = spyOn<any>(app, 'finalizeSignedInUser').and.returnValue(Promise.resolve());
    app.loginIdentifier.set('0912 345 6789');
    app.loginPassword.set('correct-horse');

    await app.continueWithIdentifier();

    expect(signInSpy).toHaveBeenCalledWith(app.baseUrl(), '+639123456789', 'correct-horse');
    expect(tokenSpy).toHaveBeenCalledWith('custom-token');
    expect(finalizeSpy).toHaveBeenCalledWith('+639123456789');
    expect(app.loginError()).toBe('');
  });

  it('requests phone reset with a generic confirmation and opens the OTP form', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    const api = TestBed.inject(ClubApiService);
    const resetRequestSpy = spyOn(api, 'requestPhonePasswordReset').and.returnValue(of({}));
    app.authMode.set('forgot-password');
    app.loginIdentifier.set('0917-123-4567');

    await app.requestPasswordReset();

    expect(resetRequestSpy).toHaveBeenCalledWith(app.baseUrl(), '+639171234567');
    expect(app.authMode()).toBe('reset-phone');
    expect(app.notice()).toContain('If an account matches that number');
  });

  it('confirms phone reset and clears the OTP and new password', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    const api = TestBed.inject(ClubApiService);
    const resetConfirmSpy = spyOn(api, 'confirmPhonePasswordReset').and.returnValue(of({ status: 'reset' }));
    app.authMode.set('reset-phone');
    app.loginIdentifier.set('+639171234567');
    app.resetOtp.set(' 123456 ');
    app.resetNewPassword.set('new-password');

    await app.confirmPhonePasswordReset();

    expect(resetConfirmSpy).toHaveBeenCalledWith(app.baseUrl(), {
      phone_number: '+639171234567',
      otp: '123456',
      new_password: 'new-password'
    });
    expect(app.authMode()).toBe('sign-in');
    expect(app.resetOtp()).toBe('');
    expect(app.resetNewPassword()).toBe('');
    expect(app.notice()).toContain('Password reset successfully');
  });

  it('should open a buy-in confirmation at the selected table minimum', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.buyInMin = 100;
    app.buyInMax = 800;

    app.chooseEmptySeat(4);

    expect(app.seatIndex).toBe(4);
    expect(app.buyInAmount).toBe(100);
    expect(app.seatConfirmationOpen()).toBeTrue();
    expect(app.snapshot()?.players ?? []).toEqual([]);
  });

  it('should check wallet funds before asking the server to reserve the buy-in', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const walletApi = TestBed.inject(ClubApiService);
    spyOn(walletApi, 'getMemberWalletSummary').and.returnValues(of({
      club_id: 'club-1',
      user_id: 'player-1',
      currency_type: 'CLUB_CHIPS',
      available_balance: 1000,
      in_play_balance: 0
    }), of({
      club_id: 'club-1',
      user_id: 'player-1',
      currency_type: 'CLUB_CHIPS',
      available_balance: 500,
      in_play_balance: 500
    }));
    session.setVerifiedMember('player-1', 'Player', 'PLAYER', 'firebase-token');
    app.clubId = 'club-1';
    app.tableId = 'table-9';
    app.buyInMin = 100;
    app.buyInMax = 1000;
    app.buyInAmount = 500;
    app.seatIndex = 2;
    app.seatConfirmationOpen.set(true);
    app.snapshot.set({
      table_id: 'table-9',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: [{
        seat: 0,
        user_id: 'player-1',
        username: 'Player',
        stack: 10,
        status: 'active',
        hole_cards: [],
        in_hand: false
      }]
    } as any);

    await app.seatPlayer();

    const request = http.expectOne('http://127.0.0.1:8000/clubs/club-1/tables/table-9/seats');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.buy_in_amount).toBe(500);
    request.flush({
      table_id: 'table-9',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: [{
        seat: 2,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'active',
        hole_cards: [],
        in_hand: false
      }]
    });
    expect(app.seatConfirmationOpen()).toBeFalse();
    expect(app.currentPlayer?.seat).toBe(2);
    await fixture.whenStable();
    expect(walletApi.getMemberWalletSummary).toHaveBeenCalledTimes(2);
    expect(app.availableWalletBalance()).toBe(500);
    http.verify();
  });

  it('should not request a seat when the wallet cannot cover the minimum buy-in', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const walletApi = TestBed.inject(ClubApiService);
    spyOn(walletApi, 'getMemberWalletSummary').and.returnValue(of({
      club_id: 'club-1',
      user_id: 'player-1',
      currency_type: 'CLUB_CHIPS',
      available_balance: 99,
      in_play_balance: 0
    }));
    session.setVerifiedMember('player-1', 'Player', 'PLAYER', 'firebase-token');
    app.clubId = 'club-1';
    app.tableId = 'table-9';
    app.buyInMin = 100;
    app.buyInMax = 1000;
    app.buyInAmount = 100;

    await app.seatPlayer();

    expect(app.notice()).toContain('Available balance is 99 chips');
    http.expectNone('http://127.0.0.1:8000/clubs/club-1/tables/table-9/seats');
    http.verify();
  });

  it('should fail closed when the wallet summary belongs to another member', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    const session = TestBed.inject(UserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(ClubApiService), 'getMemberWalletSummary').and.returnValue(of({
      club_id: 'club-1',
      user_id: 'different-player',
      currency_type: 'CLUB_CHIPS',
      available_balance: 1000,
      in_play_balance: 0
    }));
    session.setVerifiedMember('player-1', 'Player', 'PLAYER', 'firebase-token');
    app.clubId = 'club-1';
    app.tableId = 'table-9';
    app.buyInMin = 100;
    app.buyInMax = 1000;
    app.buyInAmount = 100;

    await app.seatPlayer();

    expect(app.walletBalanceError()).toBeTrue();
    expect(app.notice()).toContain('Unable to verify your available club-chip balance');
    http.expectNone('http://127.0.0.1:8000/clubs/club-1/tables/table-9/seats');
    http.verify();
  });

  it('should fail closed when the wallet summary has an invalid in-play balance', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    const session = TestBed.inject(UserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(ClubApiService), 'getMemberWalletSummary').and.returnValue(of({
      club_id: 'club-1',
      user_id: 'player-1',
      currency_type: 'CLUB_CHIPS',
      available_balance: 1000,
      in_play_balance: Number.NaN
    }));
    session.setVerifiedMember('player-1', 'Player', 'PLAYER', 'firebase-token');
    app.clubId = 'club-1';
    app.tableId = 'table-9';
    app.buyInMin = 100;
    app.buyInMax = 1000;
    app.buyInAmount = 100;

    await app.seatPlayer();

    expect(app.walletBalanceError()).toBeTrue();
    http.expectNone('http://127.0.0.1:8000/clubs/club-1/tables/table-9/seats');
    http.verify();
  });

  it('should use a new idempotency key if buy-in details change after a failed request', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    const session = TestBed.inject(UserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(ClubApiService), 'getMemberWalletSummary').and.returnValue(of({
      club_id: 'club-1',
      user_id: 'player-1',
      currency_type: 'CLUB_CHIPS',
      available_balance: 1000,
      in_play_balance: 0
    }));
    session.setVerifiedMember('player-1', 'Player', 'PLAYER', 'firebase-token');
    app.clubId = 'club-1';
    app.tableId = 'table-9';
    app.buyInMin = 100;
    app.buyInMax = 1000;
    app.buyInAmount = 100;

    await app.seatPlayer();
    const firstRequest = http.expectOne('http://127.0.0.1:8000/clubs/club-1/tables/table-9/seats');
    const firstBuyInId = firstRequest.request.body.buy_in_id;
    firstRequest.flush({ code: 40901 }, { status: 409, statusText: 'Conflict' });

    await app.seatPlayer();
    const sameRequest = http.expectOne('http://127.0.0.1:8000/clubs/club-1/tables/table-9/seats');
    expect(sameRequest.request.body.buy_in_id).toBe(firstBuyInId);
    sameRequest.flush({ code: 40901 }, { status: 409, statusText: 'Conflict' });

    app.buyInAmount = 200;
    await app.seatPlayer();

    const retryRequest = http.expectOne('http://127.0.0.1:8000/clubs/club-1/tables/table-9/seats');
    expect(retryRequest.request.body.buy_in_id).not.toBe(firstBuyInId);
    expect(retryRequest.request.body.buy_in_amount).toBe(200);
    retryRequest.flush({ status: 'accepted' });
    http.verify();
  });

  it('should keep the buy-in confirmation open until a table snapshot confirms the seat', async () => {
    const app = TestBed.createComponent(App).componentInstance;
    const session = TestBed.inject(UserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    spyOn(TestBed.inject(ClubApiService), 'getMemberWalletSummary').and.returnValue(of({
      club_id: 'demo',
      user_id: 'player-1',
      currency_type: 'CLUB_CHIPS',
      available_balance: 500,
      in_play_balance: 0
    }));
    session.setVerifiedMember('player-1', 'Player', 'PLAYER', 'firebase-token');
    app.tableId = 'table-1';
    app.buyInMin = 100;
    app.buyInMax = 1000;
    app.buyInAmount = 100;
    app.seatIndex = 2;
    app.seatConfirmationOpen.set(true);

    await app.seatPlayer();
    http.expectOne('http://127.0.0.1:8000/clubs/demo/tables/table-1/seats').flush({ status: 'accepted' });

    expect(app.seatConfirmationOpen()).toBeTrue();
    expect(app.currentPlayer).toBeUndefined();
    http.verify();
  });

  it('should start on the clubhouse landing screen', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.home-screen')).not.toBeNull();
    expect(compiled.querySelector('.lobby-screen')).toBeNull();
    expect(compiled.querySelector('.auth-gate-backdrop')).not.toBeNull();
    expect(compiled.querySelector('.app-content')?.hasAttribute('inert')).toBeTrue();
  });

  it('should open the mock wallet dashboard from the home wallet control', () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[aria-label="Open mock wallet dashboard"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#wallet-dashboard-title')?.textContent).toContain('Sample wallet');

    http.expectOne('/ui-mocks/wallet-dashboard.json').flush({
      mock_only: true,
      viewer: { user_id: 'user-agent-player-a', username: 'Alex', club_id: 'club-demo', roles: ['AGENT', 'PLAYER'] },
      global_wallet: {
        wallet_id: 'global-wallet-user-agent-player-a',
        wallet_type: 'GLOBAL_PLAYMONEY',
        currency_type: 'GLOBAL_PLAYMONEY',
        balance: 20000,
        updated_at: '2026-10-16T08:00:00Z'
      },
      onboarding_preview: {
        account_creation_grant: {
          wallet_type: 'GLOBAL_PLAYMONEY',
          currency_type: 'GLOBAL_PLAYMONEY',
          amount: 20000,
          status: 'mock_only',
          trigger: 'firebase_account_created',
          api_available: false
        },
        club_creation_grant: {
          wallet_type: 'CLUB_TREASURY',
          currency_type: 'CLUB_CHIPS',
          amount: 10000,
          status: 'live',
          endpoint: 'POST /platform/clubs',
          owner_personal_balance_after_creation: 0
        }
      },
      club_wallets: [],
      table_stacks: [],
      recent_transactions: [],
      cashout_requests: []
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#wallet-dashboard-title')?.textContent).toContain('Alex');
    expect(fixture.nativeElement.querySelector('.wallet-mock-warning')?.textContent).toContain('No live wallet data');
    expect(fixture.nativeElement.querySelector('.wallet-account-summary strong')?.textContent).toContain('20,000');
    (fixture.nativeElement.querySelector('[aria-label="Close wallet dashboard"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.wallet-dashboard')).toBeNull();
  });

  it('should hide the sign-in gate and enable app content after authentication', () => {
    const fixture = TestBed.createComponent(App);
    const session = TestBed.inject(UserSessionStore);
    fixture.detectChanges();

    session.setAuthenticatedIdentity('global-user', 'Global Player', 'firebase-token');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.auth-gate-backdrop')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-content')?.hasAttribute('inert')).toBeFalse();
  });

  it('should expose create-account mode using the shared identifier and password fields', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const modeToggles = fixture.nativeElement.querySelectorAll('.auth-mode-toggle') as NodeListOf<HTMLButtonElement>;
    const modeToggle = Array.from(modeToggles).find((button) => button.textContent?.includes('New here?'))!;
    modeToggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.auth-header-row .eyebrow')?.textContent).toContain('CREATE ACCOUNT');
    expect(fixture.nativeElement.querySelectorAll('.auth-login-panel input').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.auth-button')?.textContent).toContain('Create account');
  });

  it('should navigate from clubhouse to the lobby', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.lobby-tile') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-screen')).not.toBeNull();
  });

  it('should expose the table wizard to all roles while reserving creation for owners and managers', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    app.screen.set('lobby');

    session.setVerifiedMember('owner-1', 'Owner', 'OWNER');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.create-table-card')).not.toBeNull();

    session.setVerifiedMember('manager-1', 'Manager', 'MANAGER');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.create-table-card')).not.toBeNull();
    (fixture.nativeElement.querySelector('.create-table-card') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-picker-grid')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.game-choice').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.game-choice')?.textContent).toContain('No-Limit Texas Hold’em');
    expect(fixture.nativeElement.querySelector('.table-template-button')).toBeNull();
    (fixture.nativeElement.querySelector('[data-game="no_limit_texas_holdem"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-template-editor')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.template-option-section').length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector('.table-mode-tabs')).not.toBeNull();

    session.setVerifiedMember('player-1', 'Player', 'PLAYER');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.create-table-card')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('.create-table-card') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('should show every table with its own game and table details', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.screen.set('lobby');
    app.lobbyTables = [
      { id: 'holdem-1', name: 'Holdem Main', gameId: 'no_limit_texas_holdem', game: 'No-Limit Texas Hold’em', stakes: '50 / 100', buyIn: '100 - 1000', players: '3 / 9', status: 'RUNNING' },
      { id: 'plo-1', name: 'Omaha Table', gameId: 'pot_limit_omaha', game: 'Pot-Limit Omaha', stakes: '100 / 200', buyIn: '200 - 2000', players: '2 / 6', status: 'OPEN' }
    ];
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.lobby-table-card') as NodeListOf<HTMLElement>;
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.game-badge')?.textContent).toContain('No-Limit Texas Hold’em');
    expect(cards[0].textContent).toContain('50 / 100');
    expect(cards[0].textContent).toContain('3 / 9');
    expect(cards[1].querySelector('.game-badge')?.textContent).toContain('Pot-Limit Omaha');
    expect(cards[1].textContent).toContain('100 / 200');
    expect(cards[1].textContent).toContain('2 / 6');

    app.selectLobbyGame('Pot-Limit Omaha');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.lobby-table-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.lobby-table-card .game-badge')?.textContent).toContain('Pot-Limit Omaha');

    app.selectLobbyGame('Missing game');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.lobby-table-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.lobby-empty-state')?.textContent).toContain('No club tables are open');
  });

  it('should toggle the table layout from grid to list and back using the layout shortcut', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.screen.set('lobby');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.table-list')?.classList.contains('list-view')).toBeFalse();
    expect(fixture.nativeElement.querySelector('.lobby-shortcuts')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Union tables"]')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('[aria-label="Create a new table"]') as HTMLButtonElement).disabled).toBeFalse();
    let layoutToggle = fixture.nativeElement.querySelector('[aria-label="Switch to list view"]') as HTMLButtonElement;
    expect(layoutToggle).not.toBeNull();
    expect(layoutToggle.textContent?.trim()).toBe('☰');

    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-bottom-menu')).not.toBeNull();
    (fixture.nativeElement.querySelector('.lobby-bottom-menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-shortcut-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.lobby-shortcut-bar small').length).toBe(5);

    layoutToggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-list')?.classList.contains('list-view')).toBeTrue();
    layoutToggle = fixture.nativeElement.querySelector('[aria-label="Switch to grid view"]') as HTMLButtonElement;
    expect(layoutToggle.textContent?.trim()).toBe('▦');
    expect(fixture.nativeElement.querySelector('.lobby-shortcut-bar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-bottom-menu')).not.toBeNull();

    layoutToggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-list')?.classList.contains('list-view')).toBeFalse();
    expect(fixture.nativeElement.querySelector('[aria-label="Switch to list view"]')?.textContent?.trim()).toBe('☰');

    (fixture.nativeElement.querySelector('.lobby-bottom-menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Close lobby shortcuts"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-shortcut-bar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-bottom-menu')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
  });

  it('should not submit games the catalog does not mark create-supported', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('owner-1', 'Owner', 'OWNER');
    app.tableDraftName.set('PLO Table');
    app.selectedClubGame.set('pot_limit_omaha');
    app.createClubTableFromWizard();

    expect(app.notice()).toContain('not enabled for table creation');
    expect(app.busy()).toBe('');
  });

  it('should create a table with the catalog game_id and documented request fields', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    session.setVerifiedMember('owner-1', 'Owner', 'OWNER', 'firebase-token');
    app.clubId = 'club-1';
    app.tableId = 'holdem-main';
    app.createTable();

    const request = http.expectOne('http://127.0.0.1:8000/clubs/club-1/tables/holdem-main');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      game_id: 'no_limit_texas_holdem',
      small_blind: 1,
      big_blind: 2,
      buy_in_min: 50,
      buy_in_max: 1000,
      table_size: 9
    });
    request.flush({});
  });

  it('should create a local table for its owner when the remote game catalog is empty', () => {
    localStorage.removeItem('cowboys-local-clubs');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    fixture.detectChanges();
    app.gameCatalog.set({ active_game_id: '', games: [] });
    app.gameCatalogLoaded.set(true);
    session.setAuthenticatedIdentity('template-creator', 'Template Creator', 'firebase-token');
    app.clubNameDraft.set('Micro Room');
    app.saveClubProfile();

    const club = app.homeClubCards.find((card) => card.name === 'Micro Room')!;
    app.openClubCard(club);
    app.openClubTableWizard();
    expect(app.clubGameOptions.map((game) => game.id)).toEqual(['no_limit_texas_holdem']);
    app.chooseClubGame('no_limit_texas_holdem');
    app.tableDraftName.set('Morning Game');
    app.createClubTableFromWizard();

    expect(app.lobbyTables.length).toBe(1);
    expect(app.lobbyTables[0].name).toBe('Morning Game');
    expect(app.lobbyTables[0].id).toBe('morning-game');
    expect(app.lobbyTables[0].game).toBe('No-Limit Texas Hold’em');
    expect(app.lobbyTables[0].stakes).toBe('1 / 2');
    expect(app.lobbyTables[0].buyIn).toBe('50 - 1000');
    expect(app.lobbyTables[0].players).toBe('0 / 9');
    expect(app.lobbyTables[0].localOnly).toBeTrue();
    localStorage.removeItem('cowboys-local-clubs');
  });

  it('should let preview users open the game picker but block table creation', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.screen.set('lobby');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.create-table-card') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-picker')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.table-wizard-notice')?.textContent).toContain('Preview only');

    app.tableDraftName.set('Preview table');
    app.createClubTableFromWizard();
    expect(app.notice()).toContain('verified club Owner or Manager');
    expect(app.busy()).toBe('');
  });

  it('should wrap the club carousel in both directions', () => {
    const app = TestBed.createComponent(App).componentInstance;

    app.moveClubSelection(-1);
    expect(app.clubCardIndex()).toBe(2);
    app.moveClubSelection(1);
    expect(app.clubCardIndex()).toBe(0);
    app.selectClubCard(2);
    app.moveClubSelection(1);
    expect(app.clubCardIndex()).toBe(0);
  });

  it('should open built-in club and global preview cards without using configured club access', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('club-owner', 'Club Owner', 'OWNER');
    fixture.detectChanges();

    const previewClub = app.homeClubCards.find((club) => club.id === 'cebu-preview')!;
    app.openClubCard(previewClub);
    fixture.detectChanges();

    expect(app.screen()).toBe('lobby');
    expect(app.activeClubName).toBe('Cebu Night Owls');
    expect(app.activeClubRole).toBe('PREVIEW');
    expect(app.lobbyTables).toEqual([]);
    expect((fixture.nativeElement.querySelector('.create-table-card') as HTMLButtonElement).disabled).toBeFalse();
    expect(app.notice()).toContain('preview room');

    app.openPrivateTable();
    expect(app.screen()).toBe('lobby');
    expect(app.notice()).toContain('not connected');

    const globalRoom = app.homeClubCards.find((club) => club.id === 'global-room')!;
    app.openClubCard(globalRoom);
    fixture.detectChanges();

    expect(app.screen()).toBe('lobby');
    expect(app.activeClubName).toBe('Cowboys Global Room');
    expect(app.activeClubRole).toBe('PREVIEW');
    expect(app.lobbyTables).toEqual([]);
    expect((fixture.nativeElement.querySelector('.create-table-card') as HTMLButtonElement).disabled).toBeFalse();
    expect(app.notice()).toContain('preview room');
  });

  it('should open the home menu and club profile from the home action', () => {
    localStorage.removeItem('cowboys-local-clubs');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.inject(UserSessionStore).setAuthenticatedIdentity('global-user', 'Global Player', 'firebase-token');

    (fixture.nativeElement.querySelector('[aria-label="Home"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).not.toBeNull();

    (fixture.nativeElement.querySelector('[role="menuitem"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#club-profile-title')?.textContent).toContain('Club Profile');
    expect(fixture.nativeElement.querySelectorAll('.club-logo-picker button').length).toBe(5);

    const nameInput = fixture.nativeElement.querySelector('input[name="clubName"]') as HTMLInputElement;
    nameInput.value = 'Harbor Cards';
    nameInput.dispatchEvent(new Event('input'));
    const noticeInput = fixture.nativeElement.querySelector('textarea[name="clubNotice"]') as HTMLTextAreaElement;
    noticeInput.value = 'Welcome to the table';
    noticeInput.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.club-profile-save') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.club-profile-dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('.club-display-name')?.textContent).toContain('Harbor Cards');
    expect(fixture.nativeElement.querySelector('.club-poster small')?.textContent).toContain('Welcome to the table');

    (fixture.nativeElement.querySelector('.club-display') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-screen')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-club-name')?.textContent).toContain('Harbor Cards');
    expect(fixture.nativeElement.querySelector('.lobby-club-name')?.textContent).toContain('OWNER');
    expect(fixture.nativeElement.querySelector('.create-table-card')).not.toBeNull();

    (fixture.nativeElement.querySelector('.create-table-card') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-game="no_limit_texas_holdem"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const tableName = fixture.nativeElement.querySelector('input[name="templateTableName"]') as HTMLInputElement;
    tableName.value = 'Harbor Main';
    tableName.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.table-template-editor > .table-wizard-actions button:last-child') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-table-card h3')?.textContent).toContain('Harbor Main');
    const enterTableButton = fixture.nativeElement.querySelector('.lobby-table-card .lobby-table-actions button') as HTMLButtonElement;
    expect(enterTableButton.disabled).toBeFalse();
    expect(enterTableButton.textContent).toContain('Enter table');
    enterTableButton.click();
    fixture.detectChanges();
    expect(app.screen()).toBe('table');
    expect(app.localPreviewTable()).toBeTrue();
    expect(app.snapshot()?.table_id).toBe('harbor-main');
    localStorage.removeItem('cowboys-local-clubs');
  });

  it('should expose management permissions only for management roles', () => {
    const session = TestBed.inject(UserSessionStore);
    expect(session.canManageTables()).toBeFalse();
    session.setVerifiedMember('manager-1', 'Manager', 'MANAGER');
    expect(session.canManageTables()).toBeTrue();
    expect(session.canManageClub()).toBeFalse();
    session.setVerifiedMember('agent-1', 'Agent', 'AGENT');
    expect(session.canManageTables()).toBeFalse();
    expect(session.canUseAgentDesk()).toBeTrue();
  });

  it('should grant role permissions only after backend membership verification', () => {
    const session = TestBed.inject(UserSessionStore);
    expect(session.membershipStatus()).toBe('signed-out');

    session.setAuthenticatedIdentity('firebase-user', 'Firebase User', 'id-token');
    expect(session.membershipStatus()).toBe('loading');
    expect(session.role()).toBe('PLAYER');
    expect(session.canManageTables()).toBeFalse();

    session.setVerifiedMember('backend-member', 'Club Manager', 'MANAGER', 'id-token');
    expect(session.membershipStatus()).toBe('verified');
    expect(session.canManageTables()).toBeTrue();

    session.clearSession();
    expect(session.membershipStatus()).toBe('signed-out');
    expect(session.firebaseIdToken()).toBeNull();
    expect(session.canManageTables()).toBeFalse();
  });

  it('should keep a valid global account distinct from club membership', () => {
    const session = TestBed.inject(UserSessionStore);
    session.setAuthenticatedIdentity('global-user', 'Global Player', 'id-token');
    session.membershipStatus.set('not-a-member');

    expect(session.memberId()).toBe('global-user');
    expect(session.firebaseIdToken()).toBe('id-token');
    expect(session.membershipStatus()).toBe('not-a-member');
    expect(session.canManageTables()).toBeFalse();
  });

  it('should scope union administration to an assigned union and clear it on member change', () => {
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('club-owner', 'Owner', 'OWNER');
    session.setUnionAdmin('union-1', true);

    expect(session.canManageTables()).toBeTrue();
    expect(session.canManageUnion('union-1')).toBeTrue();
    expect(session.canManageUnion('union-2')).toBeFalse();

    session.setVerifiedMember('other-member', 'Player', 'PLAYER');
    expect(session.canManageUnion('union-1')).toBeFalse();
  });

  it('should show the full member menu only for agent and higher roles', () => {
    const fixture = TestBed.createComponent(App);
    const session = TestBed.inject(UserSessionStore);
    fixture.detectChanges();

    session.setVerifiedMember('player-1', 'Player', 'PLAYER');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.member-nav button').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.member-nav button')?.textContent).toContain('ROLES');

    session.setVerifiedMember('agent-1', 'Agent', 'AGENT');
    fixture.detectChanges();
    const agentButtons = (Array.from(fixture.nativeElement.querySelectorAll('.member-nav button')) as Element[]).map((button) => button.textContent?.trim() ?? '');
    expect(agentButtons.some((label) => label.includes('SHOP'))).toBeTrue();
    expect(agentButtons.some((label) => label.includes('MESSAGE'))).toBeTrue();
    expect(agentButtons.some((label) => label.includes('MTT'))).toBeTrue();
    expect(agentButtons.some((label) => label.includes('CAREER'))).toBeTrue();
    expect(agentButtons.some((label) => label.includes('ROLES'))).toBeTrue();
  });

  it('should display all roles without allowing self-assignment', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.view-roles-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.role-card').length).toBe(5);
    expect(fixture.nativeElement.querySelector('.current-role-tag')?.textContent).toContain('CURRENT');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  it('should render empty seat placeholders according to the configured table size', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.screen.set('table');
    app.tableSize.set(6);
    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      game_id: 'no_limit_texas_holdem',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: [{
        seat: 0,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'active',
        hole_cards: [],
        in_hand: true
      }]
    } as any);
    fixture.detectChanges();

    const emptySeats = Array.from(fixture.nativeElement.querySelectorAll('.empty-seat-button')) as HTMLButtonElement[];
    expect(emptySeats.length).toBe(5);
    expect(emptySeats.every((seat) => seat.textContent?.includes('+'))).toBeTrue();
  });

  it('should map the server table_size snapshot field to the seat layout', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('player-1', 'Player', 'PLAYER');
    app.tableId = 'table-1';
    (app as any).applySnapshot({
      table_id: 'table-1',
      table_name: 'Test Table',
      table_size: 6,
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: []
    } as any);

    expect(app.tableSize()).toBe(6);
    expect(app.tableSeatSlots.length).toBe(6);
  });

  it('should keep the current player at the bottom while preserving seatmates around the table', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('player-1', 'Player', 'PLAYER');
    app.tableSize.set(8);
    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: [
        { seat: 4, user_id: 'player-1', username: 'Player', stack: 500, status: 'active', hole_cards: [], in_hand: true },
        { seat: 5, user_id: 'mike', username: 'Mike', stack: 500, status: 'active', hole_cards: [], in_hand: true },
        { seat: 3, user_id: 'jose', username: 'Jose', stack: 500, status: 'active', hole_cards: [], in_hand: true }
      ]
    } as any);

    const mySeat = app.seatPosition(4);
    const rightSeat = app.seatPosition(5);
    const leftSeat = app.seatPosition(3);

    expect(mySeat.y).toBeGreaterThan(rightSeat.y);
    expect(mySeat.x).toBeGreaterThan(leftSeat.x);
    expect(rightSeat.x).toBeGreaterThan(mySeat.x);
    expect(leftSeat.x).toBeLessThan(mySeat.x);
  });

  it('should request reconnect for a sat-out player without locally changing their state', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('player-1', 'Player', 'PLAYER');

    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: 'hand-1',
      is_hand_running: true,
      street: 0,
      current_bet: 0,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: 1,
      players: [{
        seat: 1,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'active',
        hole_cards: ['As', 'Kd'],
        in_hand: true,
        is_connected: false,
        is_sat_out: true,
        disconnect_seconds_left: 15
      }]
    } as any);

    app.handlePlayerDisconnected();
    expect(app.currentPlayer?.is_connected).toBeFalse();
    expect(app.currentPlayer?.is_sat_out).toBeTrue();
    const connectSpy = spyOn(app, 'connectTable');
    app.onImBack();
    expect(app.currentPlayer?.is_sat_out).toBeTrue();
    expect(connectSpy).toHaveBeenCalled();
    expect(app.notice()).toContain('requesting to sit back in');
  });

  it('should send correlated SIT_IN and clear sit-out only after the server snapshot', () => {
    const app = TestBed.createComponent(App).componentInstance;
    TestBed.inject(UserSessionStore).setVerifiedMember('player-1', 'Player', 'PLAYER');
    app.tableId = 'table-1';
    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: [{
        seat: 0,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'sat_out',
        hole_cards: [],
        in_hand: false,
        is_sat_out: true
      }]
    });
    app.socketStatus.set('disconnected');
    const sentMessages: string[] = [];
    const connectSpy = spyOn(app, 'connectTable');

    app.onImBack();
    expect(connectSpy).toHaveBeenCalled();
    expect(sentMessages).toEqual([]);
    (app as any).socket = {
      readyState: WebSocket.OPEN,
      send: (data: string) => sentMessages.push(data),
      close: () => undefined
    };
    (app as any).handleSocketMessage(JSON.stringify({ event: 'AUTHENTICATED' }));

    const sitInMessage = JSON.parse(sentMessages[0]);
    expect(sitInMessage.event).toBe('SIT_IN');
    expect(sitInMessage.correlation_id).toBeTruthy();
    expect(app.currentPlayer?.is_sat_out).toBeTrue();
    expect(app.sitInPending()).toBeTrue();

    (app as any).handleSocketMessage(JSON.stringify({
      event: 'TABLE_SNAPSHOT',
      payload: {
        table_id: 'table-1',
        players: [{
          seat: 0,
          user_id: 'player-1',
          username: 'Player',
          stack: 500,
          status: 'active',
          hole_cards: [],
          in_hand: false,
          is_sat_out: false
        }]
      }
    }));

    expect(app.currentPlayer?.is_sat_out).toBeFalse();
    expect(app.sitInPending()).toBeFalse();
  });

  it('should display server-provided action and disconnect timer values', () => {
    const app = TestBed.createComponent(App).componentInstance;
    TestBed.inject(UserSessionStore).setVerifiedMember('player-1', 'Player', 'PLAYER');
    app.tableId = 'table-1';
    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      game_id: 'no_limit_texas_holdem',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: 'hand-1',
      is_hand_running: true,
      street: 0,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: 0,
      players: [{
        seat: 0,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'active',
        hole_cards: [],
        in_hand: true,
        turn_seconds_left: 12
      }]
    });

    const player = app.currentPlayer!;
    expect(app.seatTimerType(player)).toBe('turn');
    expect(app.seatTimerSeconds(player)).toBe(12);
    expect(app.seatTimerDelay(player)).toBe('-8s');

    app.snapshot.update((snapshot) => ({
      ...snapshot!,
      players: [{ ...snapshot!.players[0], is_connected: false, disconnect_seconds_left: 8 }]
    }));
    expect(app.seatTimerType(app.currentPlayer!)).toBe('disconnect');
    expect(app.seatTimerSeconds(app.currentPlayer!)).toBe(8);
    expect(app.seatTimerDelay(app.currentPlayer!)).toBe('-12s');
  });

  it('should send the selected blind-entry choice and wait for a server snapshot', () => {
    const app = TestBed.createComponent(App).componentInstance;
    TestBed.inject(UserSessionStore).setVerifiedMember('player-1', 'Player', 'PLAYER');
    app.tableId = 'table-1';
    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      game_id: 'no_limit_texas_holdem',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: [{
        seat: 0,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'awaiting_blind_choice',
        hole_cards: [],
        in_hand: false,
        blind_decision_pending: true,
        blind_amount_to_post: 4
      }]
    });
    app.socketStatus.set('connected');
    const sentMessages: string[] = [];
    (app as any).socket = {
      readyState: WebSocket.OPEN,
      send: (data: string) => sentMessages.push(data),
      close: () => undefined
    };

    expect(app.currentTableRules?.displayName).toBe('No-Limit Hold’em Ring');
    expect(app.canChooseBlindEntry).toBeTrue();
    app.sendBlindEntryDecision('POST_BLIND');

    const decisionMessage = JSON.parse(sentMessages[0]);
    expect(decisionMessage.event).toBe('BLIND_DECISION');
    expect(decisionMessage.payload.decision).toBe('POST_BLIND');
    expect(decisionMessage.correlation_id).toBeTruthy();
    expect(app.currentPlayer?.blind_decision_pending).toBeTrue();
    expect(app.blindDecisionPending()).toBeTrue();

    (app as any).handleSocketMessage(JSON.stringify({
      event: 'TABLE_SNAPSHOT',
      payload: {
        table_id: 'table-1',
        game_id: 'no_limit_texas_holdem',
        players: [{
          seat: 0,
          user_id: 'player-1',
          username: 'Player',
          stack: 496,
          status: 'active',
          hole_cards: [],
          in_hand: false,
          blind_decision_pending: false
        }]
      }
    }));

    expect(app.canChooseBlindEntry).toBeFalse();
    expect(app.blindDecisionPending()).toBeFalse();
  });

  it('should require a fresh Firebase token before connecting to a table socket', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    delete (window as any).__COWBOYS_FIREBASE_CONFIG__;

    session.setVerifiedMember('player-1', 'Player', 'PLAYER', null);
    app.clubId = 'club-1';
    app.tableId = 'table-9';
    app.connectTable();
    await fixture.whenStable();

    expect(app.notice()).toContain('Firebase');
    expect(app.socketStatus()).toBe('disconnected');
  });

  it('should send pre-actions to the server and never execute them locally on turn change', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('player-1', 'Player', 'PLAYER');
    app.tableId = 'table-1';

    const socketSend = jasmine.createSpy('socketSend');
    (app as any).socket = { readyState: WebSocket.OPEN, send: socketSend, close: jasmine.createSpy('close') };

    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: 'hand-1',
      is_hand_running: true,
      street: 0,
      current_bet: 25,
      players: [{
        seat: 1,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'active',
        hole_cards: ['As', 'Kd'],
        in_hand: true
      }]
    } as any);
    fixture.detectChanges();

    app.togglePreAction('check-fold');
    fixture.detectChanges();
    expect(app.preAction()).toBeNull();
    expect(app.preActionPending()).toBeTrue();
    const preActionMessage = JSON.parse(socketSend.calls.mostRecent().args[0]);
    expect(preActionMessage.version).toBe('1.0');
    expect(preActionMessage.topic).toBe('clubs/demo/tables/table-1/game');
    expect(preActionMessage.event).toBe('PRE_ACTION');
    expect(preActionMessage.payload).toEqual({ action: 'CHECK_FOLD' });
    expect(preActionMessage.correlation_id).toBeTruthy();

    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: 'hand-1',
      is_hand_running: true,
      street: 0,
      current_bet: 25,
      active_turn_seat: 1,
      players: [{
        seat: 1,
        user_id: 'player-1',
        username: 'Player',
        stack: 500,
        status: 'active',
        hole_cards: ['As', 'Kd'],
        in_hand: true
      }]
    } as any);
    fixture.detectChanges();

    expect(app.preAction()).toBeNull();
    expect(socketSend).toHaveBeenCalledTimes(1);
    (app as any).handleSocketMessage(JSON.stringify({
      version: '1.0',
      topic: 'clubs/demo/tables/table-1/game',
      event: 'PRE_ACTION_SET',
      correlation_id: preActionMessage.correlation_id,
      payload: { action: 'CHECK_FOLD' }
    }));
    expect(app.preAction()).toBeNull();
    expect(app.preActionPending()).toBeFalse();
    (app as any).handleSocketMessage(JSON.stringify({
      version: '1.0',
      topic: 'clubs/demo/tables/table-1/game',
      event: 'TABLE_SNAPSHOT',
      correlation_id: 'snapshot-1',
      payload: {
        table_id: 'table-1',
        table_name: 'Test Table',
        is_union_table: false,
        union_id: null,
        origin_club_id: null,
        hand_id: 'hand-1',
        is_hand_running: true,
        street: 0,
        current_bet: 25,
        active_turn_seat: 1,
        players: [{
          seat: 1,
          user_id: 'player-1',
          username: 'Player',
          stack: 500,
          status: 'active',
          hole_cards: ['As', 'Kd'],
          in_hand: true,
          pre_action: 'CHECK_FOLD'
        }]
      }
    }));
    expect(app.preAction()).toBe('check-fold');
  });

  it('should send player actions in a v1 envelope with a new action_id', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.clubId = 'club-1';
    app.tableId = 'table-7';
    app.raiseTo = 300;
    const socketSend = jasmine.createSpy('socketSend');
    (app as any).socket = { readyState: WebSocket.OPEN, send: socketSend, close: jasmine.createSpy('close') };

    app.sendAction('RAISE');

    const message = JSON.parse(socketSend.calls.mostRecent().args[0]);
    expect(message).toEqual(jasmine.objectContaining({
      version: '1.0',
      topic: 'clubs/club-1/tables/table-7/game',
      event: 'PLAYER_ACTION',
      payload: jasmine.objectContaining({ action: 'RAISE', amount: 300 })
    }));
    expect(message.correlation_id).toBeTruthy();
    expect(message.payload.action_id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('should reply to server PING using the same v1 topic and correlation_id', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.clubId = 'club-1';
    app.tableId = 'table-7';
    const socketSend = jasmine.createSpy('socketSend');
    (app as any).socket = { readyState: WebSocket.OPEN, send: socketSend, close: jasmine.createSpy('close') };

    (app as any).handleSocketMessage(JSON.stringify({
      version: '1.0',
      topic: 'clubs/club-1/tables/table-7/game',
      event: 'PING',
      correlation_id: 'ping-42',
      payload: {}
    }));

    expect(JSON.parse(socketSend.calls.mostRecent().args[0])).toEqual({
      version: '1.0',
      topic: 'clubs/club-1/tables/table-7/game',
      event: 'PONG',
      correlation_id: 'ping-42',
      payload: {}
    });
  });

  it('should construct the documented union topic for v1 socket messages', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.clubId = 'home-club';
    app.tableId = 'shared-table';
    app.tableUnionId.set('union-1');

    const envelope = (app as any).createSocketEnvelope('AUTHENTICATE', {
      id_token: 'firebase-token',
      club_id: 'home-club'
    }, 'auth-1');

    expect(envelope).toEqual({
      version: '1.0',
      topic: 'unions/union-1/tables/shared-table/game',
      event: 'AUTHENTICATE',
      correlation_id: 'auth-1',
      payload: { id_token: 'firebase-token', club_id: 'home-club' }
    });
  });

  it('should map standardized backend errors and retain their trace ID', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const error = new HttpErrorResponse({
      status: 409,
      error: { code: 40902, trace_id: 'trace-7' }
    });

    expect(app.errorMessage(error)).toContain('action ID');
    expect(app.errorMessage(error)).toContain('trace-7');
  });

  it('should open replay for a completed hand and return to the table', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Test Table',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: 'hand-1',
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: []
    });
    app.screen.set('table');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.control-rail')).toBeNull();
    expect(fixture.nativeElement.querySelector('.menu-toggle')).toBeNull();
    expect(fixture.nativeElement.querySelector('.table-panel')).not.toBeNull();

    (fixture.nativeElement.querySelector('.replay-open-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-hand-replay-container')).not.toBeNull();

    app.closeReplay();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-panel')).not.toBeNull();
  });

  it('should render separate club and union lobby tabs and tag shared tables by origin', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    app.screen.set('lobby');
    app.unions.set([{ union_id: 'union-1', name: 'Pinoy Poker Alliance' }]);
    app.selectedUnionId.set('union-1');
    app.unionTables.set([{
      id: 'union-table-1',
      name: 'Union Main',
      game: 'NLH',
      stakes: '50 / 100',
      buyIn: '500 - 5000',
      players: '2 / 9',
      status: 'RUNNING',
      unionId: 'union-1',
      originClubId: 'club-cebu',
      seatedCount: 2
    }]);

    session.setUnionAdmin('union-1', true);
    app.lobbyScope.set('union');
    fixture.detectChanges();

    const tabs = Array.from(fixture.nativeElement.querySelectorAll('.lobby-scope-tabs button')) as HTMLButtonElement[];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Club Tables', 'Union Tables']);
    expect(fixture.nativeElement.querySelector('.table-origin-tag')?.textContent).toContain('club-cebu');
    expect(fixture.nativeElement.querySelector('.lobby-section-heading')?.textContent).toContain('Create union table');
  });

  it('should keep the manager deal action on the table surface', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    TestBed.inject(UserSessionStore).setVerifiedMember('manager-1', 'Manager', 'MANAGER');
    app.screen.set('table');
    app.snapshot.set({
      table_id: 'table-1',
      table_name: 'Main',
      is_union_table: false,
      union_id: null,
      origin_club_id: null,
      hand_id: null,
      is_hand_running: false,
      street: null,
      community_cards: [],
      pot: 0,
      pots: [],
      active_turn_seat: null,
      players: [
        { seat: 0, user_id: 'manager-1', username: 'Manager', stack: 500, status: 'active', hole_cards: [], in_hand: false },
        { seat: 1, user_id: 'player-1', username: 'Player', stack: 500, status: 'active', hole_cards: [], in_hand: false }
      ]
    } as any);
    fixture.detectChanges();

    const dealButton = fixture.nativeElement.querySelector('.deal-hand-button') as HTMLButtonElement;
    expect(dealButton).not.toBeNull();
    expect(dealButton.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.control-rail')).toBeNull();
  });
});
