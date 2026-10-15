import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';
import { UserSessionStore } from './core/user-session.store';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.isMyTurn).toBeFalse();
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
    expect(fixture.nativeElement.querySelector('.empty-create-table-button')).not.toBeNull();
    (fixture.nativeElement.querySelector('.empty-create-table-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-picker-grid')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.game-choice').length).toBe(9);

    (fixture.nativeElement.querySelector('.table-template-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-template-editor')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.template-option-section').length).toBe(6);
    expect(fixture.nativeElement.querySelectorAll('.template-range-row').length).toBeGreaterThan(10);
    (fixture.nativeElement.querySelector('[aria-label="Back to game selection"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-game="NLH"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.table-settings-form')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.table-rule-row').length).toBe(7);

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
      { id: 'holdem-1', name: 'Holdem Main', game: 'NLH', stakes: '50 / 100', buyIn: '100 - 1000', players: '3 / 9', status: 'RUNNING' },
      { id: 'plo-1', name: 'Omaha Table', game: 'PLO', stakes: '100 / 200', buyIn: '200 - 2000', players: '2 / 6', status: 'OPEN' }
    ];
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.lobby-table-card') as NodeListOf<HTMLElement>;
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.game-badge')?.textContent).toContain('NLH');
    expect(cards[0].textContent).toContain('50 / 100');
    expect(cards[0].textContent).toContain('3 / 9');
    expect(cards[1].querySelector('.game-badge')?.textContent).toContain('PLO');
    expect(cards[1].textContent).toContain('100 / 200');
    expect(cards[1].textContent).toContain('2 / 6');

    app.selectLobbyGame('PLO');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.lobby-table-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.lobby-table-card .game-badge')?.textContent).toContain('PLO');

    app.selectLobbyGame('Badugi');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.lobby-table-card').length).toBe(0);
    expect(fixture.nativeElement.querySelector('.lobby-empty-state')?.textContent).toContain('No club tables are open');
  });

  it('should use the horizontal shortcut bar as the only lobby navigation', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.screen.set('lobby');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.lobby-shortcuts')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Union tables"]')).not.toBeNull();
    expect((fixture.nativeElement.querySelector('[aria-label="Create a new table"]') as HTMLButtonElement).disabled).toBeFalse();

    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-bottom-menu')).not.toBeNull();
    (fixture.nativeElement.querySelector('.lobby-bottom-menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-shortcut-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.lobby-shortcut-bar small').length).toBe(5);

    (fixture.nativeElement.querySelector('[aria-label="Messages"]') as HTMLButtonElement).click();
    expect(app.notice()).toContain('Messages are not available');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-shortcut-bar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-bottom-menu')).not.toBeNull();

    (fixture.nativeElement.querySelector('.lobby-bottom-menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[aria-label="Close lobby shortcuts"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-shortcut-bar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-bottom-menu')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.lobby-nav')).toBeNull();
  });

  it('should not submit unsupported table game modes to the backend', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('owner-1', 'Owner', 'OWNER');
    app.tableDraftName.set('PLO Table');
    app.selectedClubGame.set('PLO');
    app.createClubTableFromWizard();

    expect(app.notice()).toContain('Regular NLH tables only');
    expect(app.busy()).toBe('');
  });

  it('should create a named local table using the JSON micro-game defaults', () => {
    localStorage.removeItem('cowboys-local-clubs');
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setAuthenticatedIdentity('template-creator', 'Template Creator', 'firebase-token');
    app.clubNameDraft.set('Micro Room');
    app.saveClubProfile();

    const club = app.homeClubCards.find((card) => card.name === 'Micro Room')!;
    app.openClubCard(club);
    app.openTableTemplate();
    app.tableDraftName.set('Morning Game');
    app.createClubTableFromWizard();

    expect(app.lobbyTables.length).toBe(1);
    expect(app.lobbyTables[0].name).toBe('Morning Game');
    expect(app.lobbyTables[0].id).toBe('morning-game');
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
    expect(fixture.nativeElement.querySelector('.empty-create-table-button')).not.toBeNull();

    (fixture.nativeElement.querySelector('.create-table-card') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-game="NLH"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const tableName = fixture.nativeElement.querySelector('input[name="tableDraftName"]') as HTMLInputElement;
    tableName.value = 'Harbor Main';
    tableName.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.table-settings-form button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-table-card h3')?.textContent).toContain('Harbor Main');
    expect(fixture.nativeElement.querySelector('.lobby-table-card button[disabled]')?.textContent).toContain('Local preview');
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

  it('should auto-sit a disconnected player out after the grace window and expose an I\'m Back action', () => {
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
        is_sat_out: false,
        disconnect_seconds_left: 15
      }]
    } as any);

    app.handlePlayerDisconnected();
    app.disconnectTimer.set(0);
    app.autoResolveDisconnect();

    expect(app.currentPlayer?.is_connected).toBeFalse();
    expect(app.currentPlayer?.is_sat_out).toBeTrue();
    expect(app.isCurrentPlayerSatOut).toBeTrue();
    app.onImBack();
    expect(app.currentPlayer?.is_sat_out).toBeFalse();
  });

  it('should require a Firebase token before connecting to a table socket', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);

    session.setVerifiedMember('player-1', 'Player', 'PLAYER', null);
    app.clubId = 'club-1';
    app.tableId = 'table-9';
    app.connectTable();

    expect(app.notice()).toContain('Firebase');
    expect(app.socketStatus()).toBe('disconnected');
  });

  it('should auto-check or fold when a queued pre-action is triggered by the turn snapshot', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('player-1', 'Player', 'PLAYER');

    const sendActionSpy = spyOn(app, 'sendAction');

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
    expect(app.preAction()).toBe('check-fold');

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
    expect(sendActionSpy).toHaveBeenCalledWith('FOLD');
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
});
