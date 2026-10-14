import { computed, Injectable, signal } from '@angular/core';

export type ClubRole = 'OWNER' | 'MANAGER' | 'AGENT' | 'PLAYER';

@Injectable({ providedIn: 'root' })
export class UserSessionStore {
  readonly memberId = signal('player-a');
  readonly displayName = signal('joppy2024');
  readonly role = signal<ClubRole>('PLAYER');
  readonly firebaseIdToken = signal<string | null>(null);
  readonly canManageTables = computed(() => ['OWNER', 'MANAGER'].includes(this.role()));
  readonly canManageClub = computed(() => this.role() === 'OWNER');
  readonly canUseAgentDesk = computed(() => this.role() === 'AGENT');

  setVerifiedMember(
    memberId: string,
    displayName: string,
    role: ClubRole,
    firebaseIdToken: string | null = null
  ): void {
    this.memberId.set(memberId);
    this.displayName.set(displayName);
    this.role.set(role);
    this.firebaseIdToken.set(firebaseIdToken);
  }
}