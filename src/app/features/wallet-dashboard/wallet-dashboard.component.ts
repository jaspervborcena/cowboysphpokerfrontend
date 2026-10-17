import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ClubApiService,
  ClubMemberWalletSummary,
  ClubTreasuryResponse,
  ClubTreasuryTransferRequest,
  ClubWalletTransferRequest,
  GlobalWalletResponse
} from '../../core/club-api.service';
import { FirebaseAuthService } from '../../core/firebase-auth.service';
import { AppRuntimeConfig } from '../../core/runtime-config';
import { UserSessionStore } from '../../core/user-session.store';

@Component({
  selector: 'app-wallet-dashboard',
  imports: [DecimalPipe],
  templateUrl: './wallet-dashboard.component.html',
  styleUrl: './wallet-dashboard.component.css'
})
export class WalletDashboardComponent implements OnInit {
  @Input() initialScope: 'global' | 'club' = 'global';
  @Output() close = new EventEmitter<void>();

  readonly globalWallet = signal<GlobalWalletResponse | null>(null);
  readonly clubWallet = signal<ClubMemberWalletSummary | null>(null);
  readonly clubTreasury = signal<ClubTreasuryResponse | null>(null);
  readonly activeScope = signal<'global' | 'club'>('global');
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly globalWalletCreated = signal(false);
  readonly transferMode = signal<'SEND_OUT' | 'CLAIM_BACK' | 'INTER_CLUB'>('SEND_OUT');
  readonly transferTarget = signal('');
  readonly transferAmount = signal(600);
  readonly transferNote = signal('');
  readonly transferPending = signal(false);
  readonly transferNotice = signal('');
  private readonly api = inject(ClubApiService);
  private readonly firebaseAuth = inject(FirebaseAuthService);
  readonly session = inject(UserSessionStore);
  private readonly apiBase = (window as Window & { __COWBOYS_APP_CONFIG__?: AppRuntimeConfig })
    .__COWBOYS_APP_CONFIG__?.apiBase ?? 'http://127.0.0.1:8000';
  readonly clubId = (window as Window & { __COWBOYS_APP_CONFIG__?: AppRuntimeConfig })
    .__COWBOYS_APP_CONFIG__?.clubId ?? 'demo';
  private pendingTransactionFingerprint = '';
  private pendingTransactionId = '';

  ngOnInit(): void {
    this.activeScope.set(this.initialScope);
    void this.loadActiveScope(this.initialScope === 'global');
  }

  get canOperateMemberWallets(): boolean {
    return this.session.membershipStatus() === 'verified'
      && ['OWNER', 'MANAGER', 'AGENT'].includes(this.session.role());
  }

  get canTransferBetweenTreasuries(): boolean {
    return this.session.membershipStatus() === 'verified'
      && ['OWNER', 'MANAGER'].includes(this.session.role());
  }

  selectScope(scope: 'global' | 'club'): void {
    this.activeScope.set(scope);
    this.transferNotice.set('');
    void this.loadActiveScope(scope === 'global');
  }

  refresh(): void {
    void this.loadActiveScope(false);
  }

  setTransferAmount(value: string): void {
    const amount = Number(value);
    this.transferAmount.set(Number.isFinite(amount) ? amount : 0);
  }

  async submitTransfer(): Promise<void> {
    const target = this.transferTarget().trim();
    const amount = this.transferAmount();
    if (!this.canOperateMemberWallets || this.activeScope() !== 'club') return;
    if (this.transferMode() === 'INTER_CLUB' && !this.canTransferBetweenTreasuries) return;
    if (!target || !Number.isSafeInteger(amount) || amount <= 0) {
      this.transferNotice.set('Enter a recipient ID and a positive whole-chip amount.');
      return;
    }

    this.transferPending.set(true);
    this.transferNotice.set('');
    const fingerprint = `${this.clubId}|${this.transferMode()}|${target}|${amount}|${this.transferNote().trim()}`;
    if (fingerprint !== this.pendingTransactionFingerprint) {
      this.pendingTransactionFingerprint = fingerprint;
      this.pendingTransactionId = crypto.randomUUID();
    }

    try {
      const idToken = await this.firebaseAuth.getCurrentIdToken(true);
      if (!idToken) throw new Error('Your sign-in has expired. Sign in again to manage wallets.');
      const note = this.transferNote().trim();
      if (this.transferMode() === 'SEND_OUT') {
        const request: ClubWalletTransferRequest = {
          user_id: target,
          amount,
          transaction_id: this.pendingTransactionId,
          ...(note ? { note } : {})
        };
        await firstValueFrom(this.api.sendOutClubChips(this.apiBase, this.clubId, idToken, request));
      } else if (this.transferMode() === 'CLAIM_BACK') {
        const request: ClubWalletTransferRequest = {
          user_id: target,
          amount,
          transaction_id: this.pendingTransactionId,
          ...(note ? { note } : {})
        };
        await firstValueFrom(this.api.claimBackClubChips(this.apiBase, this.clubId, idToken, request));
      } else {
        const request: ClubTreasuryTransferRequest = {
            destination_club_id: target,
            amount,
            transaction_id: this.pendingTransactionId,
            ...(note ? { note } : {})
          }
        await firstValueFrom(this.api.transferClubTreasury(this.apiBase, this.clubId, idToken, request));
      }

      this.pendingTransactionFingerprint = '';
      this.pendingTransactionId = '';
      this.transferNotice.set(this.transferMode() === 'SEND_OUT'
        ? `Chips sent to ${target}.`
        : this.transferMode() === 'CLAIM_BACK'
          ? `Available chips claimed back from ${target}.`
          : `Treasury transfer sent to ${target}.`);
      try {
        await this.loadClubWallet(idToken);
      } catch {
        this.transferNotice.update((notice) => `${notice} Balances could not refresh; use Refresh before another operation.`);
      }
    } catch (error) {
      this.transferNotice.set(this.errorMessage(error, 'The wallet operation failed. Check the details and try again.'));
    } finally {
      this.transferPending.set(false);
    }
  }

  private async loadActiveScope(ensureGlobal: boolean): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    this.globalWalletCreated.set(false);
    try {
      const idToken = await this.firebaseAuth.getCurrentIdToken(true);
      if (!idToken) throw new Error('Sign in to view your wallets.');
      if (this.activeScope() === 'global') {
        const wallet = ensureGlobal
          ? await firstValueFrom(this.api.ensureGlobalWallet(this.apiBase, idToken))
          : await firstValueFrom(this.api.getGlobalWallet(this.apiBase, idToken));
        if (wallet.user_id !== this.session.memberId()) {
          throw new Error('The returned global wallet does not match the signed-in account.');
        }
        this.globalWallet.set(wallet);
        this.globalWalletCreated.set(
          ensureGlobal && 'created' in wallet && typeof wallet.created === 'boolean' && wallet.created
        );
      } else {
        await this.loadClubWallet(idToken);
      }
    } catch (error) {
      this.loadError.set(this.errorMessage(error, 'Unable to load wallet data from the server.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadClubWallet(idToken: string): Promise<void> {
    if (this.session.membershipStatus() !== 'verified') {
      throw new Error('An active club membership is required to view club-chip wallets.');
    }
    const wallet = await firstValueFrom(this.api.getMemberWalletSummary(this.apiBase, this.clubId, idToken));
    if (wallet.club_id !== this.clubId
      || wallet.user_id !== this.session.memberId()
      || wallet.role !== this.session.role()) {
      throw new Error('The returned club wallet does not match the active member, role, and club.');
    }
    this.clubWallet.set(wallet);
    if (this.canTransferBetweenTreasuries) {
      try {
        this.clubTreasury.set(await firstValueFrom(this.api.getClubTreasury(this.apiBase, this.clubId, idToken)));
      } catch {
        this.clubTreasury.set(null);
      }
    } else {
      this.clubTreasury.set(null);
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown; trace_id?: unknown } | null;
      const message = typeof body?.message === 'string' ? body.message : fallback;
      return typeof body?.trace_id === 'string' ? `${message} Reference: ${body.trace_id}` : message;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
