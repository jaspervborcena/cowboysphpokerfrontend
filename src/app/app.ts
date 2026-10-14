import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Observable } from 'rxjs';
import { ClubApiService, ClubMembershipResponse, ClubTableSummary, ClubUnionSummary } from './core/club-api.service';
import { FirebaseAuthService } from './core/firebase-auth.service';
import { UserSessionStore } from './core/user-session.store';
import { HandReplayContainerComponent } from './features/hand-replay/hand-replay-container.component';

type PokerPlayer = {
  seat: number;
  user_id: string;
  username: string;
  stack: number;
  status: string;
  hole_cards: string[];
  in_hand: boolean;
  is_connected?: boolean;
  is_sat_out?: boolean;
  disconnect_seconds_left?: number;
  club_id?: string | null;
};

type TableSnapshot = {
  table_id: string;
  table_name: string;
  is_union_table: boolean;
  union_id: string | null;
  origin_club_id: string | null;
  hand_id: string | null;
  is_hand_running: boolean;
  street: number | null;
  current_bet?: number | null;
  currentBet?: number | null;
  community_cards: string[];
  pot: number;
  pots: unknown[];
  active_turn_seat: number | null;
  players: PokerPlayer[];
};

interface LobbyTable {
  id: string;
  name: string;
  game: string;
  stakes: string;
  buyIn: string;
  players: string;
  status: string;
  featured?: boolean;
  unionId?: string;
  originClubId?: string;
  seatedCount?: number;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, HandReplayContainerComponent],
  templateUrl: './table.html'
})
export class App implements OnInit, OnDestroy {
  screen = signal<'home' | 'lobby' | 'table' | 'replay'>('home');
  lobbyGame = signal('ALL');
  lobbyScope = signal<'club' | 'union'>('club');
  unions = signal<ClubUnionSummary[]>([]);
  unionTables = signal<LobbyTable[]>([]);
  selectedUnionId = signal<string | null>(null);
  tableUnionId = signal<string | null>(null);
  unionCreateOpen = signal(false);
  rolesOpen = signal(false);
  roleCards = [
    { role: 'UNION_ADMIN', title: 'Union admin', rights: 'Create and start shared union tables. Club owners cannot create tables on the union floor.' },
    { role: 'OWNER', title: 'Club owner', rights: 'Manage the club, appoint managers and agents, issue master chips, review analytics, and control tables.' },
    { role: 'MANAGER', title: 'Manager', rights: 'Create and close tables, approve seats, review table performance, and manage player access.' },
    { role: 'AGENT', title: 'Agent', rights: 'Manage chip transfers for assigned players and view downline summaries.' },
    { role: 'PLAYER', title: 'Player', rights: 'Join tables, request a buy-in, play hands, and view personal hand history. Cannot set a chip balance or see opponents’ private cards.' }
  ];
  lobbyTables: LobbyTable[] = [
    { id: 'table-1', name: 'Manila Midnight', game: 'NLH', stakes: '50 / 100', buyIn: '500', players: '5 / 9', status: 'RUNNING', featured: true },
    { id: 'table-2', name: 'Blue Room', game: 'NLH', stakes: '10 / 20', buyIn: '100', players: '3 / 9', status: 'OPEN' },
    { id: 'table-3', name: 'High Hand', game: 'PLO', stakes: '100 / 200', buyIn: '2,000', players: '7 / 9', status: 'RUNNING' },
    { id: 'table-4', name: 'Sunday Club', game: 'NLH', stakes: '25 / 50', buyIn: '250', players: '4 / 9', status: 'OPEN' }
  ];
  readonly session: UserSessionStore;
  private readonly clubApi = inject(ClubApiService);
  private readonly firebaseAuth = inject(FirebaseAuthService);
  apiBase = 'http://127.0.0.1:8000';
  clubId = 'demo';
  tableId = 'table-1';
  smallBlind = 50;
  bigBlind = 100;
  buyInMin = 100;
  buyInMax = 1000;
  tableSize = signal<number>(9);
  seatIndex = 0;
  buyInAmount = 500;
  unionTableName = 'Union Main';
  unionTableId = 'union-table-1';
  raiseTo = 300;
  health = signal<'checking' | 'online' | 'offline'>('checking');
  socketStatus = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  snapshot = signal<TableSnapshot | null>(null);
  disconnectTimer = signal<number>(15);
  busy = signal('');
  notice = signal('');
  loginEmail = signal('');
  loginPassword = signal('');
  loginPhone = signal('');
  loginPhonePassword = signal('');
  loginError = signal('');
  signingIn = signal(false);
  controlsOpen = signal(false);
  preAction = signal<'check-fold' | 'fold' | 'call-any' | null>(null);
  private socket: WebSocket | null = null;
  private pendingBuyInId: string | null = null;
  private unsubscribeAuthState: (() => void) | null = null;

  constructor(private readonly http: HttpClient, session: UserSessionStore) {
    this.session = session;

    effect(() => {
      this.resolveQueuedPreAction();
    });
  }

  ngOnInit(): void {
    this.checkHealth();
    if (!this.firebaseAuth.isConfigured()) return;

    this.unsubscribeAuthState = this.firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) {
        this.session.clearSession();
        return;
      }

      const idToken = await this.firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        this.session.clearSession();
        this.session.membershipStatus.set('unavailable');
        return;
      }

      this.session.setAuthenticatedIdentity(
        user.uid,
        user.displayName || user.email || user.phoneNumber || 'Authenticated player',
        idToken
      );
      this.loadMemberSession();
      this.loadLobbyData();
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeAuthState?.();
    this.closeSocket();
  }

  get players(): PokerPlayer[] {
    return this.snapshot()?.players ?? [];
  }

  get tableSeatSlots(): Array<{ seat: number; player?: PokerPlayer }> {
    const playerLookup = new Map((this.snapshot()?.players ?? []).map((player) => [player.seat, player]));
    return Array.from({ length: this.tableSize() }, (_, seat) => ({ seat, player: playerLookup.get(seat) }));
  }

  get userId(): string {
    return this.session.memberId() || '—';
  }

  get username(): string {
    return this.session.displayName();
  }

  get currentPlayer(): PokerPlayer | undefined {
    return this.players.find((player) => player.user_id === this.userId);
  }

  get isCurrentPlayerSatOut(): boolean {
    return this.currentPlayer?.is_sat_out ?? false;
  }

  get isMyTurn(): boolean {
    const snapshot = this.snapshot();
    const player = this.currentPlayer;
    return snapshot !== null && player !== undefined && player.seat === snapshot.active_turn_seat;
  }

  get currentBet(): number {
    const snapshot = this.snapshot() as Record<string, unknown> | null;
    if (!snapshot) return 0;
    const value = snapshot['current_bet'] ?? snapshot['currentBet'] ?? snapshot['bet_to_call'] ?? snapshot['to_call'] ?? 0;
    return Number(value) || 0;
  }

  togglePreAction(action: 'check-fold' | 'fold' | 'call-any'): void {
    if (this.isMyTurn) return;
    const nextValue = this.preAction() === action ? null : action;
    this.preAction.set(nextValue);
    this.resolveQueuedPreAction();
  }

  toggleControls(): void {
    this.controlsOpen.update((open) => !open);
  }

  private async finalizeSignedInUser(label: string): Promise<void> {
    const idToken = await this.firebaseAuth.getCurrentIdToken();
    const user = await this.firebaseAuth.getCurrentUser();
    const memberId = user?.uid || label;
    const displayName = user?.displayName || user?.email || user?.phoneNumber || label.split('@')[0] || 'Authenticated player';

    if (idToken) this.session.setAuthenticatedIdentity(memberId, displayName, idToken);
    this.notice.set(`Signed in as ${displayName}. Fetching club membership...`);
    this.loginError.set('');
    this.signingIn.set(false);

    if (idToken) {
      this.loadMemberSession();
      this.loadLobbyData();
    } else {
      this.session.membershipStatus.set('unavailable');
    }
  }

  async signOutCurrentUser(): Promise<void> {
    await this.firebaseAuth.signOut();
    this.session.clearSession();
    this.loginEmail.set('');
    this.loginPassword.set('');
    this.loginPhone.set('');
    this.loginPhonePassword.set('');
    this.loginError.set('');
    this.notice.set('Signed out.');
  }

  async signInWithEmailPassword(): Promise<void> {
    if (!this.loginEmail() || !this.loginPassword()) {
      this.loginError.set('Enter an email and password to continue.');
      return;
    }

    this.signingIn.set(true);
    this.loginError.set('');
    const ok = await this.firebaseAuth.signInWithEmailAndPassword(this.loginEmail(), this.loginPassword());
    if (!ok) {
      this.loginError.set('Email sign-in failed. Check your Firebase auth setup.');
      this.signingIn.set(false);
      return;
    }

    await this.finalizeSignedInUser(this.loginEmail());
  }

  async signInWithGoogle(): Promise<void> {
    this.signingIn.set(true);
    this.loginError.set('');
    const ok = await this.firebaseAuth.signInWithGoogle();
    if (!ok) {
      this.loginError.set('Google sign-in failed. Make sure Google Auth is enabled in Firebase.');
      this.signingIn.set(false);
      return;
    }

    await this.finalizeSignedInUser('google-user');
  }

  async signInWithPhone(): Promise<void> {
    const phoneNumber = this.loginPhone().trim();
    const password = this.loginPhonePassword();
    if (!phoneNumber || !password) {
      this.loginError.set('Enter your phone number and password to continue.');
      return;
    }

    this.signingIn.set(true);
    this.loginError.set('');
    try {
      const response = await firstValueFrom(this.clubApi.signInWithPhonePassword(
        this.baseUrl(),
        phoneNumber,
        password
      ));
      const signedIn = await this.firebaseAuth.signInWithCustomToken(response.firebase_custom_token);
      if (!signedIn) throw new Error('Firebase rejected the custom token.');

      await this.finalizeSignedInUser(phoneNumber);
      this.loginPhonePassword.set('');
    } catch {
      this.loginError.set('Phone sign-in failed. Check your phone number and password.');
      this.signingIn.set(false);
    }
  }

  chooseEmptySeat(seat: number): void {
    this.seatIndex = seat;
    this.controlsOpen.set(true);
    this.notice.set(`Seat ${seat + 1} is open. Set your buy-in to at least ${this.buyInMin} chips and click Seat player to join.`);
  }

  goHome(): void {
    this.screen.set('home');
  }

  enterLobby(game = 'ALL'): void {
    this.lobbyGame.set(game);
    this.screen.set('lobby');
    this.loadLobbyData();
  }

  openTable(tableId: string, unionId: string | null = null): void {
    this.tableId = tableId;
    this.tableUnionId.set(unionId);
    this.screen.set('table');
    this.connectTable();
  }

  selectLobbyScope(scope: 'club' | 'union'): void {
    this.lobbyScope.set(scope);
    this.unionCreateOpen.set(false);
    if (scope === 'union' && this.selectedUnionId()) this.loadUnionTables();
  }

  selectUnion(unionId: string): void {
    this.selectedUnionId.set(unionId);
    this.loadUnionTables();
  }

  toggleUnionCreate(): void {
    this.unionCreateOpen.update((open) => !open);
  }

  get visibleLobbyTables(): LobbyTable[] {
    return this.lobbyScope() === 'union' ? this.unionTables() : this.lobbyTables;
  }

  openReplay(): void {
    if (!this.snapshot()?.hand_id || this.snapshot()?.is_hand_running) return;
    this.screen.set('replay');
  }

  canManageCurrentTable(): boolean {
    return this.tableUnionId()
      ? this.session.canManageUnion(this.tableUnionId())
      : this.session.canManageTables();
  }

  isCurrentRoleCard(role: string): boolean {
    return role === 'UNION_ADMIN'
      ? this.session.unionAdminIds().length > 0
      : this.session.role() === role;
  }

  closeReplay(): void {
    this.screen.set('table');
  }

  selectLobbyGame(game: string): void {
    this.lobbyGame.set(game);
  }

  openRoleGuide(): void {
    this.rolesOpen.set(true);
  }

  closeRoleGuide(): void {
    this.rolesOpen.set(false);
  }

  checkHealth(): void {
    this.health.set('checking');
    this.http.get<{ status: string }>(`${this.baseUrl()}/health`).subscribe({
      next: () => this.health.set('online'),
      error: () => this.health.set('offline')
    });
  }

  private loadMemberSession(): void {
    const idToken = this.session.firebaseIdToken();
    if (!idToken) return;

    this.clubApi.getMembership(this.baseUrl(), this.clubId, idToken).subscribe({
      next: (membership: ClubMembershipResponse) => {
        if (this.session.firebaseIdToken() !== idToken) return;
        this.session.setVerifiedMember(membership.user_id, membership.username, membership.role, idToken);
        this.notice.set(`Authenticated as ${membership.username} (${membership.role}).`);
      },
      error: () => {
        if (this.session.firebaseIdToken() !== idToken) return;
        this.session.membershipStatus.set('unavailable');
        this.notice.set('Unable to verify your club membership. Table and management access are unavailable.');
      }
    });
  }

  private loadLobbyData(): void {
    const idToken = this.session.firebaseIdToken();
    if (!idToken) return;

    this.clubApi.getTables(this.baseUrl(), this.clubId, idToken).subscribe({
      next: (tables: ClubTableSummary[]) => {
        if (tables.length > 0) {
          this.lobbyTables = tables.map((table) => this.toLobbyTable(table));
        }
      },
      error: () => {
        this.notice.set('No live club data is available yet; demo lobby data is active.');
      }
    });
    this.clubApi.getUnions(this.baseUrl(), this.clubId, idToken).subscribe({
      next: (unions) => {
        this.unions.set(unions);
        const selected = this.selectedUnionId();
        if (!selected || !unions.some((union) => union.union_id === selected)) {
          this.selectedUnionId.set(unions[0]?.union_id ?? null);
        }
        for (const union of unions) {
          this.clubApi.getUnionMembership(this.baseUrl(), union.union_id, idToken).subscribe({
            next: () => this.session.setUnionAdmin(union.union_id, true),
            error: () => this.session.setUnionAdmin(union.union_id, false)
          });
        }
        if (this.lobbyScope() === 'union') this.loadUnionTables();
      },
      error: () => {
        this.unions.set([]);
        this.unionTables.set([]);
      }
    });
  }

  private loadUnionTables(): void {
    const idToken = this.session.firebaseIdToken();
    const unionId = this.selectedUnionId();
    if (!idToken || !unionId) {
      this.unionTables.set([]);
      return;
    }
    this.clubApi.getUnionTables(this.baseUrl(), this.clubId, unionId, idToken).subscribe({
      next: (tables) => this.unionTables.set(tables.map((table) => this.toLobbyTable(table))),
      error: (error: unknown) => {
        this.unionTables.set([]);
        this.notice.set(this.errorMessage(error));
      }
    });
  }

  private toLobbyTable(table: ClubTableSummary): LobbyTable {
    return {
      id: table.table_id,
      name: table.table_name,
      game: 'NLH',
      stakes: `${table.small_blind} / ${table.big_blind}`,
      buyIn: `${table.buy_in_min} - ${table.buy_in_max}`,
      players: `${table.seated_count} / ${table.max_seats}`,
      status: table.is_hand_running ? 'RUNNING' : 'OPEN',
      unionId: table.union_id ?? undefined,
      originClubId: table.origin_club_id ?? undefined,
      seatedCount: table.seated_count
    };
  }

  createTable(): void {
    if (!this.session.canManageTables()) return;
    const idToken = this.requireFirebaseToken('creating a table');
    if (!idToken) return;
    this.runRequest('create', () => this.http.post(this.tableUrl(), {
      small_blind: Number(this.smallBlind),
      big_blind: Number(this.bigBlind),
      buy_in_min: Number(this.buyInMin),
      buy_in_max: Number(this.buyInMax),
      table_size: Number(this.tableSize())
    }, {
      headers: { Authorization: `Bearer ${idToken}` }
    }));
  }

  createUnionTable(): void {
    const unionId = this.selectedUnionId();
    if (!this.session.canManageUnion(unionId) || !unionId) return;
    const idToken = this.requireFirebaseToken('creating a union table');
    if (!idToken) return;
    this.busy.set('union-create');
    this.clubApi.createUnionTable(this.baseUrl(), unionId, this.unionTableId, idToken, {
      origin_club_id: this.clubId,
      table_name: this.unionTableName,
      small_blind: Number(this.smallBlind),
      big_blind: Number(this.bigBlind),
      buy_in_min: Number(this.buyInMin),
      buy_in_max: Number(this.buyInMax),
      table_size: Number(this.tableSize())
    }).subscribe({
      next: () => {
        this.notice.set('Union table created.');
        this.unionCreateOpen.set(false);
        this.busy.set('');
        this.loadUnionTables();
      },
      error: (error: unknown) => {
        this.notice.set(this.errorMessage(error));
        this.busy.set('');
      }
    });
  }

  deleteUnionTable(table: LobbyTable): void {
    const unionId = table.unionId;
    if (!unionId || !this.session.canManageUnion(unionId) || table.seatedCount !== 0) return;
    const idToken = this.requireFirebaseToken('deleting an empty union table');
    if (!idToken) return;
    this.busy.set(`union-delete:${table.id}`);
    this.clubApi.deleteUnionTable(this.baseUrl(), unionId, table.id, idToken).subscribe({
      next: () => {
        this.notice.set('Union table deleted.');
        this.busy.set('');
        this.loadUnionTables();
      },
      error: (error: unknown) => {
        this.notice.set(this.errorMessage(error));
        this.busy.set('');
      }
    });
  }

  seatPlayer(): void {
    const minimumBuyIn = Number(this.buyInMin) || 0;
    const requestedBuyIn = Number(this.buyInAmount) || 0;
    if (requestedBuyIn < minimumBuyIn) {
      this.notice.set(`This table requires a minimum buy-in of ${minimumBuyIn} chips.`);
      return;
    }

    const availableStack = this.currentPlayer?.stack ?? 0;
    if (availableStack < requestedBuyIn) {
      this.notice.set(`You need at least ${requestedBuyIn} chips in your stack to sit here.`);
      return;
    }

    const idToken = this.requireFirebaseToken('joining a table');
    if (!idToken) return;
    this.pendingBuyInId ??= crypto.randomUUID();
    const request = {
      seat_index: Number(this.seatIndex),
      buy_in_amount: requestedBuyIn,
      buy_in_id: this.pendingBuyInId
    };
    if (this.tableUnionId()) {
      this.runRequest('seat', () => this.clubApi.seatUnionPlayer(
        this.baseUrl(),
        this.tableUnionId()!,
        this.tableId,
        this.clubId,
        idToken,
        request
      ));
      return;
    }
    this.runRequest('seat', () => this.http.post<TableSnapshot>(`${this.tableUrl()}/seats`, request, {
      headers: { Authorization: `Bearer ${idToken}` }
    }));
  }

  startHand(): void {
    if (this.tableUnionId() ? !this.session.canManageUnion(this.tableUnionId()) : !this.session.canManageTables()) return;
    const idToken = this.requireFirebaseToken('starting a hand');
    if (!idToken) return;
    if (this.tableUnionId()) {
      this.runRequest('start', () => this.clubApi.startUnionHand(
        this.baseUrl(),
        this.tableUnionId()!,
        this.tableId,
        idToken
      ));
      return;
    }
    this.runRequest('start', () => this.http.post<TableSnapshot>(`${this.tableUrl()}/hands`, null, {
      headers: { Authorization: `Bearer ${idToken}` }
    }));
  }

  connectTable(): void {
    const idToken = this.requireFirebaseToken('joining a live table');
    if (!idToken) return;
    this.closeSocket();
    this.socketStatus.set('connecting');
    this.notice.set('');
    this.updatePlayerState(this.userId, { is_connected: true, is_sat_out: false, disconnect_seconds_left: 15 });
    const base = this.baseUrl().replace(/^http/, 'ws');
    const path = this.tableUnionId()
      ? `/ws/union/${encodeURIComponent(this.tableUnionId()!)}/${encodeURIComponent(this.tableId)}`
      : `/ws/table/${encodeURIComponent(this.clubId)}/${encodeURIComponent(this.tableId)}`;
    const socket = new WebSocket(`${base}${path}`);
    this.socket = socket;
    socket.onopen = () => {
      const authentication: { type: string; id_token: string; club_id?: string } = {
        type: 'authenticate',
        id_token: idToken
      };
      if (this.tableUnionId()) authentication.club_id = this.clubId;
      socket.send(JSON.stringify(authentication));
      this.updatePlayerState(this.userId, { is_connected: true, is_sat_out: false, disconnect_seconds_left: 15 });
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as TableSnapshot | { error: string } | { type: string };
        if ('type' in message && message.type === 'authenticated') {
          this.socketStatus.set('connected');
          return;
        }
        if ('type' in message) return;
        if ('error' in message) {
          this.notice.set(message.error);
          return;
        }
        this.snapshot.set(message);
        this.resolveQueuedPreAction();
      } catch {
        this.notice.set('Received an unreadable update from the table.');
      }
    };
    socket.onerror = () => {
      this.notice.set('The table connection encountered an error.');
      this.socketStatus.set('disconnected');
      this.handlePlayerDisconnected();
    };
    socket.onclose = () => {
      this.socketStatus.set('disconnected');
      this.handlePlayerDisconnected();
      this.socket = null;
    };
  }

  handlePlayerDisconnected(): void {
    this.updatePlayerState(this.userId, { is_connected: false, disconnect_seconds_left: this.disconnectTimer() });
    this.startDisconnectProtection();
  }

  autoResolveDisconnect(): void {
    const snapshot = this.snapshot();
    if (!snapshot) return;

    const current = this.currentPlayer;
    if (!current) return;

    const resolvedAction = this.currentBet === 0 ? 'CHECK' : 'FOLD';
    this.sendAction(resolvedAction);
    this.updatePlayerState(this.userId, { is_connected: false, is_sat_out: true, disconnect_seconds_left: 0 });
    this.notice.set('You were disconnected and automatically checked/folded. Press "I\'m Back" to sit back in.');
  }

  onImBack(): void {
    this.updatePlayerState(this.userId, { is_connected: true, is_sat_out: false, disconnect_seconds_left: 15 });
    this.disconnectTimer.set(15);
    this.notice.set('You are back in. You will be seated for the next hand.');
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ action: 'SIT_IN' }));
    }
  }

  sendAction(action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE'): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.notice.set('Connect to the table before acting.');
      return;
    }
    this.notice.set('');
    const payload = action === 'RAISE'
      ? { action, amount: Number(this.raiseTo) }
      : { action };
    this.socket.send(JSON.stringify(payload));
  }

  seatPosition(seat: number): { x: number; y: number } {
    const totalSeats = Math.max(6, Number(this.tableSize()) || 9);
    const basePositions = [
      { x: 50, y: 91 }, { x: 76, y: 78 }, { x: 87, y: 50 },
      { x: 76, y: 22 }, { x: 50, y: 9 }, { x: 24, y: 22 },
      { x: 13, y: 50 }, { x: 24, y: 78 }
    ];

    if (totalSeats === 9) {
      basePositions.push({ x: 50, y: 50 });
    }

    const mySeat = this.currentPlayer?.seat ?? 0;
    const relativeSeat = ((seat - mySeat) % totalSeats + totalSeats) % totalSeats;
    return basePositions[relativeSeat] ?? basePositions[0];
  }

  streetName(street: number | null): string {
    if (street === null) return 'Waiting for hand';
    return ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'][street] ?? `Street ${street}`;
  }

  cardRank(card: string): string {
    return card.length > 1 ? card.slice(0, -1) : card;
  }

  cardSuit(card: string): string {
    const suits: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
    return suits[card.slice(-1).toLowerCase()] ?? '?';
  }

  isRedCard(card: string): boolean {
    return /[hd]$/i.test(card);
  }

  errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error?.detail;
      return typeof detail === 'string' ? detail : error.message;
    }
    return 'The request could not be completed.';
  }

  private runRequest<T>(key: string, request: () => Observable<T>): void {
    this.busy.set(key);
    this.notice.set('');
    request().subscribe({
      next: (response) => {
        if (key !== 'create') this.snapshot.set(response as TableSnapshot);
        if (key === 'seat') this.pendingBuyInId = null;
        this.notice.set(key === 'create' ? 'Table created.' : key === 'seat' ? 'Player seated.' : 'Hand started.');
        this.busy.set('');
        if (key === 'start') this.controlsOpen.set(false);
        if (key === 'start' && this.socketStatus() !== 'connected') this.connectTable();
      },
      error: (error: unknown) => {
        this.notice.set(this.errorMessage(error));
        this.busy.set('');
      }
    });
  }

  private resolveQueuedPreAction(): void {
    const queuedAction = this.preAction();
    if (queuedAction !== 'check-fold' || !this.isMyTurn) return;

    const currentBet = this.currentBet;
    this.sendAction(currentBet === 0 ? 'CHECK' : 'FOLD');
    this.preAction.set(null);
  }

  private requireFirebaseToken(action: string): string | null {
    const idToken = this.session.firebaseIdToken();
    if (!idToken) {
      this.notice.set(`Sign in with Firebase before ${action}.`);
      return null;
    }
    return idToken;
  }

  private updatePlayerState(userId: string, updates: Partial<PokerPlayer>): void {
    const snapshot = this.snapshot();
    if (!snapshot) return;

    this.snapshot.set({
      ...snapshot,
      players: snapshot.players.map((player) =>
        player.user_id === userId ? { ...player, ...updates } : player
      )
    });
  }

  private startDisconnectProtection(): void {
    const current = this.currentPlayer;
    if (!current) return;

    this.disconnectTimer.set(15);
    const timer = window.setInterval(() => {
      const remaining = this.disconnectTimer() - 1;
      this.disconnectTimer.set(Math.max(0, remaining));
      this.updatePlayerState(this.userId, { disconnect_seconds_left: this.disconnectTimer() });

      if (remaining <= 0) {
        window.clearInterval(timer);
        this.autoResolveDisconnect();
      }
    }, 1000);
  }

  baseUrl(): string {
    return this.apiBase.trim().replace(/\/$/, '');
  }

  private tableUrl(): string {
    return `${this.baseUrl()}/clubs/${encodeURIComponent(this.clubId.trim())}/tables/${encodeURIComponent(this.tableId.trim())}`;
  }

  private closeSocket(): void {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.socketStatus.set('disconnected');
  }
}
