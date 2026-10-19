import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ReplayActionLogComponent } from './components/replay-action-log/replay-action-log.component';
import { ReplayControlsComponent } from './components/replay-controls/replay-controls.component';
import { ReplayPlayer } from './models/hand-replay.models';
import { HandReplayStore } from './state/hand-replay.store';

@Component({
  selector: 'app-hand-replay-container',
  imports: [DecimalPipe, ReplayActionLogComponent, ReplayControlsComponent],
  templateUrl: './hand-replay-container.component.html',
  styleUrl: './hand-replay-container.component.css'
})
export class HandReplayContainerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) apiBase = '';
  @Input({ required: true }) clubId = '';
  @Input({ required: true }) handId = '';
  @Input() unionId: string | null = null;
  @Output() readonly close = new EventEmitter<void>();
  readonly activeTab = signal<'summary' | 'detail'>('summary');

  constructor(readonly store: HandReplayStore) {}

  get finalPlayers(): ReplayPlayer[] {
    const frames = this.store.replayData()?.frames ?? [];
    for (let index = frames.length - 1; index >= 0; index--) {
      if (frames[index].players.length > 0) return frames[index].players;
    }
    return [];
  }

  winnerAmount(userId: string): number | null {
    return this.store.replayData()?.winners.find((winner) => winner.user_id === userId)?.amount ?? null;
  }

  setTab(tab: 'summary' | 'detail'): void {
    this.activeTab.set(tab);
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

  ngOnInit(): void {
    this.store.load(this.apiBase, this.clubId, this.handId, this.unionId);
  }

  ngOnDestroy(): void {
    this.store.pause();
  }

  retry(): void {
    this.store.load(this.apiBase, this.clubId, this.handId, this.unionId);
  }
}