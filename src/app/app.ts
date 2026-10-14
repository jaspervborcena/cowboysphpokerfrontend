import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
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
  seatIndex = 0;
  buyInAmount = 500;
  unionTableName = 'Union Main';
  unionTableId = 'union-table-1';
  raiseTo = 300;
  health = signal<'checking' | 'online' | 'offline'>('checking');
  socketStatus = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  snapshot = signal<TableSnapshot | null>(null);
  busy = signal('');
  notice = signal('');
  controlsOpen = signal(false);
  preAction = signal<'check-fold' | 'fold' | 'call-any' | null>(null);
  private socket: WebSocket | null = null;
  private pendingBuyInId: string | null = null;

  constructor(private readonly http: HttpClient, session: UserSessionStore) {
    this.session = session;

    effect(() => {
      const queuedAction = this.preAction();
      if (queuedAction !== 'check-fold' || !this.isMyTurn) return;

      const currentBet = this.currentBet;
      this.sendAction(currentBet === 0 ? 'CHECK' : 'FOLD');
      this.preAction.set(null);
    });
  }

  ngOnInit(): void {
    this.checkHealth();
    void this.refreshFirebaseSession();
    this.loadMemberSession();
    this.loadLobbyData();
  }

  ngOnDestroy(): void {
    this.closeSocket();
  }

  get players(): PokerPlayer[] {
    return this.snapshot()?.players ?? [];
  }

  get userId(): string {
    return this.session.memberId();
  }

  get username(): string {
    return this.session.displayName();
  }

  get currentPlayer(): PokerPlayer | undefined {
    return this.players.find((player) => player.user_id === this.userId);
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
  }

  toggleControls(): void {
    this.controlsOpen.update((open) => !open);
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

  private async refreshFirebaseSession(): Promise<void> {
    const idToken = await this.firebaseAuth.getCurrentIdToken();
    if (!idToken) return;

    this.session.setVerifiedMember(
      this.session.memberId(),
      this.session.displayName(),
      this.session.role(),
      idToken
    );
    this.loadMemberSession();
    this.loadLobbyData();
  }

  private loadMemberSession(): void {
    const idToken = this.session.firebaseIdToken();
    if (!idToken) return;

    this.clubApi.getMembership(this.baseUrl(), this.clubId, idToken).subscribe({
      next: (membership: ClubMembershipResponse) => {
        this.session.setVerifiedMember(membership.user_id, membership.username, membership.role, idToken);
      },
      error: () => {
        this.notice.set('Unable to load the authenticated member profile; using demo session state.');
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
      buy_in_max: Number(this.buyInMax)
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
      buy_in_max: Number(this.buyInMax)
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
    const idToken = this.requireFirebaseToken('joining a table');
    if (!idToken) return;
    this.pendingBuyInId ??= crypto.randomUUID();
    const request = {
      seat_index: Number(this.seatIndex),
      buy_in_amount: Number(this.buyInAmount),
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
      } catch {
        this.notice.set('Received an unreadable update from the table.');
      }
    };
    socket.onerror = () => {
      this.notice.set('The table connection encountered an error.');
      this.socketStatus.set('disconnected');
    };
    socket.onclose = () => {
      this.socketStatus.set('disconnected');
      this.socket = null;
    };
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
    const positions = [
      { x: 50, y: 91 }, { x: 76, y: 78 }, { x: 87, y: 50 },
      { x: 76, y: 22 }, { x: 50, y: 9 }, { x: 24, y: 22 },
      { x: 13, y: 50 }, { x: 24, y: 78 }, { x: 50, y: 50 }
    ];
    return positions[((seat % positions.length) + positions.length) % positions.length];
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

  private requireFirebaseToken(action: string): string | null {
    const idToken = this.session.firebaseIdToken();
    if (!idToken) {
      this.notice.set(`Sign in with Firebase before ${action}.`);
      return null;
    }
    return idToken;
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
