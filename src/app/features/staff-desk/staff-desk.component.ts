import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { ClubRole } from '../../core/user-session.store';

export type StaffDeskSection = 'overview' | 'cashier' | 'members' | 'messages' | 'more';
type CashierSection = 'trade' | 'records' | 'requests';
type MemberSort = 'fee' | 'winnings' | 'hands' | 'chips';
type MockDeskMember = {
  id: string;
  name: string;
  nickname: string;
  chips: number;
  fee: number;
  winnings: number;
  hands: number;
  lastSeen: string;
  agentId: string;
};
type MockTrade = { id: number; type: string; member: string; amount: number; time: string; status: string };
type MockRequest = { id: number; member: string; amount: number; time: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' };
type MockMessage = { id: number; title: string; body: string; date: string; unread: boolean };

@Component({
  selector: 'app-staff-desk',
  imports: [DecimalPipe],
  templateUrl: './staff-desk.component.html',
  styleUrl: './staff-desk.component.css'
})
export class StaffDeskComponent implements OnChanges {
  @Input({ required: true }) role!: ClubRole;
  @Input() clubName = 'Card Games Manila';
  @Input() initialSection: StaffDeskSection = 'cashier';
  @Output() close = new EventEmitter<void>();

  readonly section = signal<StaffDeskSection>('cashier');
  readonly cashierSection = signal<CashierSection>('trade');
  readonly period = signal<'today' | 'week' | 'lastWeek' | 'overall'>('today');
  readonly search = signal('');
  readonly recordSearch = signal('');
  readonly memberSort = signal<MemberSort>('fee');
  readonly selectedMemberId = signal('member-01');
  readonly amount = signal(100);
  readonly availableChips = signal(12_400);
  readonly yourChips = signal(80.49);
  readonly autoReject = signal(false);
  readonly notificationsEnabled = signal(true);
  readonly quitPromptOpen = signal(false);
  readonly notice = signal('');

  readonly members = signal<MockDeskMember[]>([
    { id: 'member-01', name: 'joppy2024', nickname: 'joppy2024', chips: 80.49, fee: 60.2, winnings: -285.93, hands: 248, lastSeen: 'Online', agentId: 'current-agent' },
    { id: 'member-02', name: 'cool CAT', nickname: 'cool CAT', chips: 50.03, fee: 41.8, winnings: 104.5, hands: 182, lastSeen: '8 min ago', agentId: 'current-agent' },
    { id: 'member-03', name: 'oxygen81', nickname: 'oxygene81', chips: 0, fee: 18.25, winnings: -32, hands: 90, lastSeen: 'Yesterday', agentId: 'current-agent' },
    { id: 'member-04', name: 'Maya Cruz', nickname: 'mayac', chips: 530, fee: 122.4, winnings: 390, hands: 504, lastSeen: 'Online', agentId: 'agent-02' },
    { id: 'member-05', name: 'Noah Reyes', nickname: 'nr-poker', chips: 756.4, fee: 94.1, winnings: -117.75, hands: 317, lastSeen: '2 hr ago', agentId: 'agent-02' }
  ]);

  readonly trades = signal<MockTrade[]>([
    { id: 3, type: 'SEND OUT', member: 'cool CAT', amount: 200, time: 'Today · 10:22', status: 'COMPLETED' },
    { id: 2, type: 'CLAIM BACK', member: 'joppy2024', amount: 110, time: 'Today · 09:41', status: 'COMPLETED' },
    { id: 1, type: 'SEND OUT', member: 'oxygen81', amount: 500, time: 'Yesterday · 18:06', status: 'COMPLETED' }
  ]);

  readonly requests = signal<MockRequest[]>([
    { id: 2, member: 'Maya Cruz', amount: 300, time: 'Today · 11:08', status: 'PENDING' },
    { id: 1, member: 'joppy2024', amount: 100, time: 'Today · 10:34', status: 'PENDING' }
  ]);

  readonly messages = signal<MockMessage[]>([
    { id: 4, title: 'Club Activated', body: 'Club has been activated. Players in this club can now join tables.', date: 'Today', unread: true },
    { id: 3, title: 'Club Suspended', body: 'A previous club suspension notice.', date: 'Oct 16', unread: false },
    { id: 2, title: 'High Hand Reward', body: 'Your player received a 500 chip high-hand reward.', date: 'Oct 12', unread: true },
    { id: 1, title: 'Member Removed from Club', body: 'A membership update was recorded for your club.', date: 'Oct 09', unread: false }
  ]);

  readonly visibleMembers = computed(() => {
    const query = this.search().trim().toLowerCase();
    const scoped = this.role === 'AGENT'
      ? this.members().filter((member) => member.agentId === 'current-agent')
      : this.members();
    return scoped
      .filter((member) => !query || `${member.name} ${member.nickname} ${member.id}`.toLowerCase().includes(query))
      .sort((left, right) => right[this.memberSort()] - left[this.memberSort()]);
  });

  readonly selectedMember = computed(() =>
    this.members().find((member) => member.id === this.selectedMemberId()) ?? this.visibleMembers()[0] ?? null
  );
  readonly totalMemberChips = computed(() => this.members().reduce((sum, member) => sum + member.chips, 0));
  readonly filteredTrades = computed(() => {
    const query = this.recordSearch().trim().toLowerCase();
    return this.trades().filter((trade) => !query || `${trade.member} ${trade.type} ${trade.status}`.toLowerCase().includes(query));
  });
  readonly pendingRequests = computed(() => this.requests().filter((request) => request.status === 'PENDING').length);

  readonly performance = [
    { label: 'Fee', values: { today: 60.2, week: 969.39, lastWeek: 1709.29, overall: 331875.72 } },
    { label: 'Player winnings', values: { today: -285.93, week: -1422.56, lastWeek: 65.03, overall: -41735.47 } },
    { label: 'Insurance + EV Chop', values: { today: 0, week: 0, lastWeek: 0, overall: 361.21 } }
  ];

  ngOnChanges(): void {
    this.section.set(this.role === 'AGENT' && this.initialSection === 'overview'
      ? 'cashier'
      : this.initialSection);
  }

  setAmount(value: string): void {
    this.amount.set(value === '' ? 0 : Number(value));
  }

  toggleAutoReject(): void {
    this.autoReject.update((value) => !value);
  }

  toggleNotifications(): void {
    this.notificationsEnabled.update((value) => !value);
  }

  runMockTrade(type: 'SEND OUT' | 'CLAIM BACK' | 'SEND TICKET'): void {
    const member = this.selectedMember();
    const amount = this.amount();
    if (!member || !Number.isSafeInteger(amount) || amount <= 0) {
      this.notice.set('Enter a member and a positive whole-chip amount.');
      return;
    }
    if (type === 'SEND OUT' && amount > this.availableChips()) {
      this.notice.set('The mock club balance is too low for that send-out.');
      return;
    }
    if (type === 'CLAIM BACK' && amount > member.chips) {
      this.notice.set('The member does not have enough mock chips to claim back.');
      return;
    }

    if (type === 'SEND OUT') {
      this.availableChips.update((balance) => balance - amount);
      this.updateMemberChips(member.id, member.chips + amount);
    } else if (type === 'CLAIM BACK') {
      this.updateMemberChips(member.id, member.chips - amount);
      this.availableChips.update((balance) => balance + amount);
    } else {
      this.requests.update((requests) => [{
        id: Math.max(0, ...requests.map((request) => request.id)) + 1,
        member: member.name,
        amount,
        time: 'Just now',
        status: 'PENDING'
      }, ...requests]);
      this.cashierSection.set('requests');
      this.notice.set(`Mock chip request submitted for ${member.name}.`);
      return;
    }

    this.trades.update((trades) => [{
      id: Math.max(0, ...trades.map((trade) => trade.id)) + 1,
      type,
      member: member.name,
      amount,
      time: 'Just now',
      status: 'COMPLETED'
    }, ...trades]);
    this.notice.set(`Mock ${type.toLowerCase()} of ${amount.toLocaleString()} chips recorded for ${member.name}.`);
  }

  resolveRequest(id: number, status: 'APPROVED' | 'REJECTED'): void {
    this.requests.update((requests) => requests.map((request) => request.id === id && request.status === 'PENDING'
      ? { ...request, status }
      : request));
    this.notice.set(`Mock request ${status.toLowerCase()}. No real wallet was changed.`);
  }

  resolveAllRequests(status: 'APPROVED' | 'REJECTED'): void {
    this.requests.update((requests) => requests.map((request) => request.status === 'PENDING'
      ? { ...request, status }
      : request));
    this.notice.set(`All pending mock requests ${status.toLowerCase()}. No real wallets were changed.`);
  }

  markMessageRead(id: number): void {
    this.messages.update((messages) => messages.map((message) => message.id === id
      ? { ...message, unread: false }
      : message));
  }

  confirmMockQuit(): void {
    this.quitPromptOpen.set(false);
    this.notice.set('Mock only. Your club membership has not changed.');
  }

  private updateMemberChips(memberId: string, chips: number): void {
    this.members.update((members) => members.map((member) => member.id === memberId ? { ...member, chips } : member));
  }
}