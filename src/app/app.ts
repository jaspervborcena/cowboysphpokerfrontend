import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Observable } from 'rxjs';
import { ClubApiService, ClubMembershipResponse, ClubTableCreateRequest, ClubTableSummary, ClubUnionSummary } from './core/club-api.service';
import { parseAuthIdentifier } from './core/auth-identifier';
import { FirebaseAuthService } from './core/firebase-auth.service';
import { AppRuntimeConfig } from './core/runtime-config';
import { UserSessionStore } from './core/user-session.store';
import { HandReplayContainerComponent } from './features/hand-replay/hand-replay-container.component';
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
  localOnly?: boolean;
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
  lobbyQuickMenuOpen = signal(false);
  tableCreationStep = signal<'games' | 'settings' | 'template' | null>(null);
  selectedClubGame = signal<string>(tableCreationDefaults.default_table.game);
  selectedClubTableMode = signal<'Regular' | 'SNG' | 'MTT'>(tableCreationDefaults.default_table.mode as 'Regular' | 'SNG' | 'MTT');
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
  readonly clubGameOptions = [
    { id: 'NLH', title: 'NLH', subtitle: 'NO LIMIT HOLD’EM', color: '#2488cd' },
    { id: '6+', title: '6+', subtitle: '6+ HOLD’EM', color: '#cd4562' },
    { id: 'PLO', title: 'PLO', subtitle: 'POT LIMIT OMAHA', color: '#159482' },
    { id: 'FLASH', title: 'FLASH', subtitle: 'FAST-FOLD POKER', color: '#c34552' },
    { id: 'MIXED', title: 'MIXED', subtitle: 'ROTATING GAMES', color: '#7356c7' },
    { id: 'TONGITS', title: 'TONGITS', subtitle: 'PHILIPPINES POKER', color: '#1c79bb' },
    { id: 'OFX', title: 'OFX', subtitle: 'MULTIPLE REGIONS', color: '#b3438b' },
    { id: 'MATA', title: 'MATA', subtitle: 'MEXICAN POKER', color: '#1a9a77' },
    { id: 'BADUGI', title: 'BADUGI', subtitle: 'KOREAN POKER', color: '#6748b6' }
  ];
  readonly clubTableModes = ['Regular', 'SNG', 'MTT'] as const;
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
  apiBase = (window as Window & { __COWBOYS_APP_CONFIG__?: AppRuntimeConfig }).__COWBOYS_APP_CONFIG__?.apiBase ?? 'http://127.0.0.1:8000';
  clubId = (window as Window & { __COWBOYS_APP_CONFIG__?: AppRuntimeConfig }).__COWBOYS_APP_CONFIG__?.clubId ?? 'demo';
  tableId = 'table-1';
  smallBlind = tableCreationDefaults.default_table.create_request_defaults.small_blind;
  bigBlind = tableCreationDefaults.default_table.create_request_defaults.big_blind;
  buyInMin = tableCreationDefaults.default_table.create_request_defaults.buy_in_min;
  buyInMax = tableCreationDefaults.default_table.create_request_defaults.buy_in_max;
  tableSize = signal<number>(tableCreationDefaults.default_table.create_request_defaults.table_size);
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
  loginIdentifier = signal('');
  loginPassword = signal('');
  authMode = signal<'sign-in' | 'sign-up' | 'forgot-password' | 'reset-phone'>('sign-in');
  resetOtp = signal('');
  resetNewPassword = signal('');
  loginError = signal('');
  signingIn = signal(false);
  controlsOpen = signal(false);
  preAction = signal<'check-fold' | 'fold' | 'call-any' | null>(null);
  private socket: WebSocket | null = null;
  private pendingBuyInId: string | null = null;
  private unsubscribeAuthState: (() => void) | null = null;

  constructor(private readonly http: HttpClient, session: UserSessionStore) {
    this.session = session;
    this.homeClubCards = [...this.homeClubCards, ...this.readLocalClubs()];

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

  get isAuthenticated(): boolean {
    return this.session.firebaseIdToken() !== null;
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
      const ok = await this.firebaseAuth.signInWithEmailAndPassword(identifier.value, password);
      if (!ok) {
        this.loginError.set('Email sign-in failed. Check your email and password.');
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
    this.controlsOpen.set(true);
    this.notice.set(`Seat ${seat + 1} is open. Set your buy-in to at least ${this.buyInMin} chips and click Seat player to join.`);
  }

  goHome(): void {
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
    if (this.isActiveMockClubPreview) {
      this.notice.set('Private tables are not connected in this club preview.');
      return;
    }
    this.openTable('table-1');
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
    this.lobbyQuickMenuOpen.set(false);
    if (scope === 'union' && this.selectedUnionId()) this.loadUnionTables();
  }

  toggleLobbyQuickMenu(): void {
    this.lobbyQuickMenuOpen.update((open) => !open);
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
    this.notice.set(this.canCreateClubTables()
      ? ''
      : 'Preview only. A verified club Owner or Manager is required to create this table.');
  }

  chooseClubGame(gameId: string): void {
    this.selectedClubGame.set(gameId);
    this.tableCreationStep.set('settings');
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
    this.selectedClubGame.set('NLH');
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
    if (this.selectedClubGame() !== tableCreationDefaults.default_table.game
      || this.selectedClubTableMode() !== tableCreationDefaults.default_table.mode) {
      this.notice.set('The current backend supports Regular NLH tables only.');
      return;
    }

    const tableName = this.tableDraftName().trim();
    const tableId = tableName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!tableId) {
      this.notice.set('Enter a table name before creating it.');
      return;
    }

    const ranges = this.tableTemplateRanges();
    this.smallBlind = Number(ranges['smallBlind'] ?? tableCreationDefaults.default_table.create_request_defaults.small_blind);
    this.bigBlind = Number(ranges['bigBlind'] ?? tableCreationDefaults.default_table.create_request_defaults.big_blind);
    this.buyInMin = Number(ranges['buyInMin'] ?? tableCreationDefaults.default_table.create_request_defaults.buy_in_min);
    this.buyInMax = Number(ranges['buyInMax'] ?? tableCreationDefaults.default_table.create_request_defaults.buy_in_max);
    this.tableSize.set(Number(ranges['tableSize'] ?? tableCreationDefaults.default_table.create_request_defaults.table_size));

    const successMessage = `Table created with ${this.smallBlind}/${this.bigBlind} micro blinds. Advanced template settings are not applied by the current backend.`;
    if (this.isActiveLocalClubOwner) {
      const table: LobbyTable = {
        id: tableId,
        name: tableName,
        game: this.selectedClubGame(),
        stakes: `${this.smallBlind} / ${this.bigBlind}`,
        buyIn: `${this.buyInMin} - ${this.buyInMax}`,
        players: `0 / ${this.tableSize()}`,
        status: 'OPEN',
        seatedCount: 0,
        localOnly: true
      };
      const tables = this.localClubTables.get(this.activeClubDisplayId) ?? [];
      this.localClubTables.set(this.activeClubDisplayId, [...tables, table]);
      this.lobbyTables = [...tables, table];
      this.tableCreationStep.set(null);
      this.notice.set(`Local table created with ${this.smallBlind}/${this.bigBlind} micro blinds. Advanced template settings and server gameplay are not connected.`);
      return;
    }

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
    if (this.selectedClubGame() !== 'NLH'
      || this.selectedClubTableMode() !== 'Regular'
      || Object.values(this.clubTableRules()).some(Boolean)) {
      this.notice.set('The current backend supports Regular NLH tables only. Other games and rules are not connected yet.');
      return;
    }

    const tableId = this.tableDraftName().trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!tableId) {
      this.notice.set('Enter a table name before creating it.');
      return;
    }

    if (this.isActiveLocalClubOwner) {
      const clubId = this.activeClubDisplayId;
      const table: LobbyTable = {
        id: tableId,
        name: this.tableDraftName().trim(),
        game: this.selectedClubGame(),
        stakes: `${this.smallBlind} / ${this.bigBlind}`,
        buyIn: `${this.buyInMin} - ${this.buyInMax}`,
        players: `0 / ${this.tableSize()}`,
        status: 'OPEN',
        seatedCount: 0,
        localOnly: true
      };
      const tables = this.localClubTables.get(clubId) ?? [];
      this.localClubTables.set(clubId, [...tables, table]);
      this.lobbyTables = [...tables, table];
      this.tableCreationStep.set(null);
      this.notice.set('Table added to this local club room. Server gameplay is not connected.');
      return;
    }

    this.tableId = tableId;
    this.createTable();
  }

  get visibleLobbyTables(): LobbyTable[] {
    const tables = this.lobbyScope() === 'union' ? this.unionTables() : this.lobbyTables;
    if (this.lobbyGame() === 'ALL' || this.lobbyGame() === 'MTT') return tables;
    return tables.filter((table) => table.game.toUpperCase() === this.lobbyGame().toUpperCase());
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
    return {
      id: table.table_id,
      name: table.table_name,
      game: table.game?.toUpperCase() || 'NLH',
      stakes: `${table.small_blind} / ${table.big_blind}`,
      buyIn: `${table.buy_in_min} - ${table.buy_in_max}`,
      players: `${table.seated_count} / ${table.max_seats}`,
      status: table.is_hand_running ? 'RUNNING' : 'OPEN',
      unionId: table.union_id ?? undefined,
      originClubId: table.origin_club_id ?? undefined,
      seatedCount: table.seated_count
    };
  }

  createTable(successMessage = 'Table created.'): void {
    if (!this.session.canManageTables()) return;
    const idToken = this.requireFirebaseToken('creating a table');
    if (!idToken) return;
    const request: ClubTableCreateRequest = {
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

  private runRequest<T>(key: string, request: () => Observable<T>, successMessage?: string): void {
    this.busy.set(key);
    this.notice.set('');
    request().subscribe({
      next: (response) => {
        if (key !== 'create') this.snapshot.set(response as TableSnapshot);
        if (key === 'seat') this.pendingBuyInId = null;
        this.notice.set(successMessage ?? (key === 'create' ? 'Table created.' : key === 'seat' ? 'Player seated.' : 'Hand started.'));
        this.busy.set('');
        if (key === 'create') {
          this.tableCreationStep.set(null);
          this.loadLobbyData();
        }
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
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.socketStatus.set('disconnected');
  }
}
