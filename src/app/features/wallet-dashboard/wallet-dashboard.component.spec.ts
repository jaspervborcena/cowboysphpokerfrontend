import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WalletDashboardMockService } from './wallet-dashboard.mock.service';
import { WalletDashboardComponent } from './wallet-dashboard.component';
import { WalletDashboard } from './wallet-dashboard.models';

const mockDashboard: WalletDashboard = {
  mock_only: true,
  viewer: {
    user_id: 'user-agent-player-a',
    username: 'Alex',
    club_id: 'club-demo',
    roles: ['AGENT', 'PLAYER']
  },
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
  club_wallets: [
    {
      wallet_id: 'club-demo-treasury',
      wallet_type: 'CLUB_TREASURY',
      currency_type: 'CLUB_CHIPS',
      club_id: 'club-demo',
      owner_user_id: null,
      balance: 300000,
      updated_at: '2026-10-16T08:00:00Z'
    },
    {
      wallet_id: 'club-demo-agent-user-agent-player-a',
      wallet_type: 'CLUB_AGENT',
      currency_type: 'CLUB_CHIPS',
      club_id: 'club-demo',
      owner_user_id: 'user-agent-player-a',
      balance: 48000,
      updated_at: '2026-10-16T08:10:00Z'
    },
    {
      wallet_id: 'club-demo-player-user-agent-player-a',
      wallet_type: 'CLUB_PLAYER',
      currency_type: 'CLUB_CHIPS',
      club_id: 'club-demo',
      owner_user_id: 'user-agent-player-a',
      available_balance: 14600,
      in_play_balance: 1200,
      updated_at: '2026-10-16T08:12:00Z'
    }
  ],
  table_stacks: [{
    table_id: 'club-demo-main',
    table_name: 'Main Table',
    seat_index: 3,
    stack: 1200,
    currency_type: 'CLUB_CHIPS',
    status: 'sitting_in'
  }],
  recent_transactions: [
    {
      transaction_id: 'mock-agent-distribution-001',
      wallet_type: 'CLUB_AGENT',
      club_id: 'club-demo',
      type: 'AGENT_TO_PLAYER_TRANSFER',
      amount: 2000,
      direction: 'debit',
      counterparty_user_id: 'user-player-b',
      status: 'completed',
      created_at: '2026-10-16T08:10:00Z'
    },
    {
      transaction_id: 'mock-player-buy-in-001',
      wallet_type: 'CLUB_PLAYER',
      club_id: 'club-demo',
      type: 'TABLE_BUY_IN',
      amount: 1200,
      direction: 'debit',
      table_id: 'club-demo-main',
      status: 'completed',
      created_at: '2026-10-16T08:12:00Z'
    },
    {
      transaction_id: 'mock-global-grant-001',
      wallet_type: 'GLOBAL_PLAYMONEY',
      club_id: null,
      type: 'PLAYMONEY_GRANT',
      amount: 20000,
      direction: 'credit',
      status: 'completed',
      created_at: '2026-10-16T08:00:00Z'
    }
  ],
  cashout_requests: [{
    request_id: 'mock-cashout-request-001',
    wallet_type: 'CLUB_PLAYER',
    club_id: 'club-demo',
    user_id: 'user-agent-player-a',
    amount: 600,
    status: 'pending_mock',
    player_request_api_available: false,
    operator_fulfillment_endpoint: 'POST /clubs/{club_id}/wallet/claim-back',
    blocked_while_in_play_balance_nonzero: true
  }]
};

describe('WalletDashboardComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WalletDashboardComponent],
      providers: [{ provide: WalletDashboardMockService, useValue: { load: () => of(mockDashboard) } }]
    });
  });

  it('keeps player and agent wallets separate and hides treasury from a dual-role member', () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.availableClubWallets.map((wallet) => wallet.wallet_type)).toEqual(['CLUB_AGENT', 'CLUB_PLAYER']);
    expect(component.selectedClubWalletType()).toBe('CLUB_PLAYER');
    expect(component.selectedClubWallet?.available_balance).toBe(14600);
    expect(component.selectedClubWallet?.in_play_balance).toBe(1200);

    component.selectedClubWalletType.set('CLUB_AGENT');
    expect(component.selectedClubWallet?.balance).toBe(48000);
    expect(component.selectedTableStacks).toEqual([]);
  });

  it('keeps global playmoney and table stacks in their own scopes', () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.activeScope()).toBe('global');
    expect(component.dashboard()?.global_wallet.balance).toBe(20000);
    expect(component.visibleTransactions.map((transaction) => transaction.wallet_type)).toEqual(['GLOBAL_PLAYMONEY']);
    expect(component.selectedTableStacks).toEqual([]);

    component.activeScope.set('club');
    component.selectedClubWalletType.set('CLUB_PLAYER');
    expect(component.selectedTableStacks.reduce((total, stack) => total + stack.stack, 0)).toBe(1200);
    expect(component.selectedClubWallet?.in_play_balance).toBe(1200);
  });

  it('creates a pending mock cash-out request without changing wallet balances', () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.cashoutAmount.set(600);
    const availableBefore = component.selectedClubWallet?.available_balance;
    const inPlayBefore = component.selectedClubWallet?.in_play_balance;
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.wallet-cashout-submit') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.cashoutRequestsForViewer.length).toBe(2);
    expect(component.cashoutRequestsForViewer[0].status).toBe('pending_mock');
    expect(component.cashoutRequestsForViewer[0].blocked_while_in_play_balance_nonzero).toBeTrue();
    expect(component.selectedClubWallet?.available_balance).toBe(availableBefore);
    expect(component.selectedClubWallet?.in_play_balance).toBe(inPlayBefore);
    expect(fixture.nativeElement.textContent).toContain('No wallet balance was changed');
  });

  it('shows the documented onboarding grant amounts and API availability', () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('20,000');
    expect(fixture.nativeElement.textContent).toContain('API unavailable');
    expect(fixture.nativeElement.textContent).toContain('POST /platform/clubs');
    expect(fixture.nativeElement.textContent).toContain('owner personal balance starts at 0');
  });
});
