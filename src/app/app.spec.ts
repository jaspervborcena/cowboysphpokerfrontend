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
  });

  it('should navigate from clubhouse to the lobby', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.lobby-tile') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.lobby-screen')).not.toBeNull();
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
