import { TestBed } from '@angular/core/testing';
import { TableRulesService } from './table-rules.service';

describe('TableRulesService', () => {
  let service: TableRulesService;

  beforeEach(() => {
    service = TestBed.inject(TableRulesService);
  });

  it('resolves Hold’em Ring rules by the catalog game ID', () => {
    const rules = service.forGame('no_limit_texas_holdem');

    expect(rules?.displayName).toBe('No-Limit Hold’em Ring');
    expect(rules?.blindEntry.decisions).toEqual(['POST_BLIND', 'WAIT_FOR_BIG_BLIND']);
  });

  it('resolves PLO4 Ring rules independently', () => {
    const rules = service.forGame('pot_limit_omaha_4');

    expect(rules?.displayName).toBe('PLO4 Ring');
    expect(rules?.format).toBe('RING');
  });

  it('does not guess rules for unknown game IDs', () => {
    expect(service.forGame(undefined)).toBeNull();
    expect(service.forGame('unknown_game')).toBeNull();
  });
});