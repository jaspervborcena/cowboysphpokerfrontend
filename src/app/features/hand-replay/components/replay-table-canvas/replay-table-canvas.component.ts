import { Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ReplayFrame } from '../../models/hand-replay.models';

@Component({
  selector: 'app-replay-table-canvas',
  imports: [DecimalPipe],
  templateUrl: './replay-table-canvas.component.html',
  styleUrl: './replay-table-canvas.component.css'
})
export class ReplayTableCanvasComponent {
  readonly frame = input<ReplayFrame | null>(null);

  streetName(street: number | null): string {
    if (street === null) return 'Hand complete';
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