import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { WalletDashboardMockService } from './wallet-dashboard.mock.service';
import { WalletAccount, WalletDashboard, WalletTransaction, WalletType } from './wallet-dashboard.models';

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
  private readonly walletService = inject(WalletDashboardMockService);

  ngOnInit(): void {
    this.activeScope.set(this.initialScope);
    this.walletService.load().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
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
