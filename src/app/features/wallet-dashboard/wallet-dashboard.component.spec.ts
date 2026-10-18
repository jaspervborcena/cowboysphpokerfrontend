import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ClubApiService } from '../../core/club-api.service';
import { FirebaseAuthService } from '../../core/firebase-auth.service';
import { UserSessionStore } from '../../core/user-session.store';
import { WalletDashboardComponent } from './wallet-dashboard.component';

describe('WalletDashboardComponent', () => {
  let api: jasmine.SpyObj<ClubApiService>;
  let session: UserSessionStore;

  beforeEach(() => {
    api = jasmine.createSpyObj<ClubApiService>('ClubApiService', [
      'ensureGlobalWallet',
      'getGlobalWallet',
      'getMemberWalletSummary',
      'getClubTreasury',
      'sendOutClubChips',
      'claimBackClubChips',
      'transferClubTreasury'
    ]);
    api.ensureGlobalWallet.and.returnValue(of({
      wallet_id: 'global-1',
      wallet_type: 'GLOBAL_PLAYMONEY',
      currency_type: 'GLOBAL_PLAYMONEY',
      user_id: 'member-1',
      balance: 20000,
      created: true
    }));
    api.getGlobalWallet.and.returnValue(of({
      wallet_id: 'global-1',
      wallet_type: 'GLOBAL_PLAYMONEY',
      currency_type: 'GLOBAL_PLAYMONEY',
      user_id: 'member-1',
      balance: 20000
    }));
    api.getMemberWalletSummary.and.returnValue(of({
      club_id: 'demo',
      user_id: 'member-1',
      role: 'OWNER',
      currency_type: 'CLUB_CHIPS',
      available_balance: 12000,
      in_play_balance: 500
    }));
    api.getClubTreasury.and.returnValue(of({
      club_id: 'demo',
      currency_type: 'CLUB_CHIPS',
      chip_balance: 10000
    }));
    api.sendOutClubChips.and.callFake((_apiBase, clubId, _idToken, request) => of({
      club_id: clubId,
      transaction_id: request.transaction_id,
      type: 'SEND_OUT',
      amount: request.amount,
      from_user_id: 'member-1',
      to_user_id: request.user_id,
      status: 'completed'
    }));
    api.claimBackClubChips.and.callFake((_apiBase, clubId, _idToken, request) => of({
      club_id: clubId,
      transaction_id: request.transaction_id,
      type: 'CLAIM_BACK',
      amount: request.amount,
      from_user_id: request.user_id,
      to_user_id: 'member-1',
      status: 'completed'
    }));
    api.transferClubTreasury.and.returnValue(of({
      transaction_id: 'transfer-3',
      type: 'INTER_CLUB_TRANSFER',
      from_club_id: 'demo',
      to_club_id: 'club-other',
      amount: 600,
      status: 'completed'
    }));
    TestBed.configureTestingModule({
      imports: [WalletDashboardComponent],
      providers: [
        { provide: ClubApiService, useValue: api },
        { provide: FirebaseAuthService, useValue: { getCurrentIdToken: () => Promise.resolve('firebase-token') } }
      ]
    });
    session = TestBed.inject(UserSessionStore);
    session.setVerifiedMember('member-1', 'Alex', 'OWNER');
  });

  it('reads the persistent global wallet and explains the reserve behavior', async () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(api.ensureGlobalWallet).not.toHaveBeenCalled();
    expect(api.getGlobalWallet).toHaveBeenCalledWith('http://127.0.0.1:8000', 'firebase-token');
    expect(component.globalWallet()?.balance).toBe(20000);
    expect(component.globalWalletCreated()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('does not debit the platform reserve');
  });

  it('uses the post-sign-in ensured wallet without issuing another ensure or read', () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialGlobalWallet = {
      wallet_id: 'global-1',
      wallet_type: 'GLOBAL_PLAYMONEY',
      currency_type: 'GLOBAL_PLAYMONEY',
      user_id: 'member-1',
      balance: 20000
    };
    fixture.componentInstance.initialGlobalWalletCreated = true;
    fixture.detectChanges();

    expect(api.ensureGlobalWallet).not.toHaveBeenCalled();
    expect(api.getGlobalWallet).not.toHaveBeenCalled();
    expect(fixture.componentInstance.globalWalletCreated()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('A global playmoney wallet was created');
  });

  it('uses the read-only global wallet route when refreshing', async () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.refresh();
    await fixture.whenStable();
    expect(api.getGlobalWallet).toHaveBeenCalledWith('http://127.0.0.1:8000', 'firebase-token');
  });

  it('loads the authenticated member balance and authorized treasury balance', async () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(api.getMemberWalletSummary).toHaveBeenCalledWith('http://127.0.0.1:8000', 'demo', 'firebase-token');
    expect(api.getClubTreasury).toHaveBeenCalledWith('http://127.0.0.1:8000', 'demo', 'firebase-token');
    expect(component.clubWallet()?.available_balance).toBe(12000);
    expect(component.clubTreasury()?.chip_balance).toBe(10000);
    expect(fixture.nativeElement.textContent).toContain('Agent and player roles use the same member balances');
  });

  it('rejects a member wallet response with invalid balances', async () => {
    api.getMemberWalletSummary.and.returnValue(of({
      club_id: 'demo',
      user_id: 'member-1',
      role: 'OWNER',
      currency_type: 'CLUB_CHIPS',
      available_balance: -1,
      in_play_balance: 500
    }));
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.clubWallet()).toBeNull();
    expect(fixture.componentInstance.loadError()).toContain('does not match');
  });

  it('does not display a treasury balance with an invalid amount', async () => {
    api.getClubTreasury.and.returnValue(of({
      club_id: 'demo',
      currency_type: 'CLUB_CHIPS',
      chip_balance: -1
    }));
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.clubWallet()?.available_balance).toBe(12000);
    expect(fixture.componentInstance.clubTreasury()).toBeNull();
  });

  it('sends chips to a member with a generated idempotency transaction ID', async () => {
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.transferTarget.set('player-2');
    component.transferAmount.set(600);

    await component.submitTransfer();

    const [, clubId, token, request] = api.sendOutClubChips.calls.mostRecent().args;
    expect(clubId).toBe('demo');
    expect(token).toBe('firebase-token');
    expect(request.user_id).toBe('player-2');
    expect(request.amount).toBe(600);
    expect(request.transaction_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(component.transferNotice()).toContain('Chips sent to player-2');
    expect(api.getMemberWalletSummary).toHaveBeenCalledTimes(2);
  });

  it('shows API errors and reuses the same transaction ID when retrying unchanged details', async () => {
    let attempts = 0;
    api.sendOutClubChips.and.callFake((_apiBase, clubId, _idToken, request) => {
      attempts += 1;
      return attempts === 1
        ? throwError(() => new HttpErrorResponse({
          status: 409,
          error: { message: 'Insufficient balance', trace_id: 'trace-123' }
        }))
        : of({
          club_id: clubId,
          transaction_id: request.transaction_id,
          type: 'SEND_OUT',
          amount: request.amount,
          from_user_id: 'member-1',
          to_user_id: request.user_id,
          status: 'completed'
        });
    });
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.transferTarget.set('player-2');
    component.transferAmount.set(600);

    await component.submitTransfer();
    const firstTransactionId = api.sendOutClubChips.calls.first().args[3].transaction_id;
    expect(component.transferNotice()).toBe('Insufficient balance Reference: trace-123');

    await component.submitTransfer();

    expect(api.sendOutClubChips.calls.mostRecent().args[3].transaction_id).toBe(firstTransactionId);
    expect(component.transferNotice()).toContain('Chips sent to player-2');
  });

  it('does not report success when the transfer response mismatches the request', async () => {
    api.sendOutClubChips.and.returnValue(of({
      club_id: 'demo',
      transaction_id: 'different-transaction',
      type: 'SEND_OUT',
      amount: 600,
      from_user_id: 'member-1',
      to_user_id: 'player-2',
      status: 'completed'
    }));
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.transferTarget.set('player-2');
    component.transferAmount.set(600);

    await component.submitTransfer();

    expect(component.transferNotice()).toContain('unexpected transfer result');
    expect(api.getMemberWalletSummary).toHaveBeenCalledTimes(1);
  });

  it('does not show member transfer controls to a player', async () => {
    session.setVerifiedMember('member-1', 'Alex', 'PLAYER');
    api.getMemberWalletSummary.and.returnValue(of({
      club_id: 'demo',
      user_id: 'member-1',
      role: 'PLAYER',
      currency_type: 'CLUB_CHIPS',
      available_balance: 12000,
      in_play_balance: 500
    }));
    const fixture = TestBed.createComponent(WalletDashboardComponent);
    fixture.componentInstance.initialScope = 'club';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.wallet-transfer-submit')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Only an authorized owner, manager, or assigned agent');
  });
});
