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
    expect(fixture.nativeElement.querySelectorAll('.role-card').length).toBe(4);
    expect(fixture.nativeElement.querySelector('.current-role-tag')?.textContent).toContain('CURRENT');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  it('should open replay for a completed hand and return to the table', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.snapshot.set({
      table_id: 'table-1',
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
});
