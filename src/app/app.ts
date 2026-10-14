import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { UserSessionStore } from './core/user-session.store';
import { HandReplayContainerComponent } from './features/hand-replay/hand-replay-container.component';

interface PokerPlayer {
  seat: number;
  user_id: string;
  username: string;
  stack: number;
  status: string;
  hole_cards: string[];
  in_hand: boolean;
}

interface TableSnapshot {
  table_id: string;
  hand_id: string | null;
  is_hand_running: boolean;
  street: number | null;
  community_cards: string[];
  pot: number;
  pots: unknown[];
  active_turn_seat: number | null;
  players: PokerPlayer[];
}

interface LobbyTable {
  id: string;
  name: string;
  game: string;
  stakes: string;
  buyIn: string;
  players: string;
  status: string;
  featured?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, HandReplayContainerComponent],
  templateUrl: './table.html'
})
export class App implements OnInit, OnDestroy {
  screen = signal<'home' | 'lobby' | 'table' | 'replay'>('home');
  lobbyGame = signal('ALL');
  rolesOpen = signal(false);
  roleCards = [
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
  apiBase = 'http://127.0.0.1:8000';
  clubId = 'demo';
  tableId = 'table-1';
  smallBlind = 50;
  bigBlind = 100;
  buyInMin = 100;
  buyInMax = 1000;
  seatIndex = 0;
  buyInAmount = 500;
  raiseTo = 300;
  health = signal<'checking' | 'online' | 'offline'>('checking');
  socketStatus = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  snapshot = signal<TableSnapshot | null>(null);
  busy = signal('');
  notice = signal('');
  controlsOpen = signal(false);
  private socket: WebSocket | null = null;

  constructor(private readonly http: HttpClient, session: UserSessionStore) {
    this.session = session;
  }

  ngOnInit(): void {
    this.checkHealth();
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

  toggleControls(): void {
    this.controlsOpen.update((open) => !open);
  }

  goHome(): void {
    this.screen.set('home');
  }

  enterLobby(game = 'ALL'): void {
    this.lobbyGame.set(game);
    this.screen.set('lobby');
  }

  openTable(tableId: string): void {
    this.tableId = tableId;
    this.screen.set('table');
    this.connectTable();
  }

  openReplay(): void {
    if (!this.snapshot()?.hand_id || this.snapshot()?.is_hand_running) return;
    this.screen.set('replay');
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

  createTable(): void {
    if (!this.session.canManageTables()) return;
    this.runRequest('create', () => this.http.post(this.tableUrl(), {
      small_blind: Number(this.smallBlind),
      big_blind: Number(this.bigBlind),
      buy_in_min: Number(this.buyInMin),
      buy_in_max: Number(this.buyInMax)
    }));
  }

  seatPlayer(): void {
    this.runRequest('seat', () => this.http.post<TableSnapshot>(`${this.tableUrl()}/seats`, {
      seat_index: Number(this.seatIndex),
      buy_in_amount: Number(this.buyInAmount)
    }));
  }

  startHand(): void {
    if (!this.session.canManageTables()) return;
    this.runRequest('start', () => this.http.post<TableSnapshot>(`${this.tableUrl()}/hands`, null));
  }

  connectTable(): void {
    if (!this.userId.trim()) {
      this.notice.set('Enter the seated player ID before connecting.');
      return;
    }
    this.closeSocket();
    this.socketStatus.set('connecting');
    this.notice.set('');
    const base = this.baseUrl().replace(/^http/, 'ws');
    const path = `/ws/table/${encodeURIComponent(this.clubId)}/${encodeURIComponent(this.tableId)}/${encodeURIComponent(this.userId.trim())}`;
    const socket = new WebSocket(`${base}${path}`);
    this.socket = socket;
    socket.onopen = () => this.socketStatus.set('connected');
    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as TableSnapshot | { error: string };
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
