import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { WalletDashboardMockService } from './wallet-dashboard.mock.service';
import {
  WalletAccount,
  WalletCashoutRequest,
  WalletDashboard,
  WalletTransaction,
  WalletType
} from './wallet-dashboard.models';

@Component({
  selector: 'app-wallet-dashboard',
  imports: [DecimalPipe],
  templateUrl: './wallet-dashboard.component.html',
  styleUrl: './wallet-dashboard.component.css'
})
export class WalletDashboardComponent implements OnInit {
  @Input() initialScope: 'global' | 'club' = 'global';
  @Output() close = new EventEmitter<void>();

  readonly dashboard = signal<WalletDashboard | null>(null);
  readonly activeScope = signal<'global' | 'club'>('global');
  readonly selectedClubWalletType = signal<WalletType>('CLUB_PLAYER');
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly cashoutAmount = signal(600);
  readonly cashoutNotice = signal('');
  readonly mockCashoutRequests = signal<WalletCashoutRequest[]>([]);
  private readonly walletService = inject(WalletDashboardMockService);

  ngOnInit(): void {
    this.activeScope.set(this.initialScope);
    this.walletService.load().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.mockCashoutRequests.set(dashboard.cashout_requests);
        this.loading.set(false);
        const playerWallet = this.availableClubWallets.find((wallet) => wallet.wallet_type === 'CLUB_PLAYER');
        const firstWallet = playerWallet ?? this.availableClubWallets[0];
        if (firstWallet) this.selectedClubWalletType.set(firstWallet.wallet_type);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      }
    });
  }

  get availableClubWallets(): WalletAccount[] {
    const dashboard = this.dashboard();
    if (!dashboard) return [];
    const roles = dashboard.viewer.roles;
    return dashboard.club_wallets.filter((wallet) => {
      if (wallet.wallet_type === 'CLUB_PLAYER') return roles.includes('PLAYER');
      if (wallet.wallet_type === 'CLUB_AGENT') return roles.includes('AGENT');
      if (wallet.wallet_type === 'CLUB_TREASURY') return roles.includes('OWNER') || roles.includes('MANAGER');
      return false;
    });
  }

  get selectedClubWallet(): WalletAccount | undefined {
    return this.availableClubWallets.find((wallet) => wallet.wallet_type === this.selectedClubWalletType());
  }

  get visibleTransactions(): WalletTransaction[] {
    const dashboard = this.dashboard();
    if (!dashboard) return [];
    const walletType = this.activeScope() === 'global'
      ? 'GLOBAL_PLAYMONEY'
      : this.selectedClubWalletType();
    return dashboard.recent_transactions.filter((transaction) => transaction.wallet_type === walletType);
  }

  get selectedTableStacks(): WalletDashboard['table_stacks'] {
    if (this.activeScope() !== 'club' || this.selectedClubWalletType() !== 'CLUB_PLAYER') return [];
    return this.dashboard()?.table_stacks ?? [];
  }

  get cashoutRequestsForViewer(): WalletCashoutRequest[] {
    const dashboard = this.dashboard();
    if (!dashboard) return [];
    return this.mockCashoutRequests().filter((request) =>
      request.club_id === dashboard.viewer.club_id && request.user_id === dashboard.viewer.user_id
    );
  }

  setCashoutAmount(value: string): void {
    const amount = Number(value);
    this.cashoutAmount.set(Number.isFinite(amount) ? amount : 0);
  }

  requestMockCashout(): void {
    const dashboard = this.dashboard();
    const wallet = this.selectedClubWallet;
    if (!dashboard
      || this.activeScope() !== 'club'
      || this.selectedClubWalletType() !== 'CLUB_PLAYER'
      || !dashboard.viewer.roles.includes('PLAYER')
      || !wallet) {
      return;
    }

    const amount = this.cashoutAmount();
    const availableBalance = Number(wallet.available_balance ?? 0);
    const alreadyPending = this.cashoutRequestsForViewer.reduce((total, request) => total + request.amount, 0);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount + alreadyPending > availableBalance) {
      this.cashoutNotice.set('Enter a whole-chip amount within the available balance after pending requests.');
      return;
    }

    this.mockCashoutRequests.update((requests) => [{
      request_id: `mock-cashout-request-${crypto.randomUUID()}`,
      wallet_type: 'CLUB_PLAYER',
      club_id: dashboard.viewer.club_id,
      user_id: dashboard.viewer.user_id,
      amount,
      status: 'pending_mock',
      player_request_api_available: false,
      operator_fulfillment_endpoint: 'POST /clubs/{club_id}/wallet/claim-back',
      blocked_while_in_play_balance_nonzero: Number(wallet.in_play_balance ?? 0) > 0
    }, ...requests]);
    this.cashoutNotice.set('Mock cash-out request added. No wallet balance was changed.');
  }

  walletLabel(walletType: WalletType): string {
    const labels: Record<WalletType, string> = {
      GLOBAL_PLAYMONEY: 'Global playmoney',
      CLUB_TREASURY: 'Club treasury',
      CLUB_AGENT: 'Agent operating',
      CLUB_PLAYER: 'Player wallet',
      TABLE_ESCROW: 'Table escrow'
    };
    return labels[walletType];
  }

  transactionLabel(transaction: WalletTransaction): string {
    return transaction.type.replaceAll('_', ' ').toLowerCase();
  }
}
