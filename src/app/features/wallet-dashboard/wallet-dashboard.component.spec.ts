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
    balance: 250000,
    updated_at: '2026-10-16T08:00:00Z'
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
      amount: 250000,
      direction: 'credit',
      status: 'completed',
      created_at: '2026-10-16T08:00:00Z'
    }
  ]
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
    expect(component.dashboard()?.global_wallet.balance).toBe(250000);
    expect(component.visibleTransactions.map((transaction) => transaction.wallet_type)).toEqual(['GLOBAL_PLAYMONEY']);
    expect(component.selectedTableStacks).toEqual([]);

    component.activeScope.set('club');
    component.selectedClubWalletType.set('CLUB_PLAYER');
    expect(component.selectedTableStacks.reduce((total, stack) => total + stack.stack, 0)).toBe(1200);
    expect(component.selectedClubWallet?.in_play_balance).toBe(1200);
  });
});
