import { computed, Injectable, signal } from '@angular/core';

export type ClubRole = 'OWNER' | 'MANAGER' | 'AGENT' | 'PLAYER' | 'UNION_ADMIN';

@Injectable({ providedIn: 'root' })
export class UserSessionStore {
  readonly memberId = signal('player-a');
  readonly displayName = signal('joppy2024');
  readonly role = signal<ClubRole>('PLAYER');
  readonly firebaseIdToken = signal<string | null>(null);
  readonly unionAdminIds = signal<string[]>([]);
  readonly canManageTables = computed(() => ['OWNER', 'MANAGER', 'UNION_ADMIN'].includes(this.role()));
  readonly canManageClub = computed(() => this.role() === 'OWNER');
  readonly canUseAgentDesk = computed(() => this.role() === 'AGENT');

  canManageUnion(unionId: string | null): boolean {
    return unionId !== null && this.unionAdminIds().includes(unionId);
  }

  setUnionAdmin(unionId: string, isAdmin: boolean): void {
    this.unionAdminIds.update((current) => {
      const admins = new Set(current);
      if (isAdmin) admins.add(unionId);
      else admins.delete(unionId);
      return [...admins];
    });
  }

  setVerifiedMember(
    memberId: string,
    displayName: string,
    role: ClubRole,
    firebaseIdToken: string | null = null
  ): void {
    if (this.memberId() !== memberId) this.unionAdminIds.set([]);
    this.memberId.set(memberId);
    this.displayName.set(displayName);
    this.role.set(role);
    this.firebaseIdToken.set(firebaseIdToken);
  }
}