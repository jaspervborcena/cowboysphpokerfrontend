import { Injectable } from '@angular/core';
import { noLimitHoldemRingRules } from './no-limit-holdem-ring.rules';
import { plo4RingRules } from './plo4-ring.rules';
import { TableRules } from './table-rules.types';

@Injectable({ providedIn: 'root' })
export class TableRulesService {
  private readonly rules: readonly TableRules[] = [noLimitHoldemRingRules, plo4RingRules];

  forGame(gameId: string | undefined, format: string = 'RING'): TableRules | null {
    if (!gameId || format !== 'RING') return null;
    return this.rules.find((rules) => (rules.gameIds as readonly string[]).includes(gameId)) ?? null;
  }
}