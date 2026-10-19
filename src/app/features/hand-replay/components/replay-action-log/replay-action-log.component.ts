import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ReplayFrame } from '../../models/hand-replay.models';

interface ReplayStreetGroup {
  label: string;
  frames: ReplayFrame[];
  board: string[];
  pot: number;
}

@Component({
  selector: 'app-replay-action-log',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './replay-action-log.component.html',
  styleUrl: './replay-action-log.component.css'
})
export class ReplayActionLogComponent {
  readonly frames = input.required<ReplayFrame[]>();
  readonly currentFrameIndex = input.required<number>();
  readonly seek = output<number>();

  get actionGroups(): ReplayStreetGroup[] {
    const groups: ReplayStreetGroup[] = [];
    for (const frame of this.frames()) {
      if (!frame.last_action) continue;
      const label = this.streetName(frame.street);
      let group = groups.find((item) => item.label === label);
      if (!group) {
        group = { label, frames: [], board: [], pot: frame.pot };
        groups.push(group);
      }
      group.frames.push(frame);
      group.board = frame.community_cards;
      group.pot = frame.pot;
    }
    return groups;
  }

  playerName(frame: ReplayFrame, userId: string): string {
    return frame.players.find((player) => player.user_id === userId)?.username ?? userId;
  }

  playerSeat(frame: ReplayFrame, userId: string): number | null {
    return frame.players.find((player) => player.user_id === userId)?.seat ?? null;
  }

  playerStack(frame: ReplayFrame, userId: string): number | null {
    return frame.players.find((player) => player.user_id === userId)?.stack ?? null;
  }

  streetName(street: number | null): string {
    if (street === null) return 'Showdown';
    return ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'][street] ?? `Street ${street}`;
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
}