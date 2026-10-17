import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Observable } from 'rxjs';
import { ClubApiService, ClubMembershipResponse, ClubTableCreateRequest, ClubTableSummary, ClubUnionSummary, GameCatalogResponse } from './core/club-api.service';
import { parseAuthIdentifier } from './core/auth-identifier';
import { FirebaseAuthService } from './core/firebase-auth.service';
import { TableActionPayload, TableSocketErrorPayload, TableWebSocketEnvelope } from './core/table-websocket.models';
import { AppRuntimeConfig } from './core/runtime-config';
import { UserSessionStore } from './core/user-session.store';
import { HandReplayContainerComponent } from './features/hand-replay/hand-replay-container.component';
import { WalletDashboardComponent } from './features/wallet-dashboard/wallet-dashboard.component';
import { BlindEntryChoice } from './features/table/rules/table-rules.types';
import { TableRulesService } from './features/table/rules/table-rules.service';
import tableCreationDefaults from './data/table-creation-defaults.json';

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
  turn_seconds_left?: number;
  disconnect_seconds_left?: number;
  disconnect_timeout_count?: number;
  blind_decision_pending?: boolean;
  blind_amount_to_post?: number;
  club_id?: string | null;
  pre_action?: 'CHECK_FOLD' | 'FOLD' | 'CALL_ANY' | null;
};

type TableSnapshot = {
  table_id: string;
  table_name: string;
  game_id?: string;
  table_format?: string;
  table_size?: number;
  max_seats?: number;
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
  gameId?: string;
  game: string;
  stakes: string;
  buyIn: string;
  players: string;
  status: string;
  featured?: boolean;
  unionId?: string;
  originClubId?: string;
  seatedCount?: number;
  localOnly?: boolean;
  tableSize?: number;
  buyInMin?: number;
  buyInMax?: number;
}

interface HomeClubCard {
  id: string;
  name: string;
  titleTop: string;
  titleBottom: string;
  subtitle: string;
  status: string;
  kind: 'global' | 'club';
  logoMark?: string;
  logoColor?: string;
  creatorId?: string;
  notice?: string;
}

const emptyGameCatalog: GameCatalogResponse = {
  active_game_id: '',
  games: []
};

const localClubGameCatalog: GameCatalogResponse = {
  active_game_id: 'no_limit_texas_holdem',
  games: [{
    game_id: 'no_limit_texas_holdem',
    display_name: 'No-Limit Texas Hold’em',
    create_supported: true
  }]
};

@Component({
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, HandReplayContainerComponent, WalletDashboardComponent],
  templateUrl: './table.html'
})
export class App implements OnInit, OnDestroy {
  screen = signal<'home' | 'lobby' | 'table' | 'replay'>('home');
  lobbyGame = signal('ALL');
  lobbyScope = signal<'club' | 'union'>('club');
  tableLayout = signal<'grid' | 'list'>('grid');
  unions = signal<ClubUnionSummary[]>([]);
  unionTables = signal<LobbyTable[]>([]);
  selectedUnionId = signal<string | null>(null);
  tableUnionId = signal<string | null>(null);
  unionCreateOpen = signal(false);
  lobbyQuickMenuOpen = signal(false);
  walletOpen = signal(false);
  walletInitialScope = signal<'global' | 'club'>('global');
  seatConfirmationOpen = signal(false);
  tableCreationStep = signal<'games' | 'settings' | 'template' | null>(null);
  selectedClubGame = signal<string>('');
  gameCatalog = signal<GameCatalogResponse>(emptyGameCatalog);
  gameCatalogLoaded = signal(false);
  selectedClubTableMode = signal<'Regular'>('Regular');
  tableDraftName = signal('');
  tableRulesOpen = signal(true);
  clubTableRules = signal<Record<string, boolean>>({
    allInOrFold: false,
    doubleBoard: false,
    swapNlh: false,
    threeOne: false,
    sushi: false,
    squid: false,
    winStreak: false
  });
  get clubGameOptions(): Array<{ id: string; title: string; subtitle: string; color: string }> {
    return this.availableGameCatalog.games
      .filter((game) => game.create_supported)
      .map((game) => ({ id: game.game_id, title: game.display_name, subtitle: 'AVAILABLE', color: '#2488cd' }));
  }
  get lobbyGameFilters(): string[] {
    return ['ALL', ...this.availableGameCatalog.games.map((game) => game.display_name)];
  }
  readonly tableSizes = [2, 3, 4, 5, 6, 7, 8, 9];
  readonly clubTableModes = ['Regular'] as const;
  readonly clubTableRuleOptions = [
    { id: 'allInOrFold', label: 'All-in or Fold' },
    { id: 'doubleBoard', label: 'Double Board' },
    { id: 'swapNlh', label: 'Swap NLH' },
    { id: 'threeOne', label: '3-1 Game' },
    { id: 'sushi', label: 'Sushi Game' },
    { id: 'squid', label: 'Squid Game' },
    { id: 'winStreak', label: 'Win Streak' }
  ];
  readonly tableTemplateSections = [
    {
      title: 'Game Mode',
      switches: [
        { id: 'allInOrFold', label: 'All-in or Fold' },
        { id: 'doubleBoard', label: 'Double Board' },
        { id: 'swapNlh', label: 'Swap NLH' },
        { id: 'threeOne', label: '3-1 Game' },
        { id: 'sushi', label: 'Sushi Game' },
        { id: 'squid', label: 'Squid Game' },
        { id: 'winStreak', label: 'Win Streak' },
        { id: 'bombPot', label: 'Bomb Pot' },
        { id: 'sevenDeuce', label: 'Seven-Deuce' }
      ],
      ranges: []
    },
    {
      title: 'Table Setup',
      switches: [
        { id: 'autoStraddle', label: 'Auto-Straddle' },
        { id: 'voluntaryStraddle', label: 'Voluntary Straddle' }
      ],
      ranges: [
        { id: 'tableSize', label: 'Table Size', min: 2, max: 9, step: 1, unit: '' },
        { id: 'actionTime', label: 'Action Time', min: 5, max: 60, step: 1, unit: 's' },
        { id: 'smallBlind', label: 'Small Blind', min: 1, max: 100, step: 1, unit: '' },
        { id: 'bigBlind', label: 'Big Blind', min: 2, max: 200, step: 1, unit: '' },
        { id: 'ante', label: 'Ante', min: 0, max: 5, step: 0.1, unit: ' BB' }
      ]
    },
    {
      title: 'Fees and Duration',
      switches: [],
      ranges: [
        { id: 'fee', label: 'Fee', min: 0, max: 10, step: 0.1, unit: '%' },
        { id: 'feeCap', label: 'Cap', min: 0, max: 10, step: 0.5, unit: ' BBs' },
        { id: 'gameLength', label: 'Game Length', min: 1, max: 12, step: 1, unit: 'h' }
      ]
    },
    {
      title: 'Advanced Settings',
      switches: [
        { id: 'careerVpip', label: 'Career VPIP' },
        { id: 'maintainVpip', label: 'Maintain VPIP' },
        { id: 'manualCalltime', label: 'Manual Calltime' },
        { id: 'automaticCalltime', label: 'Automatic Calltime' },
        { id: 'rathole', label: 'Rathole' },
        { id: 'takeBreak', label: 'Take a Break' },
        { id: 'withdrawChips', label: 'Withdraw Chips', enabled: true },
        { id: 'runItMultiTimes', label: 'Run It Multi-Times', enabled: true },
        { id: 'insurance', label: 'Insurance', enabled: true },
        { id: 'evChop', label: 'EV Chop' }
      ],
      ranges: [
        { id: 'buyInMin', label: 'Buy-in', min: 1, max: 1000, step: 1, unit: '' },
        { id: 'buyInMax', label: 'Max Buy-in', min: 100, max: 5000, step: 50, unit: '' },
        { id: 'vpipTarget', label: 'Maintain VPIP Target', min: 0, max: 100, step: 1, unit: '%' }
      ]
    },
    {
      title: 'Access and Restrictions',
      switches: [
        { id: 'privateTable', label: 'Private Table' },
        { id: 'buyInAuthorization', label: 'Buy-in Authorization' },
        { id: 'randomSeat', label: 'Random Seat' },
        { id: 'sequentialOpening', label: 'Sequential Opening' },
        { id: 'gpsRestriction', label: 'GPS Restriction', enabled: true },
        { id: 'ipRestriction', label: 'IP Restriction', enabled: true },
        { id: 'captcha', label: 'CAPTCHA' },
        { id: 'pcRestriction', label: 'PC & Emulator Restriction' },
        { id: 'emailRestriction', label: 'Email / Third-Party Restriction' },
        { id: 'regionRestriction', label: 'Region Restriction' },
        { id: 'banChat', label: 'Ban Chat' },
        { id: 'muteObservers', label: 'Mute Observers' },
        { id: 'anonymousTable', label: 'Anonymous Table' }
      ],
      ranges: []
    },
    {
      title: 'Results and Automation',
      switches: [
        { id: 'autoOpen', label: 'Auto Open', enabled: true },
        { id: 'autoCopy', label: 'Auto-copy' }
      ],
      ranges: [
        { id: 'autoStart', label: 'Auto Start', min: 2, max: 9, step: 1, unit: '' },
        { id: 'tableExtension', label: 'Auto Table Extension', min: 1, max: 12, step: 1, unit: ' times' }
      ]
    }
  ];
  tableTemplateSwitches = signal<Record<string, boolean>>({ ...tableCreationDefaults.default_table.template_settings.switches });
  tableTemplateRanges = signal<Record<string, number>>({ ...tableCreationDefaults.default_table.template_settings.ranges });
  tableTemplateResults = signal(tableCreationDefaults.default_table.template_settings.real_time_result_visibility);
  tableRunItMode = signal(tableCreationDefaults.default_table.template_settings.run_it_multi_times_mode);
  tableTemplatePassword = signal(tableCreationDefaults.default_table.template_settings.private_password);
  readonly tableTemplateResultOptions = ['All', 'In the table', 'Player himself'];
  rolesOpen = signal(false);
  roleCards = [
    { role: 'UNION_ADMIN', title: 'Union admin', rights: 'Create and start shared union tables. Club owners cannot create tables on the union floor.' },
    { role: 'OWNER', title: 'Club owner', rights: 'Manage the club, appoint managers and agents, issue master chips, review analytics, and control tables.' },
    { role: 'MANAGER', title: 'Manager', rights: 'Create and close tables, approve seats, review table performance, and manage player access.' },
    { role: 'AGENT', title: 'Agent', rights: 'Manage chip transfers for assigned players and view downline summaries.' },
    { role: 'PLAYER', title: 'Player', rights: 'Join tables, request a buy-in, play hands, and view personal hand history. Cannot set a chip balance or see opponents’ private cards.' }
  ];
  homeClubCards: HomeClubCard[] = [
    { id: 'global-room', name: 'Cowboys Global Room', titleTop: 'COWBOYS', titleBottom: 'GLOBAL', subtitle: 'GLOBAL PLAY ROOM', status: 'MOCK PREVIEW', kind: 'global' },
    { id: 'demo', name: 'Card Games Manila', titleTop: 'CARD GAMES', titleBottom: 'MANILA', subtitle: 'PRIVATE POKER CLUB', status: 'MOCK PREVIEW', kind: 'club' },
    { id: 'cebu-preview', name: 'Cebu Night Owls', titleTop: 'CEBU NIGHT', titleBottom: 'OWLS', subtitle: 'MEMBER CLUB', status: 'MOCK PREVIEW', kind: 'club' }
  ];
  activeClubCardId = signal<string | null>(null);
  private readonly localClubTables = new Map<string, LobbyTable[]>();
  clubCardIndex = signal(0);
  homeMenuOpen = signal(false);
  clubProfileOpen = signal(false);
  clubNameDraft = signal('');
  clubNoticeDraft = signal('');
  selectedClubLogo = signal('lions');
  readonly clubLogos = [
    { id: 'sharks', name: 'SHARKS', mark: 'S', color: '#8648ad' },
    { id: 'wolves', name: 'WOLVES', mark: 'W', color: '#287db3' },
    { id: 'eagles', name: 'EAGLES', mark: 'E', color: '#319996' },
    { id: 'lions', name: 'LIONS', mark: 'L', color: '#29785e' },
    { id: 'foxes', name: 'FOXES', mark: 'F', color: '#bd633e' }
  ];
  get currentClubLogo() {
    return this.clubLogos.find((item) => item.id === this.selectedClubLogo()) ?? this.clubLogos[3];
  }
  lobbyTables: LobbyTable[] = [];
  readonly session: UserSessionStore;
  private readonly clubApi = inject(ClubApiService);
  private readonly firebaseAuth = inject(FirebaseAuthService);
  private readonly tableRules = inject(TableRulesService);
  apiBase = (window as Window & { __COWBOYS_APP_CONFIG__?: AppRuntimeConfig }).__COWBOYS_APP_CONFIG__?.apiBase ?? 'http://127.0.0.1:8000';
  clubId = (window as Window & { __COWBOYS_APP_CONFIG__?: AppRuntimeConfig }).__COWBOYS_APP_CONFIG__?.clubId ?? 'demo';
  tableId = '';
  tableGameId = signal<string | undefined>(undefined);
  smallBlind = tableCreationDefaults.default_table.create_request_defaults.small_blind;
  bigBlind = tableCreationDefaults.default_table.create_request_defaults.big_blind;
  buyInMin = tableCreationDefaults.default_table.create_request_defaults.buy_in_min;
  buyInMax = tableCreationDefaults.default_table.create_request_defaults.buy_in_max;
  tableSize = signal<number>(tableCreationDefaults.default_table.create_request_defaults.table_size);
  seatIndex = 0;
  buyInAmount = 500;
  availableWalletBalance = signal<number | null>(null);
  walletBalanceLoading = signal(false);
  walletBalanceError = signal(false);
  localPreviewTable = signal(false);
  unionTableName = 'Union Main';
  unionTableId = '';
  raiseTo = 300;
  health = signal<'checking' | 'online' | 'offline'>('checking');
  socketStatus = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');
  snapshot = signal<TableSnapshot | null>(null);
  busy = signal('');
  notice = signal('');
  loginIdentifier = signal('');
  loginPassword = signal('');
  authMode = signal<'sign-in' | 'sign-up' | 'forgot-password' | 'reset-phone'>('sign-in');
  resetOtp = signal('');
  resetNewPassword = signal('');
  loginError = signal('');
  signingIn = signal(false);
  controlsOpen = signal(false);
  preAction = signal<'check-fold' | 'fold' | 'call-any' | null>(null);
  preActionPending = signal(false);
  private socket: WebSocket | null = null;
  private socketGeneration = 0;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private reconnectBlocked = false;
  private authFailureRetryUsed = false;
  private pendingSitInCorrelationId: string | null = null;
  private pendingBlindDecisionCorrelationId: string | null = null;
  private pendingPreActionCorrelationId: string | null = null;
  private readonly pendingActionCorrelationIds = new Set<string>();
  private pendingBuyInId: string | null = null;
  private pendingBuyInSignature: string | null = null;
  private seatRequestAwaitingSnapshot = false;
  private unsubscribeAuthState: (() => void) | null = null;
  sitInPending = signal(false);
  blindDecisionPending = signal(false);

  constructor(private readonly http: HttpClient, session: UserSessionStore) {
    this.session = session;
    this.homeClubCards = [...this.homeClubCards, ...this.readLocalClubs()];
  }

  ngOnInit(): void {
    this.checkHealth();
    this.loadGameCatalog();
    this.authFailureRetryUsed = false;
    if (!this.firebaseAuth.isConfigured()) return;

    this.unsubscribeAuthState = this.firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) {
        this.session.clearSession();
        this.clearClubData();
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

  get activeClubName(): string {
    return this.currentClubCard?.name ?? 'Card Games Manila';
  }

  get activeClubDisplayId(): string {
    return this.currentClubCard?.id ?? this.clubId;
  }

  get activeClubRole(): string {
    if (this.isActiveLocalClubOwner) return 'OWNER';
    return this.isActiveMockClubPreview ? 'PREVIEW' : this.session.role();
  }

  get selectedGameDisplayName(): string {
    return this.availableGameCatalog.games.find((game) => game.game_id === this.selectedClubGame())?.display_name
      ?? this.selectedClubGame();
  }

  get snapshotGameDisplayName(): string {
    const gameId = this.snapshot()?.game_id;
    return this.availableGameCatalog.games.find((game) => game.game_id === gameId)?.display_name
      ?? gameId
      ?? 'Unknown game';
  }

  get currentTableRules() {
    return this.tableRules.forGame(this.snapshot()?.game_id ?? this.tableGameId(), this.snapshot()?.table_format ?? 'RING');
  }

  get canChooseBlindEntry(): boolean {
    return this.currentPlayer?.blind_decision_pending === true
      && (this.currentTableRules?.blindEntry.decisions.length ?? 0) > 0;
  }

  get canSeatWithWallet(): boolean {
    const available = this.availableWalletBalance();
    const minimum = Number(this.buyInMin);
    const maximum = Number(this.buyInMax);
    const requested = Number(this.buyInAmount);
    if (this.localPreviewTable()) {
      return Number.isFinite(minimum)
        && Number.isFinite(maximum)
        && Number.isFinite(requested)
        && requested >= minimum
        && requested <= maximum;
    }
    return available !== null
      && !this.walletBalanceLoading()
      && !this.walletBalanceError()
      && Number.isFinite(available)
      && Number.isFinite(minimum)
      && Number.isFinite(maximum)
      && Number.isFinite(requested)
      && available >= minimum
      && requested >= minimum
      && requested <= maximum
      && requested <= available;
  }

  get isActiveClubOwner(): boolean {
    return this.activeClubRole === 'OWNER';
  }

  private get currentClubCard(): HomeClubCard | undefined {
    const activeId = this.activeClubCardId() ?? this.clubId;
    return this.homeClubCards.find((club) => club.id === activeId);
  }

  private get isActiveLocalClubOwner(): boolean {
    return !!this.currentClubCard?.creatorId
      && this.currentClubCard.creatorId === (this.session.firebaseUid() || this.session.memberId());
  }

  private get isActiveMockClubPreview(): boolean {
    return !!this.currentClubCard
      && this.currentClubCard.id !== this.clubId
      && (this.currentClubCard.kind === 'club' || this.currentClubCard.kind === 'global')
      && this.currentClubCard.status === 'MOCK PREVIEW'
      && !this.currentClubCard.creatorId;
  }

  private get availableGameCatalog(): GameCatalogResponse {
    const catalog = this.gameCatalog();
    return this.isActiveLocalClubOwner && catalog.games.length === 0
      ? localClubGameCatalog
      : catalog;
  }

  get isAuthenticated(): boolean {
    return this.session.firebaseIdToken() !== null;
  }

  get currentPlayer(): PokerPlayer | undefined {
    return this.players.find((player) => player.user_id === this.userId);
  }

  get isCurrentPlayerSatOut(): boolean {
    return this.currentPlayer?.is_sat_out ?? false;
  }

  seatTimerType(player: PokerPlayer): 'turn' | 'disconnect' | null {
    if (player.is_connected === false && player.disconnect_seconds_left !== undefined && !player.is_sat_out) {
      return 'disconnect';
    }
    if (player.seat === this.snapshot()?.active_turn_seat
      && player.turn_seconds_left !== undefined
      && player.is_connected !== false
      && !player.is_sat_out) {
      return 'turn';
    }
    return null;
  }

  seatTimerSeconds(player: PokerPlayer): number | null {
    const timerType = this.seatTimerType(player);
    const rules = this.currentTableRules?.turnPolicy;
    const duration = timerType === 'disconnect'
      ? rules?.disconnectGraceSeconds
      : timerType === 'turn' ? rules?.actionSeconds : undefined;
    const seconds = this.seatTimerType(player) === 'disconnect'
      ? player.disconnect_seconds_left
      : this.seatTimerType(player) === 'turn' ? player.turn_seconds_left : undefined;
    return duration === undefined || seconds === undefined || !Number.isFinite(seconds)
      ? null
      : Math.max(0, Math.min(duration, seconds));
  }

  seatTimerDelay(player: PokerPlayer): string {
    const seconds = this.seatTimerSeconds(player);
    const timerType = this.seatTimerType(player);
    const duration = timerType === 'disconnect'
      ? this.currentTableRules?.turnPolicy.disconnectGraceSeconds
      : timerType === 'turn' ? this.currentTableRules?.turnPolicy.actionSeconds : undefined;
    return `-${seconds === null || duration === undefined ? 0 : duration - seconds}s`;
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
    const wireAction = nextValue === 'check-fold'
      ? 'CHECK_FOLD'
      : nextValue === 'fold'
        ? 'FOLD'
        : nextValue === 'call-any' ? 'CALL_ANY' : null;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.notice.set('Connect to the table before setting a pre-action.');
      return;
    }
    const correlationId = crypto.randomUUID();
    if (this.sendSocketEnvelope('PRE_ACTION', { action: wireAction }, correlationId)) {
      this.pendingPreActionCorrelationId = correlationId;
      this.preActionPending.set(true);
    }
  }

  toggleControls(): void {
    this.controlsOpen.update((open) => !open);
  }

  openWallet(scope: 'global' | 'club'): void {
    this.walletInitialScope.set(scope);
    this.walletOpen.set(true);
  }

  closeWallet(): void {
    this.walletOpen.set(false);
  }

  toggleHomeMenu(): void {
    this.homeMenuOpen.update((open) => !open);
  }

  openCreateClub(): void {
    this.homeMenuOpen.set(false);
    this.clubNameDraft.set('');
    this.clubNoticeDraft.set('');
    this.selectedClubLogo.set('lions');
    this.clubProfileOpen.set(true);
  }

  saveClubProfile(): void {
    const name = this.clubNameDraft().trim();
    if (!name) return;
    const creatorId = this.session.firebaseUid() || this.session.memberId();
    if (!creatorId) {
      this.notice.set('Sign in before creating a club profile.');
      return;
    }

    const logo = this.currentClubLogo;
    this.homeClubCards = [...this.homeClubCards, {
      id: `local-club-${Date.now()}`,
      name,
      titleTop: name,
      titleBottom: 'CLUB',
      subtitle: this.clubNoticeDraft().trim() || logo.name,
      status: 'LOCAL PREVIEW',
      kind: 'club',
      logoMark: logo.mark,
      logoColor: logo.color,
      creatorId,
      notice: this.clubNoticeDraft().trim()
    }];
    this.persistLocalClubs();
    this.clubCardIndex.set(this.homeClubCards.length - 1);
    this.clubProfileOpen.set(false);
    this.notice.set('Club profile added as a local preview. Server-side club creation is not connected.');
  }

  closeClubProfile(): void {
    this.clubProfileOpen.set(false);
  }

  showFriendTableNotice(): void {
    this.homeMenuOpen.set(false);
    this.notice.set('Friend tables are not connected yet.');
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
    this.loginIdentifier.set('');
    this.loginPassword.set('');
    this.loginError.set('');
    this.notice.set('Signed out.');
  }

  async continueWithIdentifier(): Promise<void> {
    const identifier = parseAuthIdentifier(this.loginIdentifier());
    const password = this.loginPassword();
    if (identifier.type === 'invalid') {
      this.loginError.set('Enter a valid email or Philippine phone number.');
      return;
    }
    if (!password) {
      this.loginError.set('Enter your password to continue.');
      return;
    }

    this.signingIn.set(true);
    this.loginError.set('');
    if (this.authMode() === 'sign-up') {
      if (identifier.type !== 'email') {
        this.loginError.set('Phone account creation is not available yet. Use email sign-up for now.');
        this.signingIn.set(false);
        return;
      }

      const creationResult = await this.firebaseAuth.createEmailAccount(identifier.value, password);
      if (!creationResult.success) {
        this.loginError.set(this.emailAccountCreationError(creationResult.code));
        this.signingIn.set(false);
        return;
      }

      await this.finalizeSignedInUser(identifier.value);
      this.notice.set('Global account created. Club access is separate and uses club invitations.');
      return;
    }

    if (identifier.type === 'email') {
      const result = await this.firebaseAuth.signInWithEmailAndPassword(identifier.value, password);
      if (!result.success) {
        this.loginError.set(this.emailSignInError(result.code));
        this.signingIn.set(false);
        return;
      }
      await this.finalizeSignedInUser(identifier.value);
      return;
    }

    try {
      const response = await firstValueFrom(this.clubApi.signInWithPhonePassword(
        this.baseUrl(),
        identifier.value,
        password
      ));
      const signedIn = await this.firebaseAuth.signInWithCustomToken(response.firebase_custom_token);
      if (!signedIn) throw new Error('Firebase rejected the custom token.');

      await this.finalizeSignedInUser(identifier.value);
    } catch {
      this.loginError.set('Phone sign-in failed. Check your phone number and password.');
      this.signingIn.set(false);
    }
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

  toggleAuthMode(): void {
    this.authMode.update((mode) => mode === 'sign-in' ? 'sign-up' : 'sign-in');
    this.loginError.set('');
  }

  private emailAccountCreationError(code: string): string {
    const messages: Record<string, string> = {
      'firebase/not-configured': 'Firebase is not configured. Add your Firebase web settings to public/app-config.json.',
      'firebase/initialization-failed': 'Firebase could not initialize. Check the Firebase settings in public/app-config.json.',
      'auth/email-already-in-use': 'An account already uses this email. Sign in or use Forgot password.',
      'auth/weak-password': 'Choose a stronger password. Firebase requires at least 6 characters.',
      'auth/operation-not-allowed': 'Email/password sign-up is disabled. Enable it in Firebase Authentication settings.',
      'auth/invalid-email': 'Enter a valid email address.'
    };
    return messages[code] ?? `Account creation failed (${code}). Check Firebase Authentication settings.`;
  }

  private emailSignInError(code: string): string {
    const messages: Record<string, string> = {
      'firebase/not-configured': 'Firebase is not configured. Add your Firebase web settings to public/app-config.json.',
      'firebase/initialization-failed': 'Firebase could not initialize. Check the Firebase settings in public/app-config.json.',
      'auth/missing-email-or-password': 'Enter your email and password to continue.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/invalid-credential': 'Email sign-in failed. Check your email and password.',
      'auth/wrong-password': 'Email sign-in failed. Check your email and password.',
      'auth/user-not-found': 'Email sign-in failed. Check your email and password.',
      'auth/operation-not-allowed': 'Email/password sign-in is disabled. Enable it in Firebase Authentication settings.',
      'auth/too-many-requests': 'Too many sign-in attempts. Wait a while and try again.',
      'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection and try again.'
    };
    return messages[code] ?? `Email sign-in failed (${code}). Check Firebase Authentication settings.`;
  }

  async requestPasswordReset(): Promise<void> {
    const identifier = parseAuthIdentifier(this.loginIdentifier());
    if (identifier.type === 'invalid') {
      this.loginError.set('Enter your account email or Philippine phone number first.');
      return;
    }

    this.signingIn.set(true);
    this.loginError.set('');
    if (identifier.type === 'email') {
      const requested = await this.firebaseAuth.sendEmailPasswordReset(identifier.value);
      this.signingIn.set(false);
      this.notice.set('If an account matches that email, password reset instructions have been sent.');
      if (!requested) this.loginError.set('Unable to send reset instructions. Check your Firebase configuration.');
      return;
    }

    try {
      await firstValueFrom(this.clubApi.requestPhonePasswordReset(this.baseUrl(), identifier.value));
      this.authMode.set('reset-phone');
      this.notice.set('If an account matches that number, a reset code has been sent.');
    } catch {
      this.notice.set('If an account matches that number, a reset code has been sent.');
      this.loginError.set('Unable to request a reset code. Try again later.');
    } finally {
      this.signingIn.set(false);
    }
  }

  async confirmPhonePasswordReset(): Promise<void> {
    const identifier = parseAuthIdentifier(this.loginIdentifier());
    if (identifier.type !== 'phone' || !this.resetOtp().trim() || !this.resetNewPassword()) {
      this.loginError.set('Enter the reset code and a new password.');
      return;
    }

    this.signingIn.set(true);
    this.loginError.set('');
    try {
      await firstValueFrom(this.clubApi.confirmPhonePasswordReset(this.baseUrl(), {
        phone_number: identifier.value,
        otp: this.resetOtp().trim(),
        new_password: this.resetNewPassword()
      }));
      this.authMode.set('sign-in');
      this.loginPassword.set('');
      this.resetOtp.set('');
      this.resetNewPassword.set('');
      this.notice.set('Password reset successfully. Sign in with your new password.');
    } catch {
      this.loginError.set('Password reset failed. Check the code and try again.');
    } finally {
      this.signingIn.set(false);
    }
  }

  cancelPasswordReset(): void {
    this.authMode.set('sign-in');
    this.resetOtp.set('');
    this.resetNewPassword.set('');
    this.loginError.set('');
  }

  chooseEmptySeat(seat: number): void {
    this.seatIndex = seat;
    this.buyInAmount = Number(this.buyInMin);
    this.seatConfirmationOpen.set(true);
    this.notice.set('');
    if (!this.localPreviewTable()) void this.loadMemberWalletBalance();
  }

  cancelSeatConfirmation(): void {
    if (this.busy() === 'seat' || this.busy() === 'seat-check') return;
    this.seatConfirmationOpen.set(false);
  }

  goHome(): void {
    this.closeSocket();
    this.screen.set('home');
  }

  moveClubSelection(direction: -1 | 1): void {
    this.selectClubCard(this.clubCardIndex() + direction);
  }

  selectClubCard(index: number): void {
    const count = this.homeClubCards.length;
    this.clubCardIndex.set((index % count + count) % count);
  }

  openClubCard(card: HomeClubCard): void {
    if (card.creatorId && card.creatorId === (this.session.firebaseUid() || this.session.memberId())) {
      this.activeClubCardId.set(card.id);
      this.clubCardIndex.set(this.homeClubCards.findIndex((club) => club.id === card.id));
      this.lobbyScope.set('club');
      this.lobbyTables = this.localClubTables.get(card.id) ?? [];
      this.unions.set([]);
      this.unionTables.set([]);
      this.enterLobby();
      this.notice.set(`Welcome to ${card.name}. You are the local preview owner.`);
      return;
    }
    if (card.id !== this.clubId) {
      this.activeClubCardId.set(card.id);
      this.clubCardIndex.set(this.homeClubCards.findIndex((club) => club.id === card.id));
      this.lobbyScope.set('club');
      this.lobbyTables = [];
      this.unions.set([]);
      this.unionTables.set([]);
      this.enterLobby();
      this.notice.set(`${card.name} is a preview room. Live tables and club services are not connected.`);
      return;
    }
    this.activeClubCardId.set(card.id);
    this.enterLobby();
  }

  enterLobby(game = 'ALL'): void {
    this.closeSocket();
    this.localPreviewTable.set(false);
    this.lobbyGame.set(game);
    this.screen.set('lobby');
    if (this.isActiveLocalClubOwner) {
      this.lobbyTables = this.localClubTables.get(this.activeClubDisplayId) ?? [];
      this.unions.set([]);
      this.unionTables.set([]);
      return;
    }
    if (this.isActiveMockClubPreview) {
      this.lobbyTables = [];
      this.unions.set([]);
      this.unionTables.set([]);
      return;
    }
    this.loadLobbyData();
  }

  openPrivateTable(): void {
    this.notice.set('Private tables are not connected, and invitations are not available in this backend.');
  }

  openTable(tableId: string, unionId: string | null = null): void {
    const selectedTable = this.visibleLobbyTables.find((table) => table.id === tableId);
    if (selectedTable?.localOnly) {
      this.closeSocket();
      this.tableId = tableId.trim();
      this.tableGameId.set(selectedTable.gameId);
      this.tableUnionId.set(null);
      this.tableSize.set(selectedTable.tableSize ?? this.tableSize());
      this.buyInMin = selectedTable.buyInMin ?? this.buyInMin;
      this.buyInMax = selectedTable.buyInMax ?? this.buyInMax;
      this.availableWalletBalance.set(null);
      this.walletBalanceLoading.set(false);
      this.walletBalanceError.set(false);
      this.localPreviewTable.set(true);
      this.socketStatus.set('disconnected');
      this.snapshot.set({
        table_id: selectedTable.id,
        table_name: selectedTable.name,
        game_id: selectedTable.gameId,
        table_format: 'RING',
        table_size: selectedTable.tableSize ?? this.tableSize(),
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
      });
      this.notice.set('Local preview table. Take a seat here; live hands require a connected game server.');
      this.screen.set('table');
      return;
    }
    this.localPreviewTable.set(false);
    this.tableId = tableId.trim();
    this.tableGameId.set(selectedTable?.gameId);
    this.tableUnionId.set(unionId);
    if (selectedTable?.tableSize) this.tableSize.set(selectedTable.tableSize);
    if (selectedTable?.buyInMin !== undefined) this.buyInMin = selectedTable.buyInMin;
    if (selectedTable?.buyInMax !== undefined) this.buyInMax = selectedTable.buyInMax;
    this.screen.set('table');
    void this.loadMemberWalletBalance();
    this.connectTable();
  }

  selectLobbyScope(scope: 'club' | 'union'): void {
    this.lobbyScope.set(scope);
    this.unionCreateOpen.set(false);
    this.lobbyQuickMenuOpen.set(false);
    if (scope === 'union' && this.selectedUnionId()) this.loadUnionTables();
  }

  toggleLobbyQuickMenu(): void {
    this.lobbyQuickMenuOpen.update((open) => !open);
  }

  toggleTableLayout(): void {
    this.tableLayout.update((layout) => layout === 'grid' ? 'list' : 'grid');
    this.closeLobbyQuickMenu();
  }

  closeLobbyQuickMenu(): void {
    this.lobbyQuickMenuOpen.set(false);
  }

  openLobbyMessages(): void {
    this.lobbyQuickMenuOpen.set(false);
    this.notice.set('Messages are not available in this backend.');
  }

  openLobbyShortcutUnavailable(label: string): void {
    this.lobbyQuickMenuOpen.set(false);
    this.notice.set(`${label} is not available in this backend.`);
  }

  selectUnion(unionId: string): void {
    this.selectedUnionId.set(unionId);
    this.loadUnionTables();
  }

  toggleUnionCreate(): void {
    this.unionCreateOpen.update((open) => !open);
  }

  canCreateClubTables(): boolean {
    return this.isActiveLocalClubOwner || (
      this.activeClubDisplayId === this.clubId
      && this.session.membershipStatus() === 'verified'
      && ['OWNER', 'MANAGER'].includes(this.session.role())
    );
  }

  openClubTableWizard(): void {
    if (this.lobbyScope() !== 'club') {
      this.notice.set('Switch to Club Tables before setting up a club table.');
      return;
    }
    this.tableCreationStep.set('games');
    this.notice.set(!this.gameCatalogLoaded() && !this.isActiveLocalClubOwner
      ? 'Game catalog is unavailable. Table creation is disabled until it loads.'
      : this.canCreateClubTables()
      ? ''
      : 'Preview only. A verified club Owner or Manager is required to create this table.');
  }

  chooseClubGame(gameId: string): void {
    const game = this.availableGameCatalog.games.find((entry) => entry.game_id === gameId);
    if (!game?.create_supported) {
      this.notice.set('This game is not enabled for table creation by the backend.');
      return;
    }
    this.selectedClubGame.set(gameId);
    this.selectedClubTableMode.set('Regular');
    this.tableCreationStep.set('template');
  }

  toggleTableRules(): void {
    this.tableRulesOpen.update((open) => !open);
  }

  toggleClubTableRule(ruleId: string): void {
    this.clubTableRules.update((rules) => ({ ...rules, [ruleId]: !rules[ruleId] }));
  }

  saveClubTableDraft(): void {
    this.notice.set('Table setup saved in this session.');
  }

  openTableTemplate(): void {
    this.selectedClubGame.set(this.availableGameCatalog.active_game_id);
    this.selectedClubTableMode.set('Regular');
    this.tableCreationStep.set('template');
    this.notice.set('');
  }

  toggleTableTemplateSwitch(id: string): void {
    this.tableTemplateSwitches.update((values) => ({ ...values, [id]: !values[id] }));
  }

  setTableTemplateRange(id: string, value: string): void {
    this.tableTemplateRanges.update((values) => ({ ...values, [id]: Number(value) }));
  }

  createTableFromTemplate(): void {
    if (!this.canCreateClubTables()) {
      this.notice.set('A verified club Owner or Manager is required to create this table.');
      return;
    }

    const tableName = this.tableDraftName().trim();
    const tableId = tableName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!tableId) {
      this.notice.set('Enter a table name before creating it.');
      return;
    }
    if (!this.isSelectedGameCreateSupported()) {
      this.notice.set('This game is not enabled for table creation by the backend.');
      return;
    }

    const ranges = this.tableTemplateRanges();
    this.smallBlind = Number(ranges['smallBlind'] ?? tableCreationDefaults.default_table.create_request_defaults.small_blind);
    this.bigBlind = Number(ranges['bigBlind'] ?? tableCreationDefaults.default_table.create_request_defaults.big_blind);
    this.buyInMin = Number(ranges['buyInMin'] ?? tableCreationDefaults.default_table.create_request_defaults.buy_in_min);
    this.buyInMax = Number(ranges['buyInMax'] ?? tableCreationDefaults.default_table.create_request_defaults.buy_in_max);
    this.tableSize.set(Number(ranges['tableSize'] ?? tableCreationDefaults.default_table.create_request_defaults.table_size));

    if (this.isActiveLocalClubOwner) {
      this.addLocalClubTable(tableId, tableName);
      return;
    }

    if (!this.isSelectedGameCreateSupported() || this.selectedClubTableMode() !== 'Regular') {
      this.notice.set('The selected game or mode is not enabled for table creation by the backend.');
      return;
    }

    const successMessage = `Table created with ${this.smallBlind}/${this.bigBlind} micro blinds. Advanced template settings are not applied by the current backend.`;
    this.tableId = tableId;
    this.createTable(successMessage);
  }

  createClubTableFromWizard(): void {
    if (!this.canCreateClubTables()) {
      this.notice.set('A verified club Owner or Manager is required to create this table.');
      return;
    }
    if (this.tableCreationStep() === 'template') {
      this.createTableFromTemplate();
      return;
    }
    const tableId = this.tableDraftName().trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!tableId) {
      this.notice.set('Enter a table name before creating it.');
      return;
    }
    if (!this.isSelectedGameCreateSupported()) {
      this.notice.set('This game is not enabled for table creation by the backend.');
      return;
    }

    if (this.isActiveLocalClubOwner) {
      this.addLocalClubTable(tableId, this.tableDraftName().trim());
      return;
    }

    if (!this.isSelectedGameCreateSupported()
      || this.selectedClubTableMode() !== 'Regular'
      || Object.values(this.clubTableRules()).some(Boolean)) {
      this.notice.set('The selected game or mode is not enabled for table creation by the backend.');
      return;
    }

    this.tableId = tableId;
    this.createTable();
  }

  private addLocalClubTable(tableId: string, tableName: string): void {
    const table: LobbyTable = {
      id: tableId,
      name: tableName,
      gameId: this.selectedClubGame(),
      game: this.selectedGameDisplayName,
      stakes: `${this.smallBlind} / ${this.bigBlind}`,
      buyIn: `${this.buyInMin} - ${this.buyInMax}`,
      buyInMin: this.buyInMin,
      buyInMax: this.buyInMax,
      players: `0 / ${this.tableSize()}`,
      status: 'OPEN',
      seatedCount: 0,
      localOnly: true
    };
    const tables = this.localClubTables.get(this.activeClubDisplayId) ?? [];
    this.localClubTables.set(this.activeClubDisplayId, [...tables, table]);
    this.lobbyTables = [...tables, table];
    this.tableCreationStep.set(null);
    this.notice.set(`Local ${this.selectedGameDisplayName} table created with ${this.smallBlind}/${this.bigBlind} blinds. Server gameplay is not connected.`);
  }

  get visibleLobbyTables(): LobbyTable[] {
    const tables = this.lobbyScope() === 'union' ? this.unionTables() : this.lobbyTables;
    if (this.lobbyGame() === 'ALL') return tables;
    const selectedGame = this.availableGameCatalog.games.find((game) =>
      game.display_name === this.lobbyGame() || game.game_id === this.lobbyGame()
    );
    return tables.filter((table) => selectedGame
      ? table.gameId === selectedGame.game_id || (!table.gameId && table.game.toUpperCase() === selectedGame.display_name.toUpperCase())
      : table.game.toUpperCase() === this.lobbyGame().toUpperCase());
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
        this.loadLobbyData();
      },
      error: (error: unknown) => {
        if (this.session.firebaseIdToken() !== idToken) return;
        this.clearClubData();
        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.session.membershipStatus.set('not-a-member');
          this.notice.set('Your global account is active. Club access requires an accepted club invitation.');
          return;
        }
        this.session.membershipStatus.set('unavailable');
        this.notice.set('Unable to verify club access right now. Your global account remains active.');
      }
    });
  }

  private loadGameCatalog(): void {
    this.clubApi.getGames(this.baseUrl()).subscribe({
      next: (catalog) => {
        if (!Array.isArray(catalog.games) || typeof catalog.active_game_id !== 'string') return;
        const supported = catalog.games.filter((game) => game.create_supported);
        const activeGame = supported.find((game) => game.game_id === catalog.active_game_id) ?? supported[0];
        this.gameCatalog.set(catalog);
        this.gameCatalogLoaded.set(true);
        if (activeGame) this.selectedClubGame.set(activeGame.game_id);
        if (this.lobbyGame() !== 'ALL'
          && !catalog.games.some((game) => game.display_name === this.lobbyGame())) {
          this.lobbyGame.set('ALL');
        }
      },
      error: () => {
        this.gameCatalog.set(emptyGameCatalog);
        this.gameCatalogLoaded.set(true);
      }
    });
  }

  private isSelectedGameCreateSupported(): boolean {
    return this.availableGameCatalog.games.some((game) =>
      game.game_id === this.selectedClubGame() && game.create_supported
    );
  }

  private loadLobbyData(): void {
    const idToken = this.session.firebaseIdToken();
    if (!idToken
      || this.session.membershipStatus() !== 'verified'
      || this.activeClubDisplayId !== this.clubId) return;

    this.clubApi.getTables(this.baseUrl(), this.clubId, idToken).subscribe({
      next: (tables: ClubTableSummary[]) => {
        this.lobbyTables = tables.map((table) => this.toLobbyTable(table));
      },
      error: () => {
        this.lobbyTables = [];
        this.notice.set('Unable to load club tables. Try again later.');
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

  private clearClubData(): void {
    this.lobbyTables = [];
    this.unions.set([]);
    this.unionTables.set([]);
    this.selectedUnionId.set(null);
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
    const catalogGame = this.gameCatalog().games.find((game) => game.game_id === table.game_id);
    return {
      id: table.table_id,
      name: table.table_name,
      gameId: table.game_id,
      game: catalogGame?.display_name ?? table.game?.toUpperCase() ?? table.game_id ?? 'Unknown game',
      stakes: `${table.small_blind} / ${table.big_blind}`,
      buyIn: `${table.buy_in_min} - ${table.buy_in_max}`,
      buyInMin: table.buy_in_min,
      buyInMax: table.buy_in_max,
      players: `${table.seated_count} / ${table.table_size ?? table.max_seats ?? 9}`,
      status: table.is_hand_running ? 'RUNNING' : 'OPEN',
      unionId: table.union_id ?? undefined,
      originClubId: table.origin_club_id ?? undefined,
      seatedCount: table.seated_count,
      tableSize: table.table_size ?? table.max_seats ?? 9
    };
  }

  createTable(successMessage = 'Table created.'): void {
    if (!this.session.canManageTables()) return;
    const game = this.gameCatalog().games.find((entry) => entry.game_id === this.selectedClubGame());
    if (!game?.create_supported) {
      this.notice.set('The selected game is not supported for table creation.');
      return;
    }
    const idToken = this.requireFirebaseToken('creating a table');
    if (!idToken) return;
    const request: ClubTableCreateRequest = {
      game_id: game.game_id,
      small_blind: Number(this.smallBlind),
      big_blind: Number(this.bigBlind),
      buy_in_min: Number(this.buyInMin),
      buy_in_max: Number(this.buyInMax),
      table_size: Number(this.tableSize())
    };
    this.runRequest('create', () => this.http.post(this.tableUrl(), request, {
      headers: { Authorization: `Bearer ${idToken}` }
    }), successMessage);
  }

  createUnionTable(): void {
    const unionId = this.selectedUnionId();
    if (!this.session.canManageUnion(unionId) || !unionId) return;
    if (!this.isSelectedGameCreateSupported()) {
      this.notice.set('The selected game is not supported for table creation.');
      return;
    }
    const idToken = this.requireFirebaseToken('creating a union table');
    if (!idToken) return;
    this.busy.set('union-create');
    this.clubApi.createUnionTable(this.baseUrl(), unionId, this.unionTableId, idToken, {
      origin_club_id: this.clubId,
      game_id: this.selectedClubGame(),
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

  async seatPlayer(): Promise<void> {
    const minimumBuyIn = Number(this.buyInMin) || 0;
    const maximumBuyIn = Number(this.buyInMax) || 0;
    const requestedBuyIn = Number(this.buyInAmount) || 0;
    if (requestedBuyIn < minimumBuyIn) {
      this.notice.set(`This table requires a minimum buy-in of ${minimumBuyIn} chips.`);
      return;
    }
    if (requestedBuyIn > maximumBuyIn) {
      this.notice.set(`This table allows a maximum buy-in of ${maximumBuyIn} chips.`);
      return;
    }

    if (this.localPreviewTable()) {
      const currentSnapshot = this.snapshot();
      if (!this.isActiveLocalClubOwner || !currentSnapshot) {
        this.notice.set('Only this local club’s creator can join its preview table.');
        return;
      }
      if (currentSnapshot.players.some((player) => player.seat === Number(this.seatIndex))) {
        this.notice.set('That seat is no longer available. Choose another seat.');
        this.seatConfirmationOpen.set(false);
        return;
      }
      if (currentSnapshot.players.some((player) => player.user_id === this.userId)) {
        this.notice.set('You are already seated at this preview table.');
        this.seatConfirmationOpen.set(false);
        return;
      }

      const player: PokerPlayer = {
        seat: Number(this.seatIndex),
        user_id: this.userId,
        username: this.username,
        stack: requestedBuyIn,
        status: 'active',
        hole_cards: [],
        in_hand: false,
        club_id: this.activeClubDisplayId
      };
      const players = [...currentSnapshot.players, player];
      this.snapshot.set({ ...currentSnapshot, players });
      this.lobbyTables = this.lobbyTables.map((table) => table.id === this.tableId
        ? { ...table, seatedCount: players.length, players: `${players.length} / ${this.tableSize()}` }
        : table);
      this.localClubTables.set(this.activeClubDisplayId, this.lobbyTables);
      this.seatConfirmationOpen.set(false);
      this.notice.set('Joined the local preview table. No wallet transaction or live hand was started.');
      return;
    }

    const idToken = this.requireFirebaseToken('joining a table');
    if (!idToken) return;
    this.busy.set('seat-check');
    this.notice.set('Checking available club chips…');
    const availableBalance = await this.fetchMemberWalletBalance(idToken);
    if (availableBalance === null) {
      this.notice.set('Unable to verify your available club-chip balance. Seating is unavailable until it can be checked.');
      this.busy.set('');
      return;
    }
    if (availableBalance < minimumBuyIn || availableBalance < requestedBuyIn) {
      this.notice.set(`Available balance is ${availableBalance} chips; this seat requires at least ${minimumBuyIn} and your buy-in is ${requestedBuyIn}.`);
      this.busy.set('');
      return;
    }

    const buyInSignature = JSON.stringify([
      this.clubId,
      this.session.memberId(),
      this.tableUnionId(),
      this.tableId,
      Number(this.seatIndex),
      requestedBuyIn
    ]);
    if (this.pendingBuyInId === null || this.pendingBuyInSignature !== buyInSignature) {
      this.pendingBuyInId = crypto.randomUUID();
      this.pendingBuyInSignature = buyInSignature;
    }
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

  private async loadMemberWalletBalance(): Promise<void> {
    const idToken = this.session.firebaseIdToken();
    if (!idToken || this.session.membershipStatus() !== 'verified') {
      this.availableWalletBalance.set(null);
      this.walletBalanceError.set(false);
      return;
    }
    await this.fetchMemberWalletBalance(idToken);
  }

  private async fetchMemberWalletBalance(idToken: string): Promise<number | null> {
    this.walletBalanceLoading.set(true);
    this.walletBalanceError.set(false);
    try {
      const wallet = await firstValueFrom(this.clubApi.getMemberWalletSummary(this.baseUrl(), this.clubId, idToken));
      if (wallet.club_id !== this.clubId
        || wallet.user_id !== this.session.memberId()
        || wallet.currency_type !== 'CLUB_CHIPS'
        || !Number.isFinite(wallet.available_balance)
        || wallet.available_balance < 0
        || !Number.isFinite(wallet.in_play_balance)
        || wallet.in_play_balance < 0) {
        throw new Error('Wallet summary did not match the signed-in club member.');
      }
      this.availableWalletBalance.set(wallet.available_balance);
      return wallet.available_balance;
    } catch {
      this.availableWalletBalance.set(null);
      this.walletBalanceError.set(true);
      return null;
    } finally {
      this.walletBalanceLoading.set(false);
    }
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
    if (this.localPreviewTable()) {
      this.notice.set('This is a local preview table. Live gameplay requires a connected game server.');
      return;
    }
    if (!this.tableId.trim()) {
      this.notice.set('Select a table from the lobby before connecting.');
      return;
    }
    if (!this.firebaseAuth.isConfigured()) {
      this.socketStatus.set('disconnected');
      this.notice.set('Firebase must be configured before connecting to the table.');
      return;
    }
    this.reconnectAttempt = 0;
    this.reconnectBlocked = false;
    this.authFailureRetryUsed = false;
    this.openTableSocket();
  }

  private openTableSocket(): void {
    this.closeSocket();
    const generation = this.socketGeneration;
    this.socketStatus.set('connecting');
    this.snapshot.set(null);
    this.notice.set('');
    void this.firebaseAuth.getCurrentIdToken(true).then((idToken) => {
      if (generation !== this.socketGeneration) return;
      if (!idToken) {
        this.socketStatus.set('disconnected');
        this.notice.set('A current Firebase ID token is required to connect to the table.');
        return;
      }
      this.session.firebaseIdToken.set(idToken);
      const base = this.baseUrl().replace(/^http/, 'ws');
      const path = this.tableUnionId()
        ? `/ws/union/${encodeURIComponent(this.tableUnionId()!)}/${encodeURIComponent(this.tableId.trim())}`
        : `/ws/table/${encodeURIComponent(this.clubId.trim())}/${encodeURIComponent(this.tableId.trim())}`;
      const socket = new WebSocket(`${base}${path}`);
      this.socket = socket;
      socket.onopen = () => {
        if (generation !== this.socketGeneration) return;
        const payload: { id_token: string; club_id?: string } = { id_token: idToken };
        if (this.tableUnionId()) payload.club_id = this.clubId;
        socket.send(JSON.stringify(this.createSocketEnvelope('AUTHENTICATE', payload, `auth-${crypto.randomUUID()}`)));
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        if (generation === this.socketGeneration) this.handleSocketMessage(event.data);
      };
      socket.onerror = () => {
        if (generation !== this.socketGeneration) return;
        this.notice.set('The table connection encountered an error. Reconnecting…');
        this.socketStatus.set('disconnected');
        this.scheduleReconnect();
      };
      socket.onclose = () => {
        if (generation !== this.socketGeneration) return;
        this.socket = null;
        this.handlePlayerDisconnected();
      };
    }).catch(() => {
      if (generation !== this.socketGeneration) return;
      this.socketStatus.set('disconnected');
      this.notice.set('Unable to refresh the Firebase ID token for this connection.');
    });
  }

  handlePlayerDisconnected(): void {
    this.socketStatus.set('disconnected');
    this.preActionPending.set(false);
    this.pendingPreActionCorrelationId = null;
    this.pendingActionCorrelationIds.clear();
    this.scheduleReconnect();
  }

  onImBack(): void {
    if (!this.isCurrentPlayerSatOut) return;
    this.pendingSitInCorrelationId ??= crypto.randomUUID();
    this.sitInPending.set(true);
    if (this.socketStatus() === 'connected'
      && this.sendSocketEnvelope('SIT_IN', {}, this.pendingSitInCorrelationId)) {
      this.notice.set('Requesting to sit back in. Waiting for the server table snapshot.');
      return;
    }
    this.notice.set('Reconnecting and requesting to sit back in…');
    this.connectTable();
  }

  openTableChat(): void {
    this.notice.set('Table chat is not available in this backend yet.');
  }

  sendAction(action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE'): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.notice.set('Connect to the table before acting.');
      return;
    }
    this.notice.set('');
    const payload: TableActionPayload = {
      action,
      action_id: crypto.randomUUID(),
      ...(action === 'RAISE' ? { amount: Number(this.raiseTo) } : {})
    };
    const correlationId = crypto.randomUUID();
    if (this.sendSocketEnvelope('PLAYER_ACTION', payload, correlationId)) {
      this.pendingActionCorrelationIds.add(correlationId);
    }
  }

  sendBlindEntryDecision(decision: BlindEntryChoice): void {
    if (!this.canChooseBlindEntry || !this.currentTableRules?.blindEntry.decisions.includes(decision)) return;
    if (this.blindDecisionPending()) return;
    const correlationId = crypto.randomUUID();
    if (!this.sendSocketEnvelope(this.currentTableRules.blindEntry.event, { decision }, correlationId)) {
      this.notice.set('Connect to the table before choosing how to enter the blind rotation.');
      return;
    }
    this.pendingBlindDecisionCorrelationId = correlationId;
    this.blindDecisionPending.set(true);
    this.notice.set(decision === 'POST_BLIND'
      ? 'Post-blind request sent. Waiting for the table snapshot.'
      : 'Wait-for-big-blind request sent. Waiting for the table snapshot.');
  }

  private createSocketEnvelope<TPayload>(
    event: string,
    payload: TPayload,
    correlationId: string = crypto.randomUUID()
  ): TableWebSocketEnvelope<TPayload> {
    const topic = this.tableUnionId()
      ? `unions/${encodeURIComponent(this.tableUnionId()!)}/tables/${encodeURIComponent(this.tableId.trim())}/game`
      : `clubs/${encodeURIComponent(this.clubId.trim())}/tables/${encodeURIComponent(this.tableId.trim())}/game`;
    return { version: '1.0', topic, event, correlation_id: correlationId, payload };
  }

  private sendSocketEnvelope<TPayload>(event: string, payload: TPayload, correlationId?: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(this.createSocketEnvelope(event, payload, correlationId)));
    return true;
  }

  private handleSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data) as Record<string, unknown>;
      const event = message['event'];
      const payload = typeof message['payload'] === 'object' && message['payload'] !== null
        ? message['payload'] as Record<string, unknown>
        : message;
      if (event === 'PING') {
        const correlationId = typeof message['correlation_id'] === 'string' ? message['correlation_id'] : '';
        if (correlationId) this.sendSocketEnvelope('PONG', {}, correlationId);
        return;
      }
      if (event === 'AUTHENTICATED') {
        this.socketStatus.set('connected');
        this.reconnectAttempt = 0;
        this.authFailureRetryUsed = false;
        this.reconnectBlocked = false;
        this.notice.set('');
        if (this.pendingSitInCorrelationId) {
          this.sendSocketEnvelope('SIT_IN', {}, this.pendingSitInCorrelationId);
        }
        return;
      }
      if (event === 'PRE_ACTION_SET') {
        if (message['correlation_id'] !== this.pendingPreActionCorrelationId) return;
        this.pendingPreActionCorrelationId = null;
        this.preActionPending.set(false);
        return;
      }
      if (event === 'TABLE_SNAPSHOT') {
        this.applySnapshot(payload as unknown as TableSnapshot);
        return;
      }
      if (event === 'ACTION_ACKNOWLEDGED') {
        if (typeof message['correlation_id'] === 'string') {
          this.pendingActionCorrelationIds.delete(message['correlation_id']);
        }
        return;
      }
      if (event === 'SIT_IN_ERROR') {
        if (message['correlation_id'] === this.pendingSitInCorrelationId) {
          this.pendingSitInCorrelationId = null;
          this.sitInPending.set(false);
        }
        this.notice.set(typeof payload['message'] === 'string' ? payload['message'] : 'The server could not return you to the table.');
        return;
      }
      if (event === 'BLIND_DECISION_ERROR') {
        if (message['correlation_id'] === this.pendingBlindDecisionCorrelationId) {
          this.pendingBlindDecisionCorrelationId = null;
          this.blindDecisionPending.set(false);
        }
        this.notice.set(typeof payload['message'] === 'string' ? payload['message'] : 'The server could not apply that blind-entry choice.');
        return;
      }
      if (event === 'ACTION_ERROR' || typeof message['code'] === 'number' || typeof payload['code'] === 'number') {
        const correlationId = message['correlation_id'];
        if (correlationId === this.pendingSitInCorrelationId) {
          this.pendingSitInCorrelationId = null;
          this.sitInPending.set(false);
        }
        if (correlationId === this.pendingPreActionCorrelationId) {
          this.pendingPreActionCorrelationId = null;
        }
        if (correlationId === this.pendingBlindDecisionCorrelationId) {
          this.pendingBlindDecisionCorrelationId = null;
          this.blindDecisionPending.set(false);
        }
        if (event === 'ACTION_ERROR' && typeof correlationId === 'string') {
          if (!this.pendingActionCorrelationIds.has(correlationId)) return;
          this.pendingActionCorrelationIds.delete(correlationId);
        }
        this.preActionPending.set(false);
        this.showSocketError(payload as TableSocketErrorPayload);
        return;
      }
      if (typeof payload['table_id'] === 'string') this.applySnapshot(payload as unknown as TableSnapshot);
    } catch {
      this.notice.set('Received an unreadable update from the table.');
    }
  }

  private showSocketError(error: TableSocketErrorPayload): void {
    const code = Number(error.code);
    if (code === 40101 && !this.authFailureRetryUsed) {
      this.authFailureRetryUsed = true;
      this.reconnectBlocked = false;
      this.socket?.close();
    } else {
      this.reconnectBlocked = true;
    }
    if (code === 40301) this.refreshMembershipAfterDenied();
    this.notice.set(this.backendErrorMessage(code, error.trace_id));
  }

  private applySnapshot(snapshot: TableSnapshot): void {
    if (snapshot.table_id !== this.tableId || !Array.isArray(snapshot.players)) return;
    if (snapshot.game_id) this.tableGameId.set(snapshot.game_id);
    const reportedSize = snapshot.table_size ?? snapshot.max_seats;
    if (reportedSize !== undefined) {
      const tableSize = Number(reportedSize);
      if (Number.isInteger(tableSize) && tableSize >= 2 && tableSize <= 9) {
        this.tableSize.set(tableSize);
      } else {
        this.notice.set('The server returned an unsupported table size.');
      }
    }
    this.snapshot.set(snapshot);
    const ownPlayer = snapshot.players.find((player) => player.user_id === this.userId);
    if (this.seatRequestAwaitingSnapshot && ownPlayer) {
      this.seatRequestAwaitingSnapshot = false;
      this.seatConfirmationOpen.set(false);
      this.controlsOpen.set(false);
      this.notice.set('Player seated.');
      void this.loadMemberWalletBalance();
    }
    if (!ownPlayer) {
      this.preAction.set(null);
      this.preActionPending.set(false);
    } else if (ownPlayer.pre_action !== undefined) {
      this.preAction.set(ownPlayer.pre_action === 'CHECK_FOLD' ? 'check-fold'
        : ownPlayer.pre_action === 'FOLD' ? 'fold'
          : ownPlayer.pre_action === 'CALL_ANY' ? 'call-any' : null);
      this.preActionPending.set(false);
    }
    if (ownPlayer && !ownPlayer.is_sat_out) {
      this.pendingSitInCorrelationId = null;
      this.sitInPending.set(false);
    }
    if (ownPlayer?.blind_decision_pending !== true) {
      this.pendingBlindDecisionCorrelationId = null;
      this.blindDecisionPending.set(false);
    }
  }

  private scheduleReconnect(): void {
    if (this.screen() !== 'table' || !this.isAuthenticated || this.reconnectBlocked || this.reconnectTimer !== null) return;
    const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.notice.set('Table connection lost. Reconnecting…');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openTableSocket();
    }, delay);
  }

  seatPosition(seat: number): { x: number; y: number } {
    const totalSeats = Math.min(9, Math.max(2, Number(this.tableSize()) || 9));
    const mySeat = this.currentPlayer?.seat ?? 0;
    const relativeSeat = ((seat - mySeat) % totalSeats + totalSeats) % totalSeats;
    const angle = relativeSeat * (2 * Math.PI / totalSeats);
    return {
      x: 50 + 37 * Math.sin(angle),
      y: 50 + 40 * Math.cos(angle)
    };
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
      const body = typeof error.error === 'object' && error.error !== null
        ? error.error as Record<string, unknown>
        : {};
      const code = Number(body['code']);
      if (Number.isInteger(code) && code > 0) {
        if (code === 40301) this.refreshMembershipAfterDenied();
        return this.backendErrorMessage(code, typeof body['trace_id'] === 'string' ? body['trace_id'] : undefined);
      }
      const messages: Record<number, string> = {
        401: 'Your session has expired. Sign in again to continue.',
        403: 'You do not have permission to complete this request.',
        404: 'The requested table or resource was not found.',
        409: 'The request conflicts with the current server state.',
        422: 'Some submitted values are not accepted by the server.',
        429: 'Too many requests. Wait before trying again.',
        503: 'The service is temporarily unavailable. Try again shortly.'
      };
      return messages[error.status] ?? 'The request could not be completed. Try again later.';
    }
    return 'The request could not be completed.';
  }

  private backendErrorMessage(code: number, traceId?: string): string {
    const messages: Record<number, string> = {
      40001: 'Check the submitted values and try again.',
      40002: 'A required value is missing.',
      40101: 'Your Firebase session expired. Re-authenticate to continue.',
      40301: 'You do not have permission to complete this request.',
      40401: 'The table or requested item is unavailable.',
      40901: 'The server state changed. Refresh the table or balance before trying again.',
      40902: 'This action conflicts with a previous action ID. Do not retry it with changed details.',
      42901: 'Too many requests. Wait before trying again.',
      50001: 'A temporary server error occurred. Try again later.',
      50002: 'A temporary server error occurred. Try again later.'
    };
    const message = messages[code] ?? 'The request could not be completed.';
    return traceId ? `${message} Reference: ${traceId}` : message;
  }

  private refreshMembershipAfterDenied(): void {
    void this.firebaseAuth.getCurrentIdToken(true).then((idToken) => {
      if (!idToken) return;
      this.session.firebaseIdToken.set(idToken);
      this.loadMemberSession();
    }).catch(() => undefined);
  }

  private runRequest<T>(key: string, request: () => Observable<T>, successMessage?: string): void {
    this.busy.set(key);
    this.notice.set('');
    request().subscribe({
      next: (response) => {
        if (key === 'seat') {
          this.pendingBuyInId = null;
          this.pendingBuyInSignature = null;
          const seatSnapshot = response as Partial<TableSnapshot>;
          if (seatSnapshot.table_id === this.tableId && Array.isArray(seatSnapshot.players)) {
            this.applySnapshot(seatSnapshot as TableSnapshot);
          }
          if (!this.currentPlayer) {
            this.seatRequestAwaitingSnapshot = true;
            this.notice.set('Seat request accepted. Waiting for the table to confirm your seat…');
            this.busy.set('');
            if (this.socketStatus() !== 'connected') this.connectTable();
            return;
          }
          this.seatConfirmationOpen.set(false);
          this.controlsOpen.set(false);
          this.notice.set(successMessage ?? 'Player seated.');
          void this.loadMemberWalletBalance();
        } else {
          if (key !== 'create' && key !== 'start') this.snapshot.set(response as TableSnapshot);
          this.notice.set(successMessage ?? (key === 'create' ? 'Table created.' : 'Hand started.'));
        }
        this.busy.set('');
        if (key === 'create') {
          this.tableCreationStep.set(null);
          this.loadLobbyData();
        }
        if (key === 'start') this.controlsOpen.set(false);
        if (key === 'start' && this.socketStatus() !== 'connected') this.connectTable();
      },
      error: (error: unknown) => {
        if (key === 'seat') this.seatRequestAwaitingSnapshot = false;
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

  private readLocalClubs(): HomeClubCard[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('cowboys-local-clubs') ?? '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((club): club is HomeClubCard =>
        typeof club === 'object'
        && club !== null
        && 'id' in club && typeof club.id === 'string'
        && 'name' in club && typeof club.name === 'string'
        && 'titleTop' in club && typeof club.titleTop === 'string'
        && 'titleBottom' in club && typeof club.titleBottom === 'string'
        && 'subtitle' in club && typeof club.subtitle === 'string'
        && 'status' in club && typeof club.status === 'string'
        && 'creatorId' in club && typeof club.creatorId === 'string'
        && 'kind' in club && club.kind === 'club'
      );
    } catch {
      return [];
    }
  }

  private persistLocalClubs(): void {
    try {
      const ownedClubs = this.homeClubCards.filter((club) => !!club.creatorId);
      localStorage.setItem('cowboys-local-clubs', JSON.stringify(ownedClubs));
    } catch {
      this.notice.set('This club profile is available until the page is closed.');
    }
  }

  private closeSocket(): void {
    this.socketGeneration += 1;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.preActionPending.set(false);
    this.pendingPreActionCorrelationId = null;
    this.pendingActionCorrelationIds.clear();
    this.socketStatus.set('disconnected');
  }
}
